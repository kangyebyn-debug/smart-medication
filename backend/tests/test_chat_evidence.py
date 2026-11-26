import unittest
from unittest.mock import AsyncMock, call, patch
from uuid import uuid4

from fastapi import HTTPException

from app.auth import CurrentUser
from app.services.chat_evidence import EVIDENCE_SCOPE, collect_chat_evidence


class ChatEvidenceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.user = CurrentUser(id=uuid4(), access_token="offline-test-token")

    @staticmethod
    def drug(name):
        # 가상 품목이다. 실제 약 사이의 의학적 상호작용을 주장하는 fixture가 아니다.
        return {"drug_name": name, "product_code": None}

    async def test_reads_all_pages_with_own_filter_even_when_server_cap_is_small(self):
        rows = [self.drug("가상약A"), self.drug("가상약B"), self.drug("가상약C")]
        with (
            patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                  side_effect=[rows[:1], rows[1:], []]) as storage,
            patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock,
                  return_value={"is_prohibited": False}) as check,
        ):
            evidence = await collect_chat_evidence(self.user)
        self.assertEqual(evidence["saved_drugs"], rows)
        self.assertEqual(evidence["scope"], EVIDENCE_SCOPE)
        self.assertEqual([c.kwargs["params"]["offset"] for c in storage.await_args_list], ["0", "1", "3"])
        for invocation in storage.await_args_list:
            self.assertEqual(invocation.args, ("GET", self.user))
            self.assertEqual(invocation.kwargs["params"]["user_id"], f"eq.{self.user.id}")
            self.assertEqual(invocation.kwargs["params"]["order"], "created_at.asc,id.asc")
        self.assertEqual(check.await_args_list, [
            call("가상약A", "가상약B"), call("가상약A", "가상약C"), call("가상약B", "가상약C"),
        ])
        self.assertEqual([p["evidence_id"] for p in evidence["pairs"]], ["pair-1", "pair-2", "pair-3"])

    async def test_zero_or_one_drug_never_calls_public_lookup(self):
        for rows in ([], [self.drug("가상약A")]):
            with (
                self.subTest(count=len(rows)),
                patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                      side_effect=[rows, []]) as storage,
                patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock) as check,
            ):
                evidence = await collect_chat_evidence(self.user)
                self.assertEqual(evidence["saved_drugs"], rows)
                self.assertEqual(evidence["pairs"], [])
                check.assert_not_awaited()
                self.assertEqual(storage.await_count, 2 if rows else 1)

    async def test_four_drugs_get_all_six_combinations_without_truncation(self):
        with (
            patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                  side_effect=[[self.drug(str(i)) for i in range(4)], []]),
            patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock,
                  return_value={"is_prohibited": False}) as check,
        ):
            evidence = await collect_chat_evidence(self.user)
        self.assertEqual(check.await_count, 6)
        self.assertEqual(len(evidence["pairs"]), 6)

    async def test_projects_only_this_pair_and_approved_reason_fields(self):
        with (
            patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                  side_effect=[[self.drug("가상약A"), self.drug("가상약B")], []]),
            patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock, return_value={
                "is_prohibited": True,
                "all_prohibited": ["가상약B", "다른약C"],
                "interactions": [
                    {"MIXTURE_ITEM_NAME": "가상약B", "PROHBT_CONTENT": "가상 근거 B", "not_needed": "exclude"},
                    {"MIXTURE_ITEM_NAME": "다른약C", "PROHBT_CONTENT": "다른 약의 사유 C"},
                ],
            }),
        ):
            evidence = await collect_chat_evidence(self.user)
        pair = evidence["pairs"][0]
        self.assertTrue(pair["is_prohibited"])
        self.assertEqual(len(pair["details"]), 1)
        self.assertEqual(pair["details"][0]["PROHBT_CONTENT"], "가상 근거 B")
        self.assertNotIn("not_needed", str(evidence))
        self.assertNotIn("다른 약의 사유 C", str(evidence))
        self.assertNotIn("all_prohibited", pair)
        self.assertNotIn("offline-test-token", str(evidence))
        self.assertNotIn(str(self.user.id), str(evidence))

    async def test_empty_official_result_is_checked_not_safety_guarantee(self):
        with (
            patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                  side_effect=[[self.drug("가상약A"), self.drug("가상약B")], []]),
            patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock,
                  return_value={"is_prohibited": False, "message": "원래 공개 API 문구"}),
        ):
            evidence = await collect_chat_evidence(self.user)
        self.assertFalse(evidence["pairs"][0]["is_prohibited"])
        self.assertEqual(evidence["pairs"][0]["details"], [])
        self.assertIn("확정하지 않습니다", evidence["scope"])
        self.assertIn("최대 20건", evidence["scope"])

    async def test_dur_failure_stops_all_pairs_and_is_not_empty_evidence(self):
        with (
            patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                  side_effect=[[self.drug(str(i)) for i in range(3)], []]),
            patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock,
                  side_effect=HTTPException(status_code=502, detail="공공 의약품 정보 조회에 실패했습니다.")) as check,
        ):
            with self.assertRaises(HTTPException) as error:
                await collect_chat_evidence(self.user)
        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(check.await_count, 1)

    async def test_malformed_official_fields_fail_closed_without_details(self):
        with (
            patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                  side_effect=[[self.drug("가상약A"), self.drug("가상약B")], []]),
            patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock,
                  side_effect=TypeError("private upstream body")),
        ):
            with self.assertRaises(HTTPException) as error:
                await collect_chat_evidence(self.user)
        self.assertEqual(error.exception.status_code, 502)
        self.assertNotIn("private", error.exception.detail)

    async def test_invalid_saved_drug_or_storage_failure_never_calls_dur(self):
        for outcome in ([{"drug_name": " ", "product_code": None}], [{}], HTTPException(status_code=403)):
            with (
                self.subTest(outcome=outcome),
                patch("app.services.chat_evidence.request_saved_drugs", new_callable=AsyncMock,
                      side_effect=outcome if isinstance(outcome, Exception) else [outcome, []]),
                patch("app.services.chat_evidence.check_interaction", new_callable=AsyncMock) as check,
            ):
                with self.assertRaises(HTTPException) as error:
                    await collect_chat_evidence(self.user)
                self.assertEqual(error.exception.status_code, 403 if isinstance(outcome, Exception) else 502)
                check.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
