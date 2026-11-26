import unittest
from unittest.mock import AsyncMock, call, patch

import httpx

from app.main import app
from app.routers.drugs import check_interaction, get_all_warnings
from app.services.public_api import (
    DURResponseError,
    _parse_xml_items,
    get_easy_drug_info,
    get_permit_drug_info,
    permit_document_text,
)


class DURResponseTests(unittest.TestCase):
    def test_malformed_xml_is_an_error(self):
        with self.assertRaises(DURResponseError):
            _parse_xml_items("<response><body>")

    def test_non_success_result_code_is_an_error(self):
        with self.assertRaises(DURResponseError):
            _parse_xml_items("<response><header><resultCode>99</resultCode></header></response>")

    def test_successful_empty_response_is_an_empty_list(self):
        xml = "<response><header><resultCode>00</resultCode></header><body><items/></body></response>"
        self.assertEqual(_parse_xml_items(xml), [])


class PermitDocumentTests(unittest.TestCase):
    def test_extracts_plain_text_and_keeps_paragraph_boundaries(self):
        document = (
            '<DOC><SECTION><ARTICLE>'
            '<PARAGRAPH><![CDATA[첫 <b>문단</b> &amp; 설명]]></PARAGRAPH>'
            '<PARAGRAPH>둘째 문단</PARAGRAPH>'
            '</ARTICLE></SECTION></DOC>'
        )
        self.assertEqual(permit_document_text(document), "첫 문단 & 설명\n둘째 문단")
        self.assertEqual(permit_document_text("일반 텍스트"), "일반 텍스트")

    def test_malformed_or_non_text_document_is_empty(self):
        self.assertEqual(permit_document_text("<DOC><PARAGRAPH>"), "")
        self.assertEqual(permit_document_text({"text": "wrong type"}), "")


class PermitLookupTests(unittest.IsolatedAsyncioTestCase):
    async def test_returns_only_matching_product_code(self):
        def respond(request):
            self.assertEqual(request.url.params["item_seq"], "12345")
            self.assertNotIn("itemName", request.url.params)
            return httpx.Response(200, json={
                "header": {"resultCode": "00"},
                "body": {"items": [
                    {"ITEM_SEQ": "99999", "UD_DOC_DATA": "wrong"},
                    {"ITEM_SEQ": "12345", "UD_DOC_DATA": "right"},
                ]},
            })

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.services.public_api.httpx.AsyncClient", return_value=client):
            result = await get_permit_drug_info("12345")

        self.assertEqual(result["UD_DOC_DATA"], "right")

    async def test_ignores_mismatched_product_code(self):
        def respond(request):
            return httpx.Response(200, json={
                "header": {"resultCode": "00"},
                "body": {"items": [{"ITEM_SEQ": "99999", "UD_DOC_DATA": "wrong"}]},
            })

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.services.public_api.httpx.AsyncClient", return_value=client):
            result = await get_permit_drug_info("12345")

        self.assertEqual(result, {})


class EasyDrugInfoTests(unittest.IsolatedAsyncioTestCase):
    async def test_item_seq_filter_accepts_only_matching_product(self):
        def respond(request):
            self.assertEqual(request.url.params["itemSeq"], "12345")
            self.assertNotIn("itemName", request.url.params)
            return httpx.Response(200, json={"body": {
                "items": [{"itemSeq": 12345, "itemName": "공공 API 표기 품목"}],
                "totalCount": 1,
                "numOfRows": 100,
            }})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.services.public_api.httpx.AsyncClient", return_value=client):
            result = await get_easy_drug_info("DUR 표기 품목", item_seq="12345")

        self.assertEqual(result["itemSeq"], 12345)

    async def test_item_seq_mismatch_never_falls_back_to_name(self):
        def respond(request):
            return httpx.Response(200, json={"body": {
                "items": [{"itemSeq": "99999", "itemName": "테스트약정"}],
                "totalCount": 1,
                "numOfRows": 100,
            }})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.services.public_api.httpx.AsyncClient", return_value=client):
            result = await get_easy_drug_info("테스트약정", item_seq="12345")

        self.assertEqual(result, {})

    async def test_selects_exact_name_instead_of_first_similar_result(self):
        def respond(request):
            self.assertEqual(request.url.params["itemName"], "테스트약정")
            return httpx.Response(200, json={"body": {
                "items": [
                    {"itemName": "어린이테스트약정", "useMethodQesitm": "다른 품목"},
                    {"itemName": "테스트약정 ", "useMethodQesitm": "선택한 품목"},
                ],
                "totalCount": 2,
                "numOfRows": 100,
            }})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.services.public_api.httpx.AsyncClient", return_value=client):
            result = await get_easy_drug_info("테스트약정")

        self.assertEqual(result["useMethodQesitm"], "선택한 품목")

    async def test_checks_next_page_and_wrapped_item_shape(self):
        requested_pages = []

        def respond(request):
            page = int(request.url.params["pageNo"])
            requested_pages.append(page)
            item = {"itemName": "테스트약정" if page == 2 else "다른약정"}
            return httpx.Response(200, json={"response": {"body": {
                "items": {"item": item},
                "totalCount": 2,
                "numOfRows": 1,
            }}})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.services.public_api.httpx.AsyncClient", return_value=client):
            result = await get_easy_drug_info("테스트약정")

        self.assertEqual(requested_pages, [1, 2])
        self.assertEqual(result["itemName"], "테스트약정")

    async def test_returns_empty_when_only_similar_names_exist(self):
        def respond(request):
            return httpx.Response(200, json={"body": {
                "items": [{"itemName": "어린이테스트약정"}],
                "totalCount": 1,
                "numOfRows": 100,
            }})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch("app.services.public_api.httpx.AsyncClient", return_value=client):
            result = await get_easy_drug_info("테스트약정")

        self.assertEqual(result, {})


class DrugWarningsTests(unittest.IsolatedAsyncioTestCase):
    async def test_adds_usage_without_changing_existing_response_fields(self):
        with (
            patch("app.routers.drugs.get_interactions_by_item_name", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_pregnancy_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_elderly_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_age_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_easy_drug_info", new_callable=AsyncMock, return_value={
                "itemImage": "image-url",
                "efcyQesitm": "효능 원문",
                "useMethodQesitm": "용법 원문",
                "classNoName": "일반의약품",
            }),
        ):
            result = await get_all_warnings("테스트약정", item_seq=None)

        self.assertEqual(set(result), {
            "name", "imageUrl", "efficacy", "usage", "classNoName",
            "efficacySource", "usageSource", "interaction", "pregnancy",
            "elderly", "age", "warningStatus",
        })
        self.assertEqual(result["usage"], "용법 원문")
        self.assertEqual(result["efficacy"], "효능 원문")
        self.assertEqual(result["usageSource"], "easy_drug")
        self.assertEqual(result["efficacySource"], "easy_drug")
        self.assertEqual(result["warningStatus"], {
            "interaction": "ok", "pregnancy": "ok", "elderly": "ok", "age": "ok",
        })

    async def test_partial_warning_failure_is_visible(self):
        with (
            patch("app.routers.drugs.get_interactions_by_item_name", new_callable=AsyncMock,
                  side_effect=DURResponseError("upstream error")),
            patch("app.routers.drugs.get_pregnancy_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_elderly_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_age_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_easy_drug_info", new_callable=AsyncMock, return_value={}),
        ):
            result = await get_all_warnings("테스트약정", item_seq=None)

        self.assertEqual(result["interaction"], [])
        self.assertEqual(result["warningStatus"], {
            "interaction": "error", "pregnancy": "ok", "elderly": "ok", "age": "ok",
        })

    async def test_prescription_product_uses_permit_fallback(self):
        with (
            patch("app.routers.drugs.get_interactions_by_item_name", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_pregnancy_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_elderly_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_age_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_easy_drug_info", new_callable=AsyncMock, return_value={}),
            patch("app.routers.drugs.get_permit_drug_info", new_callable=AsyncMock, return_value={
                "EE_DOC_DATA": "<DOC><PARAGRAPH>효능 문단</PARAGRAPH></DOC>",
                "UD_DOC_DATA": "<DOC><PARAGRAPH>용법 문단</PARAGRAPH></DOC>",
            }) as permit,
        ):
            result = await get_all_warnings("처방 테스트약", item_seq="12345")

        permit.assert_awaited_once_with("12345")
        self.assertEqual((result["efficacy"], result["usage"]), ("효능 문단", "용법 문단"))
        self.assertEqual((result["efficacySource"], result["usageSource"]), ("permit", "permit"))

    async def test_existing_easy_details_skip_permit_lookup(self):
        with (
            patch("app.routers.drugs.get_interactions_by_item_name", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_pregnancy_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_elderly_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_age_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_easy_drug_info", new_callable=AsyncMock, return_value={
                "efcyQesitm": "효능 원문", "useMethodQesitm": "용법 원문",
            }),
            patch("app.routers.drugs.get_permit_drug_info", new_callable=AsyncMock) as permit,
        ):
            result = await get_all_warnings("일반 테스트약", item_seq="12345")

        permit.assert_not_awaited()
        self.assertEqual((result["efficacySource"], result["usageSource"]), ("easy_drug", "easy_drug"))

    async def test_failed_fallback_leaves_plain_empty_fields_and_null_sources(self):
        with (
            patch("app.routers.drugs.get_interactions_by_item_name", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_pregnancy_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_elderly_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_age_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_easy_drug_info", new_callable=AsyncMock, return_value={
                "efcyQesitm": None, "useMethodQesitm": {"bad": "type"},
            }),
            patch("app.routers.drugs.get_permit_drug_info", new_callable=AsyncMock, return_value={
                "EE_DOC_DATA": "<DOC><PARAGRAPH>", "UD_DOC_DATA": None,
            }),
        ):
            result = await get_all_warnings("처방 테스트약", item_seq="12345")

        self.assertEqual((result["efficacy"], result["usage"]), ("", ""))
        self.assertIsNone(result["efficacySource"])
        self.assertIsNone(result["usageSource"])


class DrugCheckTests(unittest.IsolatedAsyncioTestCase):
    async def test_valid_empty_response_keeps_not_prohibited_shape(self):
        with patch("app.services.interactions.get_interactions_by_item_name", new_callable=AsyncMock, return_value=[]):
            result = await check_interaction("테스트약정", "다른약정")

        self.assertEqual(result["is_prohibited"], False)
        self.assertEqual(set(result), {"drug1", "drug2", "is_prohibited", "message"})

    async def test_upstream_failure_returns_http_502_without_error_details(self):
        with patch("app.services.interactions.get_interactions_by_item_name", new_callable=AsyncMock,
                   side_effect=DURResponseError("private upstream response")):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/drugs/check", params={"drug1": "테스트약정", "drug2": "다른약정"})

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"detail": "공공 의약품 정보 조회에 실패했습니다."})


class DrugIdentityRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_image_and_warnings_forward_optional_item_seq(self):
        with (
            patch("app.routers.drugs.get_interactions_by_item_name", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_pregnancy_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_elderly_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_age_warnings", new_callable=AsyncMock, return_value=[]),
            patch("app.routers.drugs.get_easy_drug_info", new_callable=AsyncMock, return_value={}) as easy,
            patch("app.routers.drugs.get_permit_drug_info", new_callable=AsyncMock, return_value={}),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                image = await client.get("/drugs/image", params={"name": "테스트약정", "item_seq": "12345"})
                warnings = await client.get("/drugs/warnings", params={"name": "테스트약정", "item_seq": "12345"})
                name_only = await client.get("/drugs/image", params={"name": "테스트약정"})

        self.assertEqual([image.status_code, warnings.status_code, name_only.status_code], [200, 200, 200])
        self.assertEqual(easy.await_args_list, [
            call("테스트약정", item_seq="12345"),
            call("테스트약정", item_seq="12345"),
            call("테스트약정", item_seq=None),
        ])


if __name__ == "__main__":
    unittest.main()
