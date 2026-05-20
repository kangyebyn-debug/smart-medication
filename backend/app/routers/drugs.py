from fastapi import APIRouter, Query, HTTPException
from app.services.public_api import search_drug_by_name, get_interactions_by_item_name

router = APIRouter(prefix="/drugs", tags=["drugs"])


@router.get("/search")
async def search_drug(
    name: str = Query(..., description="약품명 (예: 탁센레이디)"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """상표명으로 약품을 검색합니다."""
    results = await search_drug_by_name(name, page, size)
    return {"query": name, "count": len(results), "items": results}


@router.get("/interaction")
async def get_interaction(
    name: str = Query(..., description="약품명 (예: 탁센레이디)"),
):
    """약품명으로 병용금기 목록을 조회합니다."""
    results = await get_interactions_by_item_name(name)
    if not results:
        return {"query": name, "count": 0, "items": [], "message": "병용금기 약물이 없습니다."}
    return {"query": name, "count": len(results), "items": results}


@router.get("/check")
async def check_interaction(
    drug1: str = Query(..., description="첫 번째 약품명 (예: 탁센레이디)"),
    drug2: str = Query(..., description="두 번째 약품명 (예: 케라신주)"),
):
    """두 약품의 병용금기 여부를 확인합니다."""
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
