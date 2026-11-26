import json
import time
import unittest
from itertools import combinations
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4
from xml.sax.saxutils import escape

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWKClient
from jwt.algorithms import ECAlgorithm

from app.main import app
from app.services.chat_evidence import EVIDENCE_SCOPE, INSUFFICIENT_DRUGS_REPLY
from app.services.gemini_chat import DISCLAIMER


SUPABASE_URL = "https://offline-chat-test.supabase.co"
PUBLISHABLE_KEY = "sb_publishable_chat_test_only"
GEMINI_KEY = "gemini-test-key-not-real"
PUBLIC_KEY = "public-api-test-key-not-real"
AsyncClient = httpx.AsyncClient


class ChatTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.user_id = uuid4()
        cls.session_id = uuid4()
        cls.key_id = "offline-chat-es256"
        cls.private_key = ec.generate_private_key(ec.SECP256R1())
        cls.public_jwk = ECAlgorithm.to_jwk(cls.private_key.public_key(), as_dict=True)
        cls.public_jwk.update(kid=cls.key_id, alg="ES256", use="sig")

    def setUp(self):
        # 실제 ES256/JWKS 검증을 수행하되 키·계정·외부 응답은 모두 가상이다.
        jwks = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
        patchers = [
            patch.object(jwks, "fetch_data", return_value={"keys": [self.public_jwk]}),
            patch("app.auth.jwks_client", return_value=jwks),
            patch("app.auth.SUPABASE_URL", SUPABASE_URL),
            patch("app.services.gemini_chat.GEMINI_API_KEY", GEMINI_KEY),
            patch("app.services.gemini_chat.GEMINI_MODEL", "gemini-test-flash-lite"),
            patch("app.services.public_api.SERVICE_KEY", PUBLIC_KEY),
        ]
        for module in ("chat_store", "saved_drugs"):
            patchers.extend([
                patch(f"app.services.{module}.SUPABASE_URL", SUPABASE_URL),
                patch(f"app.services.{module}.SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY),
            ])
        for patcher in patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

    def token(self, **changes):
        claims = {
            "sub": str(self.user_id), "role": "authenticated", "aud": "authenticated",
            "iss": f"{SUPABASE_URL}/auth/v1", "exp": int(time.time()) + 3600,
        }
        claims.update(changes)
        return jwt.encode(claims, self.private_key, algorithm="ES256", headers={"kid": self.key_id})

    def session(self, **changes):
        return {
            "id": str(self.session_id), "title": "가상 세션",
            "created_at": "2026-11-26T00:00:00Z", **changes,
        }

    def message(self, role="user", **changes):
        return {
            "id": str(uuid4()), "session_id": str(self.session_id), "role": role,
            "content": "이전 대화 비공개 내용", "created_at": "2026-11-26T00:00:00Z",
            **changes,
        }

    def fixture(self, count=0, *, hidden=False):
        names = [f"가상약{letter}" for letter in "ABCD"[:count]]
        state = {"events": [], "requests": [], "posted": [], "gemini": [], "checks": []}
        drugs = [
            {"drug_name": name, "product_code": str(index), "id": "private-saved-row"}
            for index, name in enumerate(names)
        ]
        history = [
            self.message(content="private-history-user"),
            self.message("assistant", content="private-history-assistant"),
        ]

        def upstream(request):
            state["requests"].append(request)
            path = request.url.path
            if request.url.host == "offline-chat-test.supabase.co":
                self.assertEqual(request.headers["apikey"], PUBLISHABLE_KEY)
                self.assertEqual(request.headers["authorization"], f"Bearer {state['token']}")
                if path == "/rest/v1/chat_sessions":
                    if request.method == "POST":
                        body = json.loads(request.content)
                        state["events"].append("create")
                        state["session_body"] = body
                        self.assertEqual(request.headers["prefer"], "return=representation")
                        return httpx.Response(201, json=[self.session(id=body["id"], title=body["title"])])
                    self.assertEqual(request.url.params["user_id"], f"eq.{self.user_id}")
                    if "id" in request.url.params:
                        state["events"].append("own-session")
                        self.assertEqual(request.url.params["id"], f"eq.{self.session_id}")
                        return httpx.Response(200, json=[] if hidden else [self.session()])
                    state["events"].append("sessions")
                    self.assertEqual(request.url.params["order"], "created_at.desc,id.desc")
                    rows = [self.session()] if request.url.params["offset"] == "0" else []
                    return httpx.Response(200, json=rows)
                if path == "/rest/v1/saved_drugs":
                    state["events"].append("saved")
                    self.assertEqual(request.url.params["user_id"], f"eq.{self.user_id}")
                    self.assertEqual(request.url.params["select"], "drug_name,product_code")
                    self.assertEqual(request.url.params["order"], "created_at.asc,id.asc")
                    self.assertEqual(request.url.params["limit"], "100")
                    # 한 행씩 반환해 작은 서버 row cap에서도 전체 약을 조회함을 검증한다.
                    offset = int(request.url.params["offset"])
                    return httpx.Response(200, json=drugs[offset:offset + 1])
                if path == "/rest/v1/chat_messages":
                    if request.method == "POST":
                        state["events"].append("save")
                        body = json.loads(request.content)
                        state["posted"].append(body)
                        self.assertEqual(request.headers["prefer"], "return=representation")
                        # 응답 순서에 의존하지 않고 assistant 행을 반환해야 한다.
                        return httpx.Response(201, json=list(reversed(body)))
                    state["events"].append("history")
                    self.assertEqual(request.url.params["session_id"], f"eq.{self.session_id}")
                    self.assertEqual(request.url.params["order"], "created_at.asc,id.asc")
                    rows = history if request.url.params["offset"] == "0" else []
                    return httpx.Response(200, json=rows)
            if request.url.host == "apis.data.go.kr":
                state["events"].append("check")
                name = request.url.params["itemName"]
                state["checks"].append(name)
                self.assertEqual(request.url.params["serviceKey"], PUBLIC_KEY)
                self.assertEqual(request.url.params["pageNo"], "1")
                self.assertEqual(request.url.params["numOfRows"], "20")
                self.assertNotIn("authorization", request.headers)
                # 가상 공공 API 응답이며 실제 약의 의학적 상호작용을 주장하지 않는다.
                rows = [
                    {"ITEM_NAME": name, "MIXTURE_ITEM_NAME": target,
                     "PROHBT_CONTENT": f"{name}/{target} 가상 금기 사유",
                     "PRIVATE_COLUMN": "not-model-evidence"}
                    for target in names + ["가상등록외약"] if target != name
                ]
                xml = "".join(
                    "<item>" + "".join(f"<{key}>{escape(value)}</{key}>" for key, value in row.items()) + "</item>"
                    for row in rows
                )
                return httpx.Response(200, text=(
                    "<response><header><resultCode>00</resultCode></header><body><items>"
                    f"{xml}</items></body></response>"
                ))
            if request.url.host == "generativelanguage.googleapis.com":
                state["events"].append("gemini")
                self.assertEqual(request.headers["x-goog-api-key"], GEMINI_KEY)
                self.assertNotIn("authorization", request.headers)
                body = json.loads(request.content)
                state["gemini"].append(body)
                evidence = json.loads(body["contents"][0]["parts"][0]["text"])["evidence"]
                reply = {
                    "answer": "조회한 가상 근거를 설명합니다.",
                    "evidence_ids": [pair["evidence_id"] for pair in evidence["pairs"]],
                }
                return httpx.Response(200, json={"candidates": [{
                    "finishReason": "STOP", "content": {
                        "role": "model", "parts": [{"text": json.dumps(reply, ensure_ascii=False)}],
                    },
                }]})
            self.fail(f"unexpected offline request: {request.method} {request.url.host}{path}")

        return state, upstream

    async def request(self, method, path="/chat/sessions", *, token=None, upstream=None, **kwargs):
        headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
        if upstream is None:
            async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                return await client.request(method, path, headers=headers, **kwargs)

        def offline_client(**_kwargs):
            return AsyncClient(transport=httpx.MockTransport(upstream))

        with patch("app.services.chat_store.httpx.AsyncClient", side_effect=offline_client):
            async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                return await client.request(method, path, headers=headers, **kwargs)

    def message_path(self, session_id=None):
        return f"/chat/sessions/{session_id or self.session_id}/messages"

    async def test_all_four_routes_reject_missing_malformed_and_expired_tokens_before_io(self):
        routes = (
            ("POST", "/chat/sessions", {}), ("GET", "/chat/sessions", {}),
            ("GET", self.message_path(), {}),
            ("POST", self.message_path(), {"json": {"content": "질문"}}),
        )
        with (
            patch("app.routers.chat.request_chat", new_callable=AsyncMock) as storage,
            patch("app.routers.chat.list_chat_rows", new_callable=AsyncMock) as lists,
            patch("app.routers.chat.collect_chat_evidence", new_callable=AsyncMock) as evidence,
            patch("app.routers.chat.generate_grounded_reply", new_callable=AsyncMock) as model,
        ):
            for token in (None, "not-a-jwt", self.token(exp=int(time.time()) - 60)):
                for method, path, kwargs in routes:
                    with self.subTest(method=method, path=path, token_kind="missing" if token is None else "invalid"):
                        response = await self.request(method, path, token=token, **kwargs)
                        self.assertEqual(response.status_code, 401)
                        self.assertEqual(response.headers["www-authenticate"], "Bearer")
            for mock in (storage, lists, evidence, model):
                mock.assert_not_awaited()

    async def test_message_session_id_must_be_uuid(self):
        with patch("app.routers.chat.request_chat", new_callable=AsyncMock) as storage:
            for method in ("GET", "POST"):
                response = await self.request(
                    method, self.message_path("not-a-uuid"), token=self.token(),
                    **({"json": {"content": "질문"}} if method == "POST" else {}),
                )
                self.assertEqual(response.status_code, 422)
            storage.assert_not_awaited()

    async def test_request_bodies_reject_missing_blank_nonstring_and_untrusted_fields(self):
        invalid_sessions = [
            {"title": 123}, {"user_id": str(uuid4())}, {"id": str(uuid4())},
            {"role": "assistant"}, {"content": "추가 필드"},
        ]
        invalid_messages = [
            {}, {"content": " \t\n "}, {"content": None}, {"content": 123},
            {"content": "질문", "user_id": str(uuid4())},
            {"content": "질문", "role": "assistant"},
            {"content": "질문", "session_id": str(uuid4())},
        ]
        with patch("app.routers.chat.request_chat", new_callable=AsyncMock) as storage:
            for path, bodies in (("/chat/sessions", invalid_sessions), (self.message_path(), invalid_messages)):
                for body in bodies:
                    with self.subTest(path=path, body=body):
                        response = await self.request("POST", path, token=self.token(), json=body)
                        self.assertEqual(response.status_code, 422)
            storage.assert_not_awaited()

    async def test_session_create_201_uses_verified_owner_and_normalized_optional_title(self):
        for body, expected in (({"title": "  새 대화  "}, "새 대화"), ({"title": "  "}, None), ({}, None)):
            with self.subTest(body=body):
                state, upstream = self.fixture()
                state["token"] = self.token()
                response = await self.request("POST", token=state["token"], upstream=upstream, json=body)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json()["title"], expected)
                self.assertEqual(state["session_body"]["user_id"], str(self.user_id))
                self.assertEqual(UUID(state["session_body"]["id"]).version, 4)
                self.assertEqual(set(state["session_body"]), {"id", "user_id", "title"})
                self.assertNotIn("user_id", response.json())

    async def test_list_sessions_200_filters_owner_and_reads_to_empty_page_in_descending_order(self):
        state, upstream = self.fixture()
        state["token"] = self.token()
        response = await self.request("GET", token=state["token"], upstream=upstream)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [self.session()])
        self.assertEqual([request.url.params["offset"] for request in state["requests"]], ["0", "1"])

    async def test_message_history_200_checks_owner_before_ordered_history(self):
        state, upstream = self.fixture()
        state["token"] = self.token()
        response = await self.request("GET", self.message_path(), token=state["token"], upstream=upstream)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["role"] for row in response.json()], ["user", "assistant"])
        self.assertEqual(state["events"], ["own-session", "history", "history"])

    async def test_rls_hidden_session_returns_404_before_history_evidence_or_model(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                state, upstream = self.fixture(3, hidden=True)
                state["token"] = self.token()
                response = await self.request(
                    method, self.message_path(), token=state["token"], upstream=upstream,
                    **({"json": {"content": "질문"}} if method == "POST" else {}),
                )
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json(), {"detail": "대화 세션을 찾을 수 없습니다."})
                self.assertEqual(state["events"], ["own-session"])

    async def test_zero_or_one_saved_drug_uses_deterministic_reply_without_public_or_model_call(self):
        for count in (0, 1):
            with self.subTest(count=count):
                state, upstream = self.fixture(count)
                state["token"] = self.token()
                response = await self.request(
                    "POST", self.message_path(), token=state["token"], upstream=upstream,
                    json={"content": "  술과 함께 먹어도 되는지 추측해주세요  "},
                )
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json()["content"], INSUFFICIENT_DRUGS_REPLY)
                self.assertEqual(response.json()["role"], "assistant")
                self.assertNotIn("check", state["events"])
                self.assertNotIn("gemini", state["events"])
                self.assertEqual(state["events"], ["own-session"] + ["saved"] * (count + 1) + ["save"])
                self.assertEqual(state["posted"][0][0]["content"], "술과 함께 먹어도 되는지 추측해주세요")
                self.assertEqual(len(state["posted"]), 1)
                self.assertEqual([row["role"] for row in state["posted"][0]], ["user", "assistant"])

    async def test_two_and_three_saved_drugs_run_full_grounded_chain_and_single_atomic_insert(self):
        for count in (2, 3):
            with self.subTest(count=count):
                state, upstream = self.fixture(count)
                state["token"] = self.token()
                response = await self.request(
                    "POST", self.message_path(), token=state["token"], upstream=upstream,
                    json={"content": "등록한 약들의 조회 결과를 설명해주세요."},
                )
                self.assertEqual(response.status_code, 201)
                answer = response.json()
                self.assertEqual(answer["role"], "assistant")
                self.assertIn(EVIDENCE_SCOPE, answer["content"])
                self.assertIn(DISCLAIMER, answer["content"])
                pairs_count = count * (count - 1) // 2
                self.assertEqual(state["events"], (
                    ["own-session"] + ["saved"] * (count + 1)
                    + ["check"] * pairs_count + ["gemini", "save"]
                ))
                model_input = json.loads(state["gemini"][0]["contents"][0]["parts"][0]["text"])
                evidence = model_input["evidence"]
                names = [drug["drug_name"] for drug in evidence["saved_drugs"]]
                self.assertEqual([(row["drug1"], row["drug2"]) for row in evidence["pairs"]], list(combinations(names, 2)))
                self.assertEqual(state["checks"], [first for first, _second in combinations(names, 2)])
                for pair in evidence["pairs"]:
                    self.assertTrue(pair["is_prohibited"])
                    self.assertEqual(len(pair["details"]), 1)
                    self.assertEqual(pair["details"][0]["MIXTURE_ITEM_NAME"], pair["drug2"])
                    self.assertIn("가상 금기 사유", pair["details"][0]["PROHBT_CONTENT"])
                self.assertEqual(len(state["posted"]), 1)
                posted = state["posted"][0]
                self.assertEqual(len(posted), 2)
                self.assertEqual([row["role"] for row in posted], ["user", "assistant"])
                self.assertLess(posted[0]["created_at"], posted[1]["created_at"])
                self.assertEqual(posted[1]["id"], answer["id"])
                self.assertEqual(posted[1]["content"], answer["content"])
                self.assertTrue(all(row["session_id"] == str(self.session_id) for row in posted))

    async def test_previous_history_ids_tokens_and_keys_are_not_sent_as_model_content(self):
        state, upstream = self.fixture(3)
        state["token"] = self.token()
        history = await self.request("GET", self.message_path(), token=state["token"], upstream=upstream)
        self.assertEqual(history.status_code, 200)
        state["events"].clear()
        response = await self.request(
            "POST", self.message_path(), token=state["token"], upstream=upstream,
            json={"content": "등록한 약을 확인해주세요."},
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("history", state["events"])
        body = json.dumps(state["gemini"][0], ensure_ascii=False)
        for private in (
            str(self.user_id), str(self.session_id), state["token"], PUBLISHABLE_KEY,
            GEMINI_KEY, PUBLIC_KEY, "private-history-user", "private-history-assistant",
            "private-saved-row", "not-model-evidence", "가상등록외약",
        ):
            self.assertNotIn(private, body)
        content = state["gemini"][0]["contents"]
        self.assertEqual(len(content), 1)
        self.assertEqual(set(json.loads(content[0]["parts"][0]["text"])), {"question", "evidence"})

    async def test_dur_failure_blocks_gemini_and_does_not_save_half_conversation(self):
        state, normal = self.fixture(3)
        state["token"] = self.token()

        def upstream(request):
            if request.url.host == "apis.data.go.kr":
                state["events"].append("failed-check")
                return httpx.Response(200, text="<response><header><resultCode>99</resultCode></header></response>")
            return normal(request)

        response = await self.request(
            "POST", self.message_path(), token=state["token"], upstream=upstream, json={"content": "질문"},
        )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"detail": "공공 의약품 정보 조회에 실패했습니다."})
        self.assertFalse(state["gemini"])
        self.assertFalse(state["posted"])

    async def test_gemini_failure_does_not_save_either_message(self):
        for status, expected in ((429, 429), (500, 502), (401, 503)):
            with self.subTest(status=status):
                state, normal = self.fixture(2)
                state["token"] = self.token()

                def upstream(request):
                    if request.url.host == "generativelanguage.googleapis.com":
                        return httpx.Response(status, json={"error": "private AI error"})
                    return normal(request)

                response = await self.request(
                    "POST", self.message_path(), token=state["token"], upstream=upstream, json={"content": "질문"},
                )
                self.assertEqual(response.status_code, expected)
                self.assertNotIn("private AI error", response.text)
                self.assertFalse(state["posted"])

    async def test_saved_drug_store_failure_blocks_model_and_message_insert(self):
        state, normal = self.fixture(2)
        state["token"] = self.token()

        def upstream(request):
            if request.url.path == "/rest/v1/saved_drugs":
                return httpx.Response(403, json={"message": "private database error"})
            return normal(request)

        response = await self.request(
            "POST", self.message_path(), token=state["token"], upstream=upstream, json={"content": "질문"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(state["posted"])
        self.assertFalse(state["gemini"])

    async def test_atomic_insert_failure_never_falls_back_to_individual_row_writes(self):
        state, normal = self.fixture(2)
        state["token"] = self.token()
        attempts = []

        def upstream(request):
            if request.url.path == "/rest/v1/chat_messages" and request.method == "POST":
                attempts.append(json.loads(request.content))
                return httpx.Response(403, json={"message": "private insert error"})
            return normal(request)

        response = await self.request(
            "POST", self.message_path(), token=state["token"], upstream=upstream, json={"content": "질문"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("private insert error", response.text)
        self.assertEqual(len(attempts), 1)
        self.assertEqual([row["role"] for row in attempts[0]], ["user", "assistant"])

    async def test_malformed_session_rows_return_502_on_all_session_reads_and_create(self):
        bad_rows = ({}, None, [None], [{}], [self.session(id="not-a-uuid")])
        routes = (
            ("GET", "/chat/sessions", {}), ("POST", "/chat/sessions", {}),
            ("GET", self.message_path(), {}),
            ("POST", self.message_path(), {"json": {"content": "질문"}}),
        )
        for method, path, kwargs in routes:
            for rows in bad_rows:
                with self.subTest(method=method, path=path, rows=rows):
                    response = await self.request(
                        method, path, token=self.token(),
                        upstream=lambda request: httpx.Response(
                            200, json=rows if request.url.params.get("offset", "0") == "0" else [],
                        ), **kwargs,
                    )
                    self.assertEqual(response.status_code, 502)

    async def test_wrong_or_multiple_required_session_rows_fail_before_evidence(self):
        for rows in ([self.session(id=str(uuid4()))], [self.session(), self.session()]):
            with self.subTest(rows=rows), patch(
                "app.routers.chat.collect_chat_evidence", new_callable=AsyncMock,
            ) as evidence:
                response = await self.request(
                    "POST", self.message_path(), token=self.token(),
                    upstream=lambda _request: httpx.Response(200, json=rows), json={"content": "질문"},
                )
                self.assertEqual(response.status_code, 502)
                evidence.assert_not_awaited()

    async def test_malformed_or_foreign_message_history_returns_502(self):
        for rows in ([{}], [self.message(role="system")], [self.message(session_id=str(uuid4()))]):
            with self.subTest(rows=rows):
                state, normal = self.fixture()
                state["token"] = self.token()

                def upstream(request):
                    if request.url.path == "/rest/v1/chat_messages":
                        return httpx.Response(200, json=rows if request.url.params["offset"] == "0" else [])
                    return normal(request)

                response = await self.request("GET", self.message_path(), token=state["token"], upstream=upstream)
                self.assertEqual(response.status_code, 502)

    async def test_malformed_saved_drug_rows_return_502_before_public_or_model_call(self):
        for rows in ([{}], [{"drug_name": " ", "product_code": None}], [{"drug_name": 123, "product_code": None}]):
            with self.subTest(rows=rows):
                state, normal = self.fixture(2)
                state["token"] = self.token()

                def upstream(request):
                    if request.url.path == "/rest/v1/saved_drugs":
                        return httpx.Response(200, json=rows)
                    return normal(request)

                response = await self.request(
                    "POST", self.message_path(), token=state["token"], upstream=upstream, json={"content": "질문"},
                )
                self.assertEqual(response.status_code, 502)
                self.assertFalse(state["checks"])
                self.assertFalse(state["gemini"])
                self.assertFalse(state["posted"])

    async def test_invalid_insert_representations_are_not_reported_as_success(self):
        mutations = (
            lambda rows: [], lambda rows: rows[:1], lambda rows: [rows[0], rows[0]],
            lambda rows: [rows[0], {**rows[1], "content": "변조된 응답"}],
            lambda rows: [rows[0], {**rows[1], "session_id": str(uuid4())}],
            lambda rows: [rows[0], {**rows[1], "role": "user"}],
            lambda rows: [{}],
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(mutation=index):
                state, normal = self.fixture()
                state["token"] = self.token()

                def upstream(request):
                    if request.url.path == "/rest/v1/chat_messages" and request.method == "POST":
                        return httpx.Response(201, json=mutate(json.loads(request.content)))
                    return normal(request)

                response = await self.request(
                    "POST", self.message_path(), token=state["token"], upstream=upstream, json={"content": "질문"},
                )
                self.assertEqual(response.status_code, 502)

    async def test_chat_routes_do_not_add_auth_to_existing_public_routes(self):
        with patch(
            "app.services.interactions.get_interactions_by_item_name", new_callable=AsyncMock, return_value=[],
        ) as fetch:
            root = await self.request("GET", "/")
            health = await self.request("GET", "/health")
            checked = await self.request("GET", "/drugs/check", params={"drug1": "가상약A", "drug2": "가상약B"})
        self.assertEqual([root.status_code, health.status_code, checked.status_code], [200, 200, 200])
        fetch.assert_awaited_once_with("가상약A")


if __name__ == "__main__":
    unittest.main()
