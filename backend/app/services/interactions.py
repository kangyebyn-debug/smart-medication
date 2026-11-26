from fastapi import HTTPException

from app.services.public_api import get_interactions_by_item_name


async def check_interaction(drug1: str, drug2: str):
    """공개 병용금기 API와 채팅이 같은 조회·판정 로직을 재사용한다."""
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
