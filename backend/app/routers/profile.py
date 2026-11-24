from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from app.auth import CurrentUser, get_current_user
from app.services.profile import request_profile


router = APIRouter(prefix="/me/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class Profile(BaseModel):
    display_name: str | None


def _parse_profile(rows: list[dict]) -> Profile:
    if not rows:
        # RLS로 보이지 않는 행을 표시 이름이 null인 정상 프로필과 구분한다.
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다.")
    if len(rows) != 1:
        raise HTTPException(status_code=502, detail="프로필 저장소 응답을 확인할 수 없습니다.")
    try:
        return Profile.model_validate(rows[0])
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="프로필 저장소 응답을 확인할 수 없습니다.") from exc


@router.get("", response_model=Profile)
async def get_my_profile(user: CurrentUser = Depends(get_current_user)):
    rows = await request_profile(
        "GET",
        user,
        params={"select": "display_name", "id": f"eq.{user.id}"},
    )
    return _parse_profile(rows)


@router.patch("", response_model=Profile)
async def update_my_profile(profile: ProfileUpdate, user: CurrentUser = Depends(get_current_user)):
    rows = await request_profile(
        "PATCH",
        user,
        params={"select": "display_name", "id": f"eq.{user.id}"},
        body={"display_name": profile.display_name},
        return_rows=True,
    )
    return _parse_profile(rows)
