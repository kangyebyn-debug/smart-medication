import asyncio
from fastapi import APIRouter, HTTPException, Query
from app.services.public_api import (
    search_drug_by_name,
    get_interactions_by_item_name,
    get_pregnancy_warnings,
    get_elderly_warnings,
    get_age_warnings,
    get_easy_drug_info,
    get_permit_drug_info,
    permit_document_text,
)

router = APIRouter(prefix="/drugs", tags=["drugs"])


async def _warning_result(coro):
    try:
        return await coro, "ok"
    except Exception:
        return [], "error"


def _text_or_empty(value):
    return value.strip() if isinstance(value, str) else ""


@router.get("/search")
async def search_drug(
    name: str = Query(...),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    results = await search_drug_by_name(name, page, size)
    return {"query": name, "count": len(results), "items": results}


@router.get("/image")
async def get_drug_image(name: str = Query(...), item_seq: str | None = None):
    """e약은요 API에서 이미지 URL·전문/일반 구분만 빠르게 반환."""
    info = await get_easy_drug_info(name, item_seq=item_seq)
    d = info if isinstance(info, dict) else {}
    return {
        "imageUrl":    d.get("itemImage", ""),
        "classNoName": d.get("classNoName", ""),
    }


@router.get("/warnings")
async def get_all_warnings(name: str = Query(...), item_seq: str | None = None):
    """약품의 모든 금기 정보 + 이미지 URL을 한 번에 반환."""
    (interaction, interaction_status), (pregnancy, pregnancy_status), (
        elderly, elderly_status
    ), (age, age_status), easy = await asyncio.gather(
        _warning_result(get_interactions_by_item_name(name)),
        _warning_result(get_pregnancy_warnings(name)),
        _warning_result(get_elderly_warnings(name)),
        _warning_result(get_age_warnings(name)),
        get_easy_drug_info(name, item_seq=item_seq),
    )
    info = easy if isinstance(easy, dict) else {}
    efficacy = _text_or_empty(info.get("efcyQesitm"))
    usage = _text_or_empty(info.get("useMethodQesitm"))
    efficacy_source = "easy_drug" if efficacy else None
    usage_source = "easy_drug" if usage else None

    if item_seq and (not efficacy or not usage):
        permit = await get_permit_drug_info(item_seq)
        if not efficacy:
            efficacy = permit_document_text(permit.get("EE_DOC_DATA"))
            if efficacy:
                efficacy_source = "permit"
        if not usage:
            usage = permit_document_text(permit.get("UD_DOC_DATA"))
            if usage:
                usage_source = "permit"

    return {
        "name": name,
        "imageUrl": info.get("itemImage", ""),
        "efficacy": efficacy,
        "usage": usage,
        "efficacySource": efficacy_source,
        "usageSource": usage_source,
        "classNoName": info.get("classNoName", ""),
        "interaction": interaction,
        "pregnancy": pregnancy,
        "elderly": elderly,
        "age": age,
        "warningStatus": {
            "interaction": interaction_status,
            "pregnancy": pregnancy_status,
            "elderly": elderly_status,
            "age": age_status,
        },
    }


@router.get("/check")
async def check_interaction(
    drug1: str = Query(...),
    drug2: str = Query(...),
):
    try:
        interactions = await get_interactions_by_item_name(drug1)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="공공 의약품 정보 조회에 실패했습니다.",
        ) from None
    if not interactions:
        return {
            "drug1": drug1,
            "drug2": drug2,
            "is_prohibited": False,
            "message": f"'{drug1}'의 병용금기 정보가 없습니다.",
        }
    prohibited_names = [i.get("MIXTURE_ITEM_NAME", "") for i in interactions]
    is_prohibited = any(drug2 in name for name in prohibited_names)
    return {
        "drug1": drug1,
        "drug2": drug2,
        "is_prohibited": is_prohibited,
        "interactions": interactions if is_prohibited else [],
        "all_prohibited": prohibited_names,
    }
