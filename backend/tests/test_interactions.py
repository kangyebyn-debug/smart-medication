import unittest
from unittest.mock import AsyncMock, call, patch

import httpx
from fastapi import HTTPException

from app.main import app
from app.services.interactions import check_interaction
from app.services.public_api import DURResponseError


class InteractionServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_substring_match_keeps_all_original_rows(self):
        # 가상의 응답으로 기존 부분 문자열 판정·전체 행 반환 계약만 검증한다.
        rows = [
            {"MIXTURE_ITEM_NAME": "비교약정 10mg", "PROHBT_CONTENT": "가상 사유"},
            {"MIXTURE_ITEM_NAME": "다른약정", "PROHBT_CONTENT": "다른 가상 사유"},
        ]
        with patch(
            "app.services.interactions.get_interactions_by_item_name",
            new_callable=AsyncMock, return_value=rows,
        ) as fetch:
            result = await check_interaction("기준약정", "비교약정")

        fetch.assert_awaited_once_with("기준약정")
        self.assertEqual(result, {
            "drug1": "기준약정",
            "drug2": "비교약정",
            "is_prohibited": True,
            "interactions": rows,
            "all_prohibited": ["비교약정 10mg", "다른약정"],
        })
        self.assertIs(result["interactions"], rows)

    async def test_no_match_keeps_names_but_omits_rows(self):
        with patch(
            "app.services.interactions.get_interactions_by_item_name",
            new_callable=AsyncMock,
            return_value=[{"MIXTURE_ITEM_NAME": "다른약정"}, {}],
        ):
            result = await check_interaction("기준약정", "비교약정")

        self.assertEqual(result, {
            "drug1": "기준약정",
            "drug2": "비교약정",
            "is_prohibited": False,
            "interactions": [],
            "all_prohibited": ["다른약정", ""],
        })

    async def test_empty_response_keeps_distinct_message_shape(self):
        with patch(
            "app.services.interactions.get_interactions_by_item_name",
            new_callable=AsyncMock, return_value=[],
        ):
            result = await check_interaction("기준약정", "비교약정")

        self.assertEqual(result, {
            "drug1": "기준약정",
            "drug2": "비교약정",
            "is_prohibited": False,
            "message": "'기준약정'의 병용금기 정보가 없습니다.",
        })

    async def test_upstream_errors_keep_generic_http_502(self):
        for failure in (
            DURResponseError("private response"),
            httpx.ReadTimeout("private URL"),
            RuntimeError("private exception"),
        ):
            with self.subTest(error=type(failure).__name__):
                with patch(
                    "app.services.interactions.get_interactions_by_item_name",
                    new_callable=AsyncMock, side_effect=failure,
                ):
                    with self.assertRaises(HTTPException) as raised:
                        await check_interaction("기준약정", "비교약정")

                self.assertEqual(raised.exception.status_code, 502)
                self.assertEqual(
                    raised.exception.detail, "공공 의약품 정보 조회에 실패했습니다.",
                )

    async def test_original_public_api_defaults_and_timeout_are_unchanged(self):
        requests = []

        def respond(request):
            requests.append(request)
            return httpx.Response(200, text=(
                "<response><header><resultCode>00</resultCode></header>"
                "<body><items/></body></response>"
            ))

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with (
            patch("app.services.public_api.SERVICE_KEY", "test-key"),
            patch("app.services.public_api.httpx.AsyncClient", return_value=client),
        ):
            await check_interaction("기준약정", "비교약정")

        self.assertEqual(len(requests), 1)
        self.assertTrue(requests[0].url.path.endswith("/getUsjntTabooInfoList03"))
        self.assertEqual(requests[0].url.params["pageNo"], "1")
        self.assertEqual(requests[0].url.params["numOfRows"], "20")
        self.assertEqual(requests[0].url.params["itemName"], "기준약정")
        self.assertEqual(requests[0].extensions["timeout"], {
            "connect": 15, "read": 15, "write": 15, "pool": 15,
        })


class InteractionRouteRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_route_and_direct_service_have_identical_results(self):
        for rows in (
            [],
            [{"MIXTURE_ITEM_NAME": "다른약정"}],
            [{"MIXTURE_ITEM_NAME": "비교약정 10mg", "PROHBT_CONTENT": "가상 사유"}],
        ):
            with self.subTest(rows=rows):
                with patch(
                    "app.services.interactions.get_interactions_by_item_name",
                    new_callable=AsyncMock, return_value=rows,
                ) as fetch:
                    expected = await check_interaction("기준약정", "비교약정")
                    async with httpx.AsyncClient(
                        transport=httpx.ASGITransport(app=app), base_url="http://test",
                    ) as client:
                        response = await client.get("/drugs/check", params={
                            "drug1": "기준약정", "drug2": "비교약정",
                        })

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), expected)
                self.assertEqual(fetch.await_args_list, [call("기준약정"), call("기준약정")])

    async def test_route_passes_query_arguments_to_shared_service(self):
        expected = {"kept": "unchanged"}
        with patch(
            "app.routers.drugs.check_interaction_service",
            new_callable=AsyncMock, return_value=expected,
        ) as service:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test",
            ) as client:
                response = await client.get("/drugs/check", params={
                    "drug1": "기준약정", "drug2": "비교약정",
                })

        service.assert_awaited_once_with("기준약정", "비교약정")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected)

    async def test_both_query_parameters_remain_required(self):
        with patch(
            "app.routers.drugs.check_interaction_service", new_callable=AsyncMock,
        ) as service:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test",
            ) as client:
                missing_drug1 = await client.get("/drugs/check", params={"drug2": "비교약정"})
                missing_drug2 = await client.get("/drugs/check", params={"drug1": "기준약정"})

        self.assertEqual(missing_drug1.status_code, 422)
        self.assertEqual(missing_drug2.status_code, 422)
        service.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
