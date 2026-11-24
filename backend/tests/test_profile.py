import json
import time
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWKClient
from jwt.algorithms import ECAlgorithm

from app.main import app


SUPABASE_URL = "https://test-project.supabase.co"
PUBLISHABLE_KEY = "sb_publishable_test_only"
AsyncClient = httpx.AsyncClient


class ProfileTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.user_id = uuid4()
        cls.key_id = "test-profile-ec-key"
        cls.private_key = ec.generate_private_key(ec.SECP256R1())
        cls.public_jwk = ECAlgorithm.to_jwk(cls.private_key.public_key(), as_dict=True)
        cls.public_jwk.update(kid=cls.key_id, alg="ES256", use="sig")

    def setUp(self):
        # Generated keys and offline JWKS exercise the shared JWT dependency.
        # No real account, Supabase token, or database is used by these tests.
        jwks = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
        for patcher in (
            patch.object(jwks, "fetch_data", return_value={"keys": [self.public_jwk]}),
            patch("app.auth.jwks_client", return_value=jwks),
            patch("app.auth.SUPABASE_URL", SUPABASE_URL),
            patch("app.services.profile.SUPABASE_URL", SUPABASE_URL),
            patch("app.services.profile.SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def token(self, **claim_changes):
        claims = {
            "sub": str(self.user_id),
            "role": "authenticated",
            "aud": "authenticated",
            "iss": f"{SUPABASE_URL}/auth/v1",
            "exp": int(time.time()) + 3600,
        }
        claims.update(claim_changes)
        return jwt.encode(
            claims,
            self.private_key,
            algorithm="ES256",
            headers={"kid": self.key_id},
        )

    async def request(self, method, *, token=None, upstream=None, **kwargs):
        headers = {}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"

        if upstream is None:
            async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                return await client.request(method, "/me/profile", headers=headers, **kwargs)

        def make_upstream_client(**_kwargs):
            return AsyncClient(transport=httpx.MockTransport(upstream))

        with patch("app.services.profile.httpx.AsyncClient", side_effect=make_upstream_client):
            async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                return await client.request(method, "/me/profile", headers=headers, **kwargs)

    def assert_user_request(self, request, token):
        self.assertEqual(request.url.path, "/rest/v1/profiles")
        self.assertEqual(request.headers["apikey"], PUBLISHABLE_KEY)
        self.assertEqual(request.headers["authorization"], f"Bearer {token}")
        self.assertEqual(request.url.params["id"], f"eq.{self.user_id}")
        self.assertEqual(request.url.params["select"], "display_name")

    async def test_routes_require_bearer_token(self):
        with patch("app.routers.profile.request_profile", new_callable=AsyncMock) as upstream:
            for method, kwargs in (("GET", {}), ("PATCH", {"json": {"display_name": "이름"}})):
                with self.subTest(method=method):
                    response = await self.request(method, **kwargs)
                    self.assertEqual(response.status_code, 401)
                    self.assertEqual(response.headers["www-authenticate"], "Bearer")
            upstream.assert_not_awaited()

    async def test_invalid_or_expired_token_does_not_reach_storage(self):
        with patch("app.routers.profile.request_profile", new_callable=AsyncMock) as upstream:
            for token in ("not-a-jwt", self.token(exp=int(time.time()) - 60)):
                with self.subTest(token_kind="malformed" if token == "not-a-jwt" else "expired"):
                    response = await self.request("GET", token=token)
                    self.assertEqual(response.status_code, 401)
            upstream.assert_not_awaited()

    async def test_get_uses_verified_user_token_and_own_id_filter(self):
        token = self.token()
        requests = []

        def upstream(request):
            requests.append(request)
            return httpx.Response(200, json=[{"display_name": "표시 이름"}])

        response = await self.request("GET", token=token, upstream=upstream)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"display_name": "표시 이름"})
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0].method, "GET")
        self.assert_user_request(requests[0], token)

    async def test_get_null_name_is_not_a_missing_profile(self):
        response = await self.request(
            "GET", token=self.token(),
            upstream=lambda _request: httpx.Response(200, json=[{"display_name": None}]),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"display_name": None})

    async def test_patch_updates_only_own_display_name_and_returns_saved_value(self):
        token = self.token()
        requests = []

        def upstream(request):
            requests.append(request)
            return httpx.Response(200, json=[{"display_name": "새 이름"}])

        response = await self.request(
            "PATCH", token=token, upstream=upstream,
            json={"display_name": "  새 이름  "},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"display_name": "새 이름"})
        self.assertEqual(len(requests), 1)
        request = requests[0]
        self.assertEqual(request.method, "PATCH")
        self.assert_user_request(request, token)
        self.assertEqual(request.headers["prefer"], "return=representation")
        self.assertEqual(json.loads(request.content), {"display_name": "새 이름"})

    async def test_patch_normalizes_empty_whitespace_and_null_to_null(self):
        for name in ("", " \t\n ", None):
            with self.subTest(name=name):
                def upstream(request):
                    self.assertEqual(json.loads(request.content), {"display_name": None})
                    return httpx.Response(200, json=[{"display_name": None}])

                response = await self.request(
                    "PATCH", token=self.token(), upstream=upstream,
                    json={"display_name": name},
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {"display_name": None})

    async def test_patch_requires_name_and_rejects_other_fields_or_non_string_values(self):
        invalid_bodies = (
            {}, {"display_name": 123}, {"display_name": []},
            {"display_name": "이름", "id": str(uuid4())},
            {"display_name": "이름", "email": "not-used@example.test"},
        )
        with patch("app.routers.profile.request_profile", new_callable=AsyncMock) as upstream:
            for body in invalid_bodies:
                with self.subTest(body=body):
                    response = await self.request("PATCH", token=self.token(), json=body)
                    self.assertEqual(response.status_code, 422)
            upstream.assert_not_awaited()

    async def test_patch_has_no_unrequested_name_length_limit(self):
        name = "긴이름" * 1000

        def upstream(request):
            self.assertEqual(json.loads(request.content), {"display_name": name})
            return httpx.Response(200, json=[{"display_name": name}])

        response = await self.request(
            "PATCH", token=self.token(), upstream=upstream,
            json={"display_name": name},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"display_name": name})

    async def test_missing_or_rls_hidden_profile_returns_404_for_get_and_patch(self):
        for method, kwargs in (("GET", {}), ("PATCH", {"json": {"display_name": "이름"}})):
            with self.subTest(method=method):
                response = await self.request(
                    method, token=self.token(),
                    upstream=lambda _request: httpx.Response(200, json=[]), **kwargs,
                )
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json()["detail"], "프로필을 찾을 수 없습니다.")

    async def test_malformed_or_multiple_rows_return_502_for_get_and_patch(self):
        invalid_rows = (
            {}, None, [None], [{}], [{"display_name": 123}],
            [{"display_name": None}, {"display_name": "다른 행"}],
        )
        for method, kwargs in (("GET", {}), ("PATCH", {"json": {"display_name": "이름"}})):
            for rows in invalid_rows:
                with self.subTest(method=method, rows=rows):
                    response = await self.request(
                        method, token=self.token(),
                        upstream=lambda _request: httpx.Response(200, json=rows), **kwargs,
                    )
                    self.assertEqual(response.status_code, 502)

    async def test_upstream_auth_failures_preserve_status_without_private_details(self):
        for status in (401, 403):
            with self.subTest(status=status):
                response = await self.request(
                    "GET", token=self.token(),
                    upstream=lambda _request: httpx.Response(status, json={"message": "private database detail"}),
                )
                self.assertEqual(response.status_code, status)
                self.assertNotIn("private database detail", response.text)
                if status == 401:
                    self.assertEqual(response.headers["www-authenticate"], "Bearer")

    async def test_upstream_failure_returns_502_without_private_details(self):
        response = await self.request(
            "PATCH", token=self.token(), json={"display_name": "이름"},
            upstream=lambda _request: httpx.Response(500, json={"message": "private database detail"}),
        )
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("private database detail", response.text)

    async def test_network_failure_and_invalid_json_return_502(self):
        def network_failure(request):
            raise httpx.ConnectError("private network detail", request=request)

        for upstream in (network_failure, lambda _request: httpx.Response(200, text="not json")):
            with self.subTest(upstream=upstream):
                response = await self.request("GET", token=self.token(), upstream=upstream)
                self.assertEqual(response.status_code, 502)
                self.assertNotIn("private network detail", response.text)

    async def test_missing_storage_configuration_returns_503(self):
        for setting in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"):
            with self.subTest(setting=setting), patch(f"app.services.profile.{setting}", ""):
                with patch("app.services.profile.httpx.AsyncClient") as upstream:
                    response = await self.request("GET", token=self.token())
                    self.assertEqual(response.status_code, 503)
                    upstream.assert_not_called()


if __name__ == "__main__":
    unittest.main()
