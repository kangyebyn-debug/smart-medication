import json
import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx
from fastapi import HTTPException

from app.auth import CurrentUser
from app.services.chat_store import list_chat_rows, request_chat


SUPABASE_URL = "https://test-project.supabase.co"
PUBLISHABLE_KEY = "sb_publishable_test_only"
AsyncClient = httpx.AsyncClient


class ChatStoreTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.user = CurrentUser(id=uuid4(), access_token="test-user-jwt")
        for patcher in (
            patch("app.services.chat_store.SUPABASE_URL", SUPABASE_URL),
            patch("app.services.chat_store.SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def transport(self, upstream):
        def make_client(**kwargs):
            self.assertEqual(kwargs, {"timeout": 10})
            return AsyncClient(transport=httpx.MockTransport(upstream))

        return patch("app.services.chat_store.httpx.AsyncClient", side_effect=make_client)

    async def test_get_uses_publishable_key_user_jwt_and_selected_table(self):
        for table in ("chat_sessions", "chat_messages"):
            with self.subTest(table=table):
                requests = []

                def upstream(request):
                    requests.append(request)
                    return httpx.Response(200, json=[{"id": "row-id"}])

                with self.transport(upstream):
                    rows = await request_chat(
                        table, "GET", self.user,
                        params={"select": "id", "user_id": f"eq.{self.user.id}"},
                    )

                self.assertEqual(rows, [{"id": "row-id"}])
                self.assertEqual(len(requests), 1)
                request = requests[0]
                self.assertEqual(request.url.path, f"/rest/v1/{table}")
                self.assertEqual(request.method, "GET")
                self.assertEqual(request.headers["apikey"], PUBLISHABLE_KEY)
                self.assertEqual(request.headers["authorization"], f"Bearer {self.user.access_token}")
                self.assertEqual(request.headers["accept"], "application/json")
                self.assertNotIn("prefer", request.headers)
                self.assertEqual(request.url.params["select"], "id")
                self.assertEqual(request.url.params["user_id"], f"eq.{self.user.id}")

    async def test_table_allowlist_rejects_untrusted_table_without_network(self):
        with patch("app.services.chat_store.httpx.AsyncClient") as client:
            for table in ("profiles", "saved_drugs", "../profiles", "chat_sessions?select=*", ""):
                with self.subTest(table=table), self.assertRaises(ValueError):
                    await request_chat(table, "GET", self.user)
            client.assert_not_called()

    async def test_single_insert_requests_and_returns_representation(self):
        body = {"id": str(uuid4()), "user_id": str(self.user.id), "title": None}

        def upstream(request):
            self.assertEqual(request.method, "POST")
            self.assertEqual(request.headers["prefer"], "return=representation")
            self.assertEqual(json.loads(request.content), body)
            return httpx.Response(201, json=[body])

        with self.transport(upstream):
            rows = await request_chat("chat_sessions", "POST", self.user, body=body, return_rows=True)
        self.assertEqual(rows, [body])

    async def test_bulk_insert_keeps_both_messages_in_one_request(self):
        session_id = str(uuid4())
        body = [
            {"id": str(uuid4()), "session_id": session_id, "role": "user", "content": "질문"},
            {"id": str(uuid4()), "session_id": session_id, "role": "assistant", "content": "근거 설명"},
        ]
        requests = []

        def upstream(request):
            requests.append(request)
            self.assertEqual(request.url.path, "/rest/v1/chat_messages")
            self.assertEqual(request.method, "POST")
            self.assertEqual(json.loads(request.content), body)
            self.assertEqual(request.headers["prefer"], "return=representation")
            return httpx.Response(201, json=body)

        with self.transport(upstream):
            rows = await request_chat("chat_messages", "POST", self.user, body=body, return_rows=True)
        self.assertEqual(rows, body)
        self.assertEqual(len(requests), 1)

    async def test_minimal_insert_accepts_empty_response(self):
        for status in (201, 204):
            with self.subTest(status=status):
                def upstream(request):
                    self.assertNotIn("prefer", request.headers)
                    return httpx.Response(status)

                with self.transport(upstream):
                    rows = await request_chat("chat_messages", "POST", self.user, body=[])
                self.assertEqual(rows, [])

    async def test_required_representation_rejects_empty_response(self):
        with self.transport(lambda _request: httpx.Response(201)):
            with self.assertRaises(HTTPException) as raised:
                await request_chat("chat_sessions", "POST", self.user, body={}, return_rows=True)
        self.assertEqual(raised.exception.status_code, 502)

    async def test_upstream_auth_failures_preserve_status_without_private_details(self):
        for status in (401, 403):
            with self.subTest(status=status):
                with self.transport(lambda _request: httpx.Response(status, text="private database detail")):
                    with self.assertRaises(HTTPException) as raised:
                        await request_chat("chat_sessions", "GET", self.user)
                self.assertEqual(raised.exception.status_code, status)
                self.assertNotIn("private database detail", raised.exception.detail)
                if status == 401:
                    self.assertEqual(raised.exception.headers, {"WWW-Authenticate": "Bearer"})

    async def test_other_upstream_errors_are_sanitized_502(self):
        for status in (400, 404, 409, 429, 500, 503):
            with self.subTest(status=status):
                with self.transport(lambda _request: httpx.Response(status, text="private database detail")):
                    with self.assertRaises(HTTPException) as raised:
                        await request_chat("chat_messages", "GET", self.user)
                self.assertEqual(raised.exception.status_code, 502)
                self.assertNotIn("private database detail", raised.exception.detail)

    async def test_network_and_invalid_json_errors_are_sanitized_502(self):
        def network_failure(request):
            raise httpx.ConnectError("private network detail", request=request)

        for upstream in (network_failure, lambda _request: httpx.Response(200, text="not json")):
            with self.subTest(upstream=upstream), self.transport(upstream):
                with self.assertRaises(HTTPException) as raised:
                    await request_chat("chat_sessions", "GET", self.user)
                self.assertEqual(raised.exception.status_code, 502)
                self.assertNotIn("private", raised.exception.detail)

    async def test_malformed_rows_are_rejected(self):
        for rows in ({}, None, [None], ["row"], [{"id": "valid"}, 3]):
            with self.subTest(rows=rows), self.transport(lambda _request: httpx.Response(200, json=rows)):
                with self.assertRaises(HTTPException) as raised:
                    await request_chat("chat_sessions", "GET", self.user)
                self.assertEqual(raised.exception.status_code, 502)

    async def test_missing_configuration_is_503_without_network(self):
        for setting in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"):
            with self.subTest(setting=setting), patch(f"app.services.chat_store.{setting}", ""):
                with patch("app.services.chat_store.httpx.AsyncClient") as client:
                    with self.assertRaises(HTTPException) as raised:
                        await request_chat("chat_sessions", "GET", self.user)
                    self.assertEqual(raised.exception.status_code, 503)
                    client.assert_not_called()

    async def test_listing_reads_all_full_pages_then_empty_page(self):
        all_rows = [{"id": index} for index in range(201)]
        offsets = []
        params = {"select": "id", "user_id": f"eq.{self.user.id}", "order": "created_at.asc,id.asc"}

        def upstream(request):
            offset = int(request.url.params["offset"])
            offsets.append(offset)
            self.assertEqual(request.url.params["limit"], "100")
            self.assertEqual(request.url.params["user_id"], params["user_id"])
            self.assertEqual(request.url.params["order"], params["order"])
            return httpx.Response(200, json=all_rows[offset:offset + 100])

        original_params = dict(params)
        with self.transport(upstream):
            rows = await list_chat_rows("chat_sessions", self.user, params=params)

        self.assertEqual(rows, all_rows)
        self.assertEqual(offsets, [0, 100, 200, 201])
        self.assertEqual(params, original_params)

    async def test_listing_continues_short_pages_under_lower_supabase_row_cap(self):
        all_rows = [{"id": index} for index in range(5)]
        offsets = []

        def upstream(request):
            offset = int(request.url.params["offset"])
            offsets.append(offset)
            self.assertEqual(request.url.params["limit"], "100")
            # Pretend the server enforces a cap of two despite limit=100.
            return httpx.Response(200, json=all_rows[offset:offset + 2])

        with self.transport(upstream):
            rows = await list_chat_rows("chat_messages", self.user, params={"select": "id"})
        self.assertEqual(rows, all_rows)
        self.assertEqual(offsets, [0, 2, 4, 5])

    async def test_empty_listing_stops_after_one_request(self):
        requests = []

        def upstream(request):
            requests.append(request)
            return httpx.Response(200, json=[])

        with self.transport(upstream):
            rows = await list_chat_rows("chat_sessions", self.user, params={"select": "id"})
        self.assertEqual(rows, [])
        self.assertEqual(len(requests), 1)

    async def test_listing_does_not_return_partial_data_after_later_failure(self):
        def upstream(request):
            if request.url.params["offset"] == "0":
                return httpx.Response(200, json=[{"id": "first"}])
            return httpx.Response(403, text="private database detail")

        with self.transport(upstream):
            with self.assertRaises(HTTPException) as raised:
                await list_chat_rows("chat_messages", self.user, params={"select": "id"})
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
