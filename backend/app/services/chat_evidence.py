from itertools import combinations

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError, field_validator

from app.auth import CurrentUser
from app.services.interactions import check_interaction
from app.services.saved_drugs import request_saved_drugs


EVIDENCE_SCOPE = (
    "출처: 식약처 공공 DUR 병용금기 API. 등록된 약 전체 조합을 기존 /drugs/check의 "
    "품목명 기반 첫 페이지(최대 20건) 조회 범위에서 비교했습니다. "
    "품목코드로 정확히 식별한 결과나 전체 DUR 자료를 모두 조회한 결과는 아닙니다. "
    "금기 미발견은 개인의 복용 안전성을 확정하지 않습니다."
)
INSUFFICIENT_DRUGS_REPLY = (
    "등록된 약이 2개 미만이어서 병용금기를 비교할 조합이 없습니다. "
    "비교할 약을 나의 약에 추가한 뒤 다시 질문해주세요. "
    "현재 질문에 대한 복용 가능 여부는 추측하지 않습니다.\n\n"
    "이 안내는 의학적 진단이나 처방이 아니며, 개인의 복용 안전성을 확정하지 않습니다. "
    "실제 복용은 의사·약사와 상담해주세요."
)


class EvidenceDrug(BaseModel):
    drug_name: str
    product_code: str | None

    @field_validator("drug_name")
    @classmethod
    def require_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("empty drug name")
        return value


async def collect_chat_evidence(user: CurrentUser) -> dict:
    drugs = []
    offset = 0
    # 기존 /me/drugs 계약은 바꾸지 않고, chat에서는 저장약을 끝까지 읽는다.
    # 짧은 페이지도 서버 row cap 때문일 수 있어 빈 페이지에서만 종료한다.
    while True:
        rows = await request_saved_drugs(
            "GET", user,
            params={
                "select": "drug_name,product_code",
                "user_id": f"eq.{user.id}",
                "order": "created_at.asc,id.asc",
                "limit": "100",
                "offset": str(offset),
            },
        )
        if not rows:
            break
        try:
            drugs.extend(EvidenceDrug.model_validate(row).model_dump() for row in rows)
        except ValidationError as exc:
            raise HTTPException(
                status_code=502, detail="나의 약 저장소 응답을 확인할 수 없습니다.",
            ) from exc
        offset += len(rows)

    pairs = []
    # 임의의 약 개수 제한이나 조합 생략 없이, 순차 호출로 공공 API 폭주를 피한다.
    # 하나라도 조회에 실패하면 예외를 전파하며 Gemini로 추측을 요청하지 않는다.
    for index, (first, second) in enumerate(combinations(drugs, 2), start=1):
        try:
            result = await check_interaction(first["drug_name"], second["drug_name"])
        except HTTPException:
            raise
        except Exception:
            # 기존 판정 함수가 처리하지 못한 공공 API 필드 오류도 안전 결과가 아니다.
            raise HTTPException(status_code=502, detail="공공 의약품 정보 조회에 실패했습니다.") from None
        # 공개 /check는 금기 발견 시 다른 상대 약의 행도 함께 반환한다.
        # chat에는 이번 pair에 해당하는 근거 필드만 전달한다(동일 substring 기준).
        details = [
            {key: row.get(key) for key in (
                "ITEM_NAME", "MIXTURE_ITEM_NAME", "INGR_KOR_NAME",
                "MIXTURE_INGR_KOR_NAME", "PROHBT_CONTENT",
            )}
            for row in result.get("interactions", [])
            if second["drug_name"] in row.get("MIXTURE_ITEM_NAME", "")
        ]
        pairs.append({
            "evidence_id": f"pair-{index}",
            "drug1": first["drug_name"],
            "drug2": second["drug_name"],
            "is_prohibited": result["is_prohibited"],
            "details": details,
        })

    return {"saved_drugs": drugs, "pairs": pairs, "scope": EVIDENCE_SCOPE}
