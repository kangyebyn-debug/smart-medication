import httpx
from fastapi import HTTPException

from app.auth import CurrentUser
from app.config import SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


async def request_profile(
    method: str,
    user: CurrentUser,
    *,
    params: dict[str, str] | None = None,
    body: dict | None = None,
    return_rows: bool = False,
) -> list[dict]:
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=503, detail="프로필 저장소 설정을 확인할 수 없습니다.")

    # saved_drugs와 같이 사용자 JWT로 RLS의 auth.uid()를 유지한다.
    # Publishable key만 사용하며 관리자 키로 본인 행 정책을 우회하지 않는다.
    headers = {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {user.access_token}",
        "Accept": "application/json",
    }
    if return_rows:
        headers["Prefer"] = "return=representation"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.request(
                method,
                f"{SUPABASE_URL}/rest/v1/profiles",
                headers=headers,
                params=params,
                json=body,
            )
        response.raise_for_status()
        rows = response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="로그인이 필요하거나 인증이 만료되었습니다.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        if exc.response.status_code == 403:
            raise HTTPException(status_code=403, detail="프로필 저장소 접근 권한이 없습니다.") from exc
        raise HTTPException(status_code=502, detail="프로필 저장소 요청에 실패했습니다.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="프로필 저장소 요청에 실패했습니다.") from exc

    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise HTTPException(status_code=502, detail="프로필 저장소 응답을 확인할 수 없습니다.")
    return rows
