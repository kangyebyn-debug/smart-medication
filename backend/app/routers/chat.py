from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from app.auth import CurrentUser, get_current_user
from app.services.chat_evidence import INSUFFICIENT_DRUGS_REPLY, collect_chat_evidence
from app.services.chat_store import list_chat_rows, request_chat
from app.services.gemini_chat import generate_grounded_reply


router = APIRouter(prefix="/chat", tags=["chat"])
SESSION_FIELDS = "id,title,created_at"
MESSAGE_FIELDS = "id,session_id,role,content,created_at"


class ChatSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ChatSession(BaseModel):
    id: UUID
    title: str | None
    created_at: datetime


class ChatMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str

    @field_validator("content")
    @classmethod
    def require_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("질문을 입력해주세요.")
        return value


class ChatMessage(BaseModel):
    id: UUID
    session_id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


def _parse_rows(model, rows: list[dict]):
    try:
        return [model.model_validate(row) for row in rows]
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="대화 저장소 응답을 확인할 수 없습니다.") from exc


async def _require_session(session_id: UUID, user: CurrentUser) -> ChatSession:
    rows = await request_chat(
        "chat_sessions", "GET", user,
        params={
            "select": SESSION_FIELDS,
            "id": f"eq.{session_id}",
            "user_id": f"eq.{user.id}",
        },
    )
    if not rows:
        # 타인 소유와 실제 부재를 구별해 노출하지 않는다.
        raise HTTPException(status_code=404, detail="대화 세션을 찾을 수 없습니다.")
    sessions = _parse_rows(ChatSession, rows)
    if len(sessions) != 1 or sessions[0].id != session_id:
        raise HTTPException(status_code=502, detail="대화 저장소 응답을 확인할 수 없습니다.")
    return sessions[0]


@router.post("/sessions", response_model=ChatSession, status_code=201)
async def create_session(
    session: ChatSessionCreate = ChatSessionCreate(),
    user: CurrentUser = Depends(get_current_user),
):
    rows = await request_chat(
        "chat_sessions", "POST", user,
        params={"select": SESSION_FIELDS},
        body={"id": str(uuid4()), "user_id": str(user.id), "title": session.title},
        return_rows=True,
    )
    sessions = _parse_rows(ChatSession, rows)
    if len(sessions) != 1:
        raise HTTPException(status_code=502, detail="대화 저장소 응답을 확인할 수 없습니다.")
    return sessions[0]


@router.get("/sessions", response_model=list[ChatSession])
async def list_sessions(user: CurrentUser = Depends(get_current_user)):
    rows = await list_chat_rows(
        "chat_sessions", user,
        params={
            "select": SESSION_FIELDS,
            "user_id": f"eq.{user.id}",
            "order": "created_at.desc,id.desc",
        },
    )
    return _parse_rows(ChatSession, rows)


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessage])
async def list_messages(session_id: UUID, user: CurrentUser = Depends(get_current_user)):
    await _require_session(session_id, user)
    rows = await list_chat_rows(
        "chat_messages", user,
        params={
            "select": MESSAGE_FIELDS,
            "session_id": f"eq.{session_id}",
            "order": "created_at.asc,id.asc",
        },
    )
    messages = _parse_rows(ChatMessage, rows)
    if any(message.session_id != session_id for message in messages):
        raise HTTPException(status_code=502, detail="대화 저장소 응답을 확인할 수 없습니다.")
    return messages


@router.post("/sessions/{session_id}/messages", response_model=ChatMessage, status_code=201)
async def send_message(
    session_id: UUID,
    message: ChatMessageCreate,
    user: CurrentUser = Depends(get_current_user),
):
    await _require_session(session_id, user)
    user_time = datetime.now(timezone.utc)
    evidence = await collect_chat_evidence(user)
    if not evidence["pairs"]:
        # 조합이 없으면 모델에 의학적 추측 기회조차 주지 않고 안내한다.
        answer = INSUFFICIENT_DRUGS_REPLY
    else:
        answer = await generate_grounded_reply(message.content, evidence)

    # 생성 실패 시 반쪽 대화를 남기지 않는다. 두 행을 한 INSERT 트랜잭션으로 저장한다.
    assistant_time = max(datetime.now(timezone.utc), user_time + timedelta(microseconds=1))
    user_id, assistant_id = uuid4(), uuid4()
    body = [
        {"id": str(user_id), "session_id": str(session_id), "role": "user",
         "content": message.content, "created_at": user_time.isoformat()},
        {"id": str(assistant_id), "session_id": str(session_id), "role": "assistant",
         "content": answer, "created_at": assistant_time.isoformat()},
    ]
    rows = await request_chat(
        "chat_messages", "POST", user,
        params={"select": MESSAGE_FIELDS}, body=body, return_rows=True,
    )
    saved = _parse_rows(ChatMessage, rows)
    expected = {UUID(row["id"]): row for row in body}
    if len(saved) != 2 or {row.id for row in saved} != set(expected):
        raise HTTPException(status_code=502, detail="대화 저장소 응답을 확인할 수 없습니다.")
    for row in saved:
        original = expected[row.id]
        if row.session_id != session_id or row.role != original["role"] or row.content != original["content"]:
            raise HTTPException(status_code=502, detail="대화 저장소 응답을 확인할 수 없습니다.")
    return next(row for row in saved if row.id == assistant_id)
