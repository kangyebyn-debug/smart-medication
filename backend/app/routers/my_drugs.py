from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from app.auth import CurrentUser, get_current_user
from app.services.saved_drugs import request_saved_drugs


router = APIRouter(prefix="/me/drugs", tags=["my drugs"])


class SavedDrugCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    drug_name: str
    product_code: str | None = None

    @field_validator("drug_name")
    @classmethod
    def require_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("약품명을 입력해주세요.")
        return value

    @field_validator("product_code")
    @classmethod
    def normalize_product_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class SavedDrug(BaseModel):
    id: UUID
    drug_name: str
    product_code: str | None
    created_at: datetime


def _parse_rows(rows: list[dict]) -> list[SavedDrug]:
    try:
        return [SavedDrug.model_validate(row) for row in rows]
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="나의 약 저장소 응답을 확인할 수 없습니다.") from exc


@router.get("", response_model=list[SavedDrug])
async def list_my_drugs(user: CurrentUser = Depends(get_current_user)):
    rows = await request_saved_drugs(
        "GET",
        user,
        params={
            "select": "id,drug_name,product_code,created_at",
            "user_id": f"eq.{user.id}",
            "order": "created_at.desc,id.desc",
        },
    )
    return _parse_rows(rows)


@router.post("", response_model=SavedDrug, status_code=201)
async def add_my_drug(drug: SavedDrugCreate, user: CurrentUser = Depends(get_current_user)):
    rows = await request_saved_drugs(
        "POST",
        user,
        body={
            "user_id": str(user.id),
            "drug_name": drug.drug_name,
            "product_code": drug.product_code,
        },
        return_rows=True,
    )
    parsed = _parse_rows(rows)
    if len(parsed) != 1:
        raise HTTPException(status_code=502, detail="나의 약 저장소 응답을 확인할 수 없습니다.")
    return parsed[0]


@router.delete("/{drug_id}", status_code=204)
async def remove_my_drug(drug_id: UUID, user: CurrentUser = Depends(get_current_user)):
    rows = await request_saved_drugs(
        "DELETE",
        user,
        params={
            "id": f"eq.{drug_id}",
            "user_id": f"eq.{user.id}",
            "select": "id",
        },
        return_rows=True,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="저장된 약을 찾을 수 없습니다.")
    return Response(status_code=204)
