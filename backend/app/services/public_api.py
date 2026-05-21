import httpx
import xml.etree.ElementTree as ET
from app.config import SERVICE_KEY

DUR_URL  = "https://apis.data.go.kr/1471000/DURPrdlstInfoService03"
EASY_URL = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService"


def _parse_xml_items(xml_text: str) -> list:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    if root.findtext(".//resultCode", "") != "00":
        return []
    items = root.find(".//items")
    if items is None:
        return []
    return [{child.tag: child.text for child in item} for item in items.findall("item")]


async def _dur_get(endpoint: str, name: str, page: int = 1, size: int = 20) -> list:
    params = {
        "serviceKey": SERVICE_KEY,
        "pageNo": page,
        "numOfRows": size,
        "itemName": name,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{DUR_URL}/{endpoint}", params=params, timeout=15)
        resp.raise_for_status()
    return _parse_xml_items(resp.text)


async def search_drug_by_name(name: str, page: int = 1, size: int = 10) -> list:
    return await _dur_get("getDurPrdlstInfoList03", name, page, size)


async def get_interactions_by_item_name(name: str, page: int = 1, size: int = 20) -> list:
    return await _dur_get("getUsjntTabooInfoList03", name, page, size)


async def get_pregnancy_warnings(name: str, page: int = 1, size: int = 20) -> list:
    return await _dur_get("getPwnmTabooInfoList03", name, page, size)


async def get_elderly_warnings(name: str, page: int = 1, size: int = 20) -> list:
    return await _dur_get("getOdsnTabooInfoList03", name, page, size)


async def get_age_warnings(name: str, page: int = 1, size: int = 20) -> list:
    return await _dur_get("getSpcifyAgrdeTabooInfoList03", name, page, size)


async def get_easy_drug_info(name: str) -> dict:
    """e약은요 API — itemImage URL, 효능(efcyQesitm) 반환."""
    params = {
        "serviceKey": SERVICE_KEY,
        "itemName": name,
        "type": "json",
        "numOfRows": 1,
        "pageNo": 1,
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{EASY_URL}/getDrbEasyDrugList", params=params, timeout=10)
            resp.raise_for_status()
        data = resp.json()
        body = data.get("body") or data.get("response", {}).get("body", {})
        items = body.get("items", [])
        if isinstance(items, list) and items:
            return items[0]
        if isinstance(items, dict):
            item = items.get("item", {})
            return item if isinstance(item, dict) else {}
    except Exception:
        pass
    return {}
