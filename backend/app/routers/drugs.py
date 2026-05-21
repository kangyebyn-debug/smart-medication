import asyncio
from fastapi import APIRouter, Query
from app.services.public_api import (
    search_drug_by_name,
    get_interactions_by_item_name,
    get_pregnancy_warnings,
    get_elderly_warnings,
    get_age_warnings,
    get_easy_drug_info,
)

router = APIRouter(prefix="/drugs", tags=["drugs"])


async def _safe(coro):
    try:
        return await coro
    except Exception:
        return []


@router.get("/search")
async def search_drug(
    name: str = Query(...),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    results = await search_drug_by_name(name, page, size)
    return {"query": name, "count": len(results), "items": results}


@router.get("/image")
async def get_drug_image(name: str = Query(...)):
    """e약은요 API에서 이미지 URL·전문/일반 구분만 빠르게 반환."""
    info = await get_easy_drug_info(name)
    d = info if isinstance(info, dict) else {}
    return {
        "imageUrl":    d.get("itemImage", ""),
        "classNoName": d.get("classNoName", ""),
    }


@router.get("/warnings")
async def get_all_warnings(name: str = Query(...)):
    """약품의 모든 금기 정보 + 이미지 URL을 한 번에 반환."""
    interaction, pregnancy, elderly, age, easy = await asyncio.gather(
        _safe(get_interactions_by_item_name(name)),
        _safe(get_pregnancy_warnings(name)),
        _safe(get_elderly_warnings(name)),
        _safe(get_age_warnings(name)),
        get_easy_drug_info(name),
    )
    info = easy if isinstance(easy, dict) else {}
    return {
        "name": name,
        "imageUrl": info.get("itemImage", ""),
        "efficacy": info.get("efcyQesitm", ""),
        "classNoName": info.get("classNoName", ""),
        "interaction": interaction,
        "pregnancy": pregnancy,
        "elderly": elderly,
        "age": age,
    }


@router.get("/check")
async def check_interaction(
    drug1: str = Query(...),
    drug2: str = Query(...),
):
    interactions = await get_interactions_by_item_name(drug1)
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
