import httpx
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from app.config import SERVICE_KEY

DUR_URL  = "https://apis.data.go.kr/1471000/DURPrdlstInfoService03"
EASY_URL = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService"
PERMIT_URL = "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService08"


class DURResponseError(Exception):
    """DUR API returned a response that cannot be used as valid drug data."""


class _PlainTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            self.parts.append("\n")


def permit_document_text(document: object) -> str:
    """Extract readable paragraphs from an official permit document."""
    if not isinstance(document, str) or not document.strip():
        return ""

    source = document.strip()
    if not source.startswith("<"):
        return source
    try:
        root = ET.fromstring(source)
    except ET.ParseError:
        return ""
    if root.tag != "DOC":
        return ""

    paragraphs = root.findall(".//PARAGRAPH") or [root]
    lines = []
    for paragraph in paragraphs:
        parser = _PlainTextParser()
        parser.feed("".join(paragraph.itertext()))
        parser.close()
        line = "".join(parser.parts).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _parse_xml_items(xml_text: str) -> list:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise DURResponseError("Invalid DUR XML") from exc
    if root.findtext(".//resultCode", "") != "00":
        raise DURResponseError("Unsuccessful DUR response")
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


async def get_easy_drug_info(name: str, item_seq: str | None = None) -> dict:
    """e약은요 API에서 품목번호 또는 정확한 이름으로 상세정보를 찾는다."""
    params = {
        "serviceKey": SERVICE_KEY,
        "type": "json",
        "numOfRows": 100,
    }
    if item_seq is not None:
        params["itemSeq"] = item_seq
    else:
        params["itemName"] = name
    try:
        async with httpx.AsyncClient() as client:
            page = 1
            while True:
                params["pageNo"] = page
                resp = await client.get(f"{EASY_URL}/getDrbEasyDrugList", params=params, timeout=10)
                resp.raise_for_status()
                data = resp.json()
                body = data.get("body") or data.get("response", {}).get("body", {})
                if not isinstance(body, dict):
                    return {}

                items = body.get("items") or []
                if isinstance(items, dict):
                    items = items.get("item", items)
                if isinstance(items, dict):
                    items = [items]
                if not isinstance(items, list) or not items:
                    return {}

                for item in items:
                    if not isinstance(item, dict):
                        continue
                    if item_seq is not None:
                        if str(item.get("itemSeq", "")) == item_seq:
                            return item
                    elif (item.get("itemName") or "").strip() == name.strip():
                        return item

                total_count = int(body.get("totalCount", 0))
                rows_per_page = int(body.get("numOfRows", params["numOfRows"]))
                if rows_per_page < 1 or page * rows_per_page >= total_count:
                    return {}
                page += 1
    except Exception:
        pass
    return {}


async def get_permit_drug_info(item_seq: str) -> dict:
    """Fetch the official product permit only when its product code matches."""
    params = {
        "serviceKey": SERVICE_KEY,
        "item_seq": item_seq,
        "type": "json",
        "pageNo": 1,
        "numOfRows": 100,
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{PERMIT_URL}/getDrugPrdtPrmsnDtlInq08", params=params, timeout=15)
            resp.raise_for_status()
        data = resp.json()
        header = data.get("header") or data.get("response", {}).get("header", {})
        if not isinstance(header, dict) or str(header.get("resultCode")) != "00":
            return {}
        body = data.get("body") or data.get("response", {}).get("body", {})
        if not isinstance(body, dict):
            return {}
        items = body.get("items") or []
        if isinstance(items, dict):
            items = items.get("item", items)
        if isinstance(items, dict):
            items = [items]
        if not isinstance(items, list):
            return {}
        for item in items:
            if isinstance(item, dict) and str(item.get("ITEM_SEQ", "")) == item_seq:
                return item
    except Exception:
        pass
    return {}
