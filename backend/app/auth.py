from dataclasses import dataclass, field
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from app.config import SUPABASE_URL


bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    access_token: str = field(repr=False)


@lru_cache(maxsize=1)
def jwks_client() -> PyJWKClient:
    return PyJWKClient(
        f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json",
        cache_jwk_set=True,
        lifespan=600,
        timeout=5,
    )


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="로그인이 필요하거나 인증이 만료되었습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise _unauthorized()
    if not SUPABASE_URL:
        raise HTTPException(status_code=503, detail="인증 설정을 확인할 수 없습니다.")

    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") != "ES256" or not header.get("kid"):
            raise ValueError("unsupported signing key")
        signing_key = jwks_client().get_signing_key_from_jwt(token)
        # 2026-11-20 프로젝트 JWT Keys 확인: Current=ECC P-256(ES256),
        # Previous=HS256(기존 토큰용). JWKS에 없는 HS256 토큰은 401로 거부한다.
        # https://supabase.com/docs/guides/auth/jwts#verifying-a-jwt-from-supabase
        # https://supabase.com/docs/guides/auth/signing-keys
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        user_id = UUID(claims["sub"])
        if claims.get("role") != "authenticated":
            raise ValueError("unexpected role")
    except PyJWKClientConnectionError as exc:
        raise HTTPException(status_code=503, detail="인증 서버에 연결할 수 없습니다.") from exc
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise _unauthorized() from exc

    return CurrentUser(id=user_id, access_token=token)
