import httpx
import xml.etree.ElementTree as ET
from app.config import SERVICE_KEY

BASE_URL = "https://apis.data.go.kr/1471000/DURPrdlstInfoService03"


def _parse_xml_items(xml_text: str) -> list:
    """공공 API XML 응답에서 <item> 목록을 dict 리스트로 변환."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    result_code = root.findtext(".//resultCode", "")
    if result_code != "00":
        return []

    items = root.find(".//items")
    if items is None:
        return []

    return [
        {child.tag: child.text for child in item}
        for item in items.findall("item")
    ]


async def search_drug_by_name(name: str, page: int = 1, size: int = 10) -> list:
    """DUR 품목정보 조회 — 상표명으로 약품 검색."""
    url = f"{BASE_URL}/getDurPrdlstInfoList03"
    params = {
        "serviceKey": SERVICE_KEY,
        "pageNo": page,
        "numOfRows": size,
        "itemName": name,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=10)
        resp.raise_for_status()

    return _parse_xml_items(resp.text)


async def get_interactions_by_item_name(name: str, page: int = 1, size: int = 20) -> list:
    """병용금기 정보조회 — 약품명으로 병용금기 목록 반환."""
    url = f"{BASE_URL}/getUsjntTabooInfoList03"
    params = {
        "serviceKey": SERVICE_KEY,
        "pageNo": page,
        "numOfRows": size,
        "itemName": name,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=10)
        resp.raise_for_status()

    return _parse_xml_items(resp.text)
