import json
import secrets
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


class MyDrugsTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.user_id = uuid4()
        cls.drug_id = uuid4()
        cls.key_id = "test-ec-key"
        cls.private_key = ec.generate_private_key(ec.SECP256R1())
        cls.public_jwk = ECAlgorithm.to_jwk(cls.private_key.public_key(), as_dict=True)
        cls.public_jwk["kid"] = cls.key_id
        cls.public_jwk["alg"] = "ES256"
        cls.public_jwk["use"] = "sig"

    def setUp(self):
        # The real verification path reads an offline JWKS containing only a
        # generated public key. No Supabase key, token, or network call is used.
        jwks = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
        for patcher in (
            patch.object(jwks, "fetch_data", return_value={"keys": [self.public_jwk]}),
            patch("app.auth.jwks_client", return_value=jwks),
            patch("app.auth.SUPABASE_URL", SUPABASE_URL),
            patch("app.services.saved_drugs.SUPABASE_URL", SUPABASE_URL),
            patch("app.services.saved_drugs.SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY),
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

    async def request(self, method, path, *, token=None, upstream=None, **kwargs):
        headers = kwargs.pop("headers", {})
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"

        if upstream is None:
            async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                return await client.request(method, path, headers=headers, **kwargs)

        def make_upstream_client(**_kwargs):
            return AsyncClient(transport=httpx.MockTransport(upstream))

        with patch("app.services.saved_drugs.httpx.AsyncClient", side_effect=make_upstream_client):
            async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                return await client.request(method, path, headers=headers, **kwargs)

    def saved_row(self):
        return {
            "id": str(self.drug_id),
            "drug_name": "테스트 약",
            "product_code": "12345",
            "created_at": "2026-11-20T00:00:00Z",
        }

    def assert_user_headers(self, request, token):
        self.assertEqual(request.url.path, "/rest/v1/saved_drugs")
        self.assertEqual(request.headers["apikey"], PUBLISHABLE_KEY)
        self.assertEqual(request.headers["authorization"], f"Bearer {token}")

    async def test_protected_routes_require_bearer_token(self):
        with patch("app.routers.my_drugs.request_saved_drugs", new_callable=AsyncMock) as upstream:
            for method, path, kwargs in (
                ("GET", "/me/drugs", {}),
                ("POST", "/me/drugs", {"json": {"drug_name": "테스트 약"}}),
                ("DELETE", f"/me/drugs/{self.drug_id}", {}),
            ):
                with self.subTest(method=method):
                    response = await self.request(method, path, **kwargs)
                    self.assertEqual(response.status_code, 401)
                    self.assertEqual(response.headers["www-authenticate"], "Bearer")
            upstream.assert_not_awaited()

    async def test_rejects_invalid_jwt_claims_signature_and_algorithm(self):
        other_key = ec.generate_private_key(ec.SECP256R1())
        signed_by_other_key = jwt.encode(
            {
                "sub": str(self.user_id),
                "role": "authenticated",
                "aud": "authenticated",
                "iss": f"{SUPABASE_URL}/auth/v1",
                "exp": int(time.time()) + 3600,
            },
            other_key,
            algorithm="ES256",
            headers={"kid": self.key_id},
        )
        hs256_token = jwt.encode(
            {"sub": str(self.user_id), "exp": int(time.time()) + 3600},
            secrets.token_bytes(32),
            algorithm="HS256",
            headers={"kid": self.key_id},
        )
        rejected = {
            "malformed": "not-a-jwt",
            "expired": self.token(exp=int(time.time()) - 60),
            "HS256": hs256_token,
            "wrong issuer": self.token(iss="https://other-project.supabase.co/auth/v1"),
            "wrong audience": self.token(aud="anon"),
            "wrong signature": signed_by_other_key,
            "wrong role": self.token(role="anon"),
            "invalid user ID": self.token(sub="not-a-uuid"),
        }
        with patch("app.routers.my_drugs.request_saved_drugs", new_callable=AsyncMock) as upstream:
            for reason, token in rejected.items():
                with self.subTest(reason=reason):
                    response = await self.request("GET", "/me/drugs", token=token)
                    self.assertEqual(response.status_code, 401)
                    self.assertEqual(response.headers["www-authenticate"], "Bearer")
            upstream.assert_not_awaited()

    async def test_get_uses_verified_user_token_and_user_filter(self):
        token = self.token()
        requests = []

        def upstream(request):
            requests.append(request)
            return httpx.Response(200, json=[self.saved_row()])

        response = await self.request("GET", "/me/drugs", token=token, upstream=upstream)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [self.saved_row()])
        self.assertEqual(len(requests), 1)
        request = requests[0]
        self.assertEqual(request.method, "GET")
        self.assert_user_headers(request, token)
        self.assertEqual(request.url.params["user_id"], f"eq.{self.user_id}")
        self.assertEqual(request.url.params["select"], "id,drug_name,product_code,created_at")
        self.assertEqual(request.url.params["order"], "created_at.desc,id.desc")

    async def test_post_sets_user_id_from_verified_jwt(self):
        token = self.token()
        requests = []

        def upstream(request):
            requests.append(request)
            return httpx.Response(201, json=[self.saved_row()])

        response = await self.request(
            "POST",
            "/me/drugs",
            token=token,
            upstream=upstream,
            json={"drug_name": "  테스트 약  ", "product_code": " 12345 "},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), self.saved_row())
        self.assertEqual(len(requests), 1)
        request = requests[0]
        self.assertEqual(request.method, "POST")
        self.assert_user_headers(request, token)
        self.assertEqual(request.headers["prefer"], "return=representation")
        self.assertEqual(json.loads(request.content), {
            "user_id": str(self.user_id),
            "drug_name": "테스트 약",
            "product_code": "12345",
        })

    async def test_post_rejects_client_supplied_user_id(self):
        token = self.token()
        with patch("app.routers.my_drugs.request_saved_drugs", new_callable=AsyncMock) as upstream:
            response = await self.request(
                "POST", "/me/drugs", token=token,
                json={"drug_name": "테스트 약", "user_id": str(uuid4())},
            )
            self.assertEqual(response.status_code, 422)
            upstream.assert_not_awaited()

    async def test_delete_filters_by_user_and_returns_204_for_own_drug(self):
        token = self.token()
        requests = []

        def upstream(request):
            requests.append(request)
            return httpx.Response(200, json=[{"id": str(self.drug_id)}])

        response = await self.request("DELETE", f"/me/drugs/{self.drug_id}", token=token, upstream=upstream)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(requests), 1)
        request = requests[0]
        self.assertEqual(request.method, "DELETE")
        self.assert_user_headers(request, token)
        self.assertEqual(request.headers["prefer"], "return=representation")
        self.assertEqual(request.url.params["id"], f"eq.{self.drug_id}")
        self.assertEqual(request.url.params["user_id"], f"eq.{self.user_id}")

    async def test_delete_missing_or_other_users_drug_returns_404(self):
        token = self.token()

        def upstream(_request):
            # RLS hides another user's row just like a missing row.
            return httpx.Response(200, json=[])

        response = await self.request("DELETE", f"/me/drugs/{self.drug_id}", token=token, upstream=upstream)
        self.assertEqual(response.status_code, 404)

    async def test_upstream_failure_returns_generic_502(self):
        token = self.token()

        def upstream(_request):
            return httpx.Response(500, json={"message": "private database detail"})

        response = await self.request("GET", "/me/drugs", token=token, upstream=upstream)
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("private database detail", response.text)

    async def test_upstream_auth_failures_preserve_401_or_403_without_details(self):
        token = self.token()

        for status in (401, 403):
            with self.subTest(status=status):
                def upstream(_request):
                    return httpx.Response(status, json={"message": "private database detail"})

                response = await self.request("GET", "/me/drugs", token=token, upstream=upstream)
                self.assertEqual(response.status_code, status)
                self.assertNotIn("private database detail", response.text)
                self.assertIsInstance(response.json()["detail"], str)
                self.assertTrue(response.json()["detail"])
                if status == 401:
                    self.assertEqual(response.headers["www-authenticate"], "Bearer")

    async def test_public_health_remains_available_without_token(self):
        response = await self.request("GET", "/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
