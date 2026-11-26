from typing import Literal

import httpx
from fastapi import HTTPException

from app.auth import CurrentUser
from app.config import SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


ChatTable = Literal["chat_sessions", "chat_messages"]


async def request_chat(
    table: ChatTable,
    method: str,
    user: CurrentUser,
    *,
    params: dict[str, str] | None = None,
    body: dict | list[dict] | None = None,
    return_rows: bool = False,
) -> list[dict]:
    if table not in ("chat_sessions", "chat_messages"):
        raise ValueError("지원하지 않는 대화 저장소 테이블입니다.")
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=503, detail="대화 저장소 설정을 확인할 수 없습니다.")

    # 기존 profile/saved_drugs와 동일하게 사용자 JWT로 RLS를 유지한다.
    # 관리자 키는 사용하지 않으며 테이블 이름도 위 두 개로 제한한다.
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
                f"{SUPABASE_URL}/rest/v1/{table}",
                headers=headers,
                params=params,
                json=body,
            )
        response.raise_for_status()
        # PostgREST의 기본 INSERT 응답은 본문 없는 return=minimal이다.
        if method.upper() == "POST" and not response.content and not return_rows:
            return []
        rows = response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="로그인이 필요하거나 인증이 만료되었습니다.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        if exc.response.status_code == 403:
            raise HTTPException(status_code=403, detail="대화 저장소 접근 권한이 없습니다.") from exc
        raise HTTPException(status_code=502, detail="대화 저장소 요청에 실패했습니다.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="대화 저장소 요청에 실패했습니다.") from exc

    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise HTTPException(status_code=502, detail="대화 저장소 응답을 확인할 수 없습니다.")
    return rows


async def list_chat_rows(
    table: ChatTable,
    user: CurrentUser,
    *,
    params: dict[str, str],
) -> list[dict]:
    rows = []
    offset = 0
    while True:
        page = await request_chat(
            table,
            "GET",
            user,
            params={**params, "limit": "100", "offset": str(offset)},
        )
        if not page:
            return rows
        rows.extend(page)
        # Supabase의 행 수 상한이 100보다 작을 수도 있다. 짧은 페이지를
        # 마지막으로 추정하지 않고 실제 받은 수만큼 옮겨 빈 페이지까지 읽는다.
        offset += len(page)
