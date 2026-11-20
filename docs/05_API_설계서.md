# 스마트 메디케이션 API 설계서

- 작성일: 2026.11.18 / 2026.11.20 (나의 약 백엔드 API 구현 반영)
- 관련 문서: `01_기획서_v3.md`, `02_설계서_아키텍처_보안.md`, `03_DB_설계서.md`
- 성격: 백엔드(FastAPI, Render 배포) API 명세. **"상태" 열에서 "구현됨"은 로컬 저장소(`D:\Project_KYB\smart-medication\backend`) 코드를 직접 열어 확인한 것만 표기하며, 그 외는 01 기획서 로드맵(Phase 2~5)에 따른 설계안(미구현)입니다.**

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| 베이스 URL | smart-medication-api.onrender.com (배포) |
| 데이터 포맷 | JSON (요청/응답 공통) |
| 인증 방식 | Supabase Auth가 발급한 JWT를 `Authorization: Bearer <token>` 헤더로 전달 — 로그인·회원가입 자체는 프론트엔드가 Supabase Auth SDK로 직접 처리하므로, 이 백엔드에는 별도의 `/auth/login` 류 엔드포인트가 없음 (근거: `02_설계서_아키텍처_보안.md` 2-1절 "Supabase Auth에 위임") |
| 공개 라우트 | 약품 검색, 병용금기 확인 — 인증 미들웨어를 거치지 않음 (근거: `02_설계서_아키텍처_보안.md` 2-3절) |

## 2. 공개 API — 로그인 불필요

> 이 절은 `backend/app/main.py`, `backend/app/routers/drugs.py` 코드를 직접 읽어 확인한 내용입니다 (2026.11.18).

| 메서드 | 경로 | 요청 파라미터 | 응답(주요 필드) | 설명 | 상태 |
|---|---|---|---|---|---|
| GET | `/` | - | `message`, `docs` | 루트 — API 안내 | **구현됨** |
| GET | `/health` | - | `status` | 헬스 체크 | **구현됨** |
| GET | `/drugs/search` | `name`(필수), `page`(기본 1), `size`(기본 10, 최대 100) | `query`, `count`, `items` | 제품명으로 검색 | **구현됨** |
| GET | `/drugs/image` | `name`(필수), `item_seq`(선택) | `imageUrl`, `classNoName` | e약은요 API에서 이미지 URL·전문/일반 구분을 제공 시 반환하며, 없는 필드는 빈 문자열 | **구현됨** |
| GET | `/drugs/warnings` | `name`(필수), `item_seq`(선택) | `name`, `imageUrl`, `efficacy`, `usage`, `efficacySource`, `usageSource`, `classNoName`, `interaction`, `pregnancy`, `elderly`, `age`, `warningStatus` | **한 약품**의 효능·용법과 4종 금기 정보를 반환 | **구현됨** |
| GET | `/drugs/check` | `drug1`(필수), `drug2`(필수) | `drug1`, `drug2`, `is_prohibited`, `interactions`/`all_prohibited` | **두 약품**의 병용금기 여부 비교 | **구현됨** |

> 01 기획서 5~6장에서 "병용금기 확인"이라고 서술한 기능은 실제로는 `/drugs/check`(두 약품 비교)가 담당하며, `/drugs/warnings`는 한 약품의 금기 정보 전체 조회용입니다. 두 라우트의 역할 차이가 01/02 문서의 서술과 정확히 1:1로 맞지는 않으니, 화면·문서 쪽 표현은 추후 보완이 필요합니다.
> 이 절의 공개 약품 API는 인증 없이 공공 API를 그때그때 호출합니다. 계정 인증과 Supabase 저장 데이터 호출은 3장의 `/me/drugs` 라우트에만 적용합니다.

### Phase 1 약 상세정보 보강

- `/drugs/image`와 `/drugs/warnings`의 선택 파라미터 `item_seq`에는 `/drugs/search` 결과의 `ITEM_SEQ`를 전달합니다. 이 값이 있으면 e약은요의 `itemSeq`가 일치하는 품목만 사용하고, 없으면 요청한 `name`과 정확히 일치하는 품목을 찾습니다.
- `/drugs/warnings`의 효능·용법은 우선 e약은요의 `efcyQesitm`·`useMethodQesitm`을 사용합니다. 해당 값이 없고 `item_seq`가 있으면 공식 식약처 의약품 제품 허가정보 API의 같은 `ITEM_SEQ`에서 `EE_DOC_DATA`·`UD_DOC_DATA` 문단 텍스트를 가져와 빈 필드만 채웁니다. 코드가 없으면 동명 이품목을 구별할 수 없어 허가정보를 결합하지 않습니다.
- `efficacySource`와 `usageSource`는 각 필드의 출처로 `easy_drug`, `permit`, 또는 값이 없을 때 `null`입니다. 일반적인 품목 안내이므로 개인 처방의 복용 횟수나 식전·식후 지시로 해석하지 않습니다.
- `warningStatus`는 `interaction`, `pregnancy`, `elderly`, `age` 각각의 공공 DUR 조회 상태를 `ok` 또는 `error`로 나타냅니다. `error`일 때 해당 배열이 비어 있어도 금기 자료가 없다는 뜻이 아닙니다.
- `/drugs/check`는 공공 DUR 응답이 잘못되었거나 조회에 실패하면 HTTP 502와 일반적인 `detail` 메시지를 반환합니다. 정상 응답의 `is_prohibited: false`도 현재 조회 범위에서 일치 항목을 찾지 못했다는 의미이며, 복용 안전성을 확정하지 않습니다.
- 기존 응답 필드는 유지합니다. 4종 금기 배열은 현재 조회 범위에 해당하며, 빈 배열만으로 복용 안전성을 확정할 수 없습니다.

## 3. 나의 약 API (백엔드 구현 — 로그인 필요)

Phase 2 백엔드 단계의 구현입니다. `03_DB_설계서.md`의 `saved_drugs` 테이블과 대응하며, 프론트의 `useMyDrugs.js`는 다음 단계까지 기존 브라우저 저장을 사용합니다.

| 메서드 | 경로 | 요청 | 성공 응답 | 상태 |
|---|---|---|---|---|
| GET | `/me/drugs` | Bearer JWT | `200` · 본인 약 배열 (`id`, `drug_name`, `product_code`, `created_at`), 최신순 | **구현됨** |
| POST | `/me/drugs` | Bearer JWT · JSON `{ "drug_name": "...", "product_code": "..." }` (`product_code` 선택) | `201` · 생성된 약 한 건 | **구현됨** |
| DELETE | `/me/drugs/{id}` | Bearer JWT · 약 ID(UUID) | `204` · 본인 약 삭제, 응답 본문 없음 | **구현됨** |

- 모든 요청은 Supabase Auth JWT가 필요합니다. 백엔드는 프로젝트 JWKS 공개키로 ES256 서명·만료·발급자·대상을 검증하며, 토큰이 없거나 유효하지 않으면 `401`을 반환합니다. 현재 서명 키가 ECC(P-256)/ES256인 것은 2026.11.20 Supabase 대시보드 Settings → JWT Keys에서 확인했습니다. 이전 HS256 토큰은 JWKS로 검증할 수 없어 `401`이며 다시 로그인해야 합니다.
- Supabase Data API에는 publishable key를 `apikey` 헤더에, 검증된 **사용자 JWT**를 `Authorization: Bearer` 헤더에 전달합니다. `POST`의 `user_id`는 요청 본문을 받지 않고 JWT의 `sub`에서 설정하며, `GET`·`DELETE`에는 본인 `user_id` 필터와 `saved_drugs` RLS가 함께 적용됩니다. 서비스 키는 사용하지 않습니다.
- 삭제 대상이 없거나 본인 약이 아니면 같은 `404`를 반환합니다. 잘못된 요청 본문·UUID는 FastAPI의 `422`입니다.
- Supabase Data API가 `401`(인증 실패)을 반환하면 백엔드도 `401`, `403`(접근 권한 없음)을 반환하면 백엔드도 `403`을 반환합니다. 그 밖의 저장소 요청 실패는 `502`입니다.

## 4. 복약 질문 AI API (설계안 — 로그인 필요, ★메인 기능)

로드맵 Phase 3~4 대상. Phase 3(등록된 약 기준, RAG 없이 프롬프트 직접 주입) → Phase 4(RAG 확장)로 단계적으로 구현 예정이며, 아래는 Phase 4(최종 형태) 기준입니다.

| 메서드 | 경로 | 설명 | 상태 |
|---|---|---|---|
| POST | `/chat/sessions` | 새 질문 세션 생성 | 설계안 |
| GET | `/chat/sessions` | 내 세션 목록 조회 | 설계안 |
| GET | `/chat/sessions/{id}/messages` | 세션 내 대화 이력 조회 | 설계안 |
| POST | `/chat/sessions/{id}/messages` | 구어체 질문 전송 → Pinecone 벡터 검색 → 근거 주입 LLM 응답 반환 | 설계안 |

> 처리 흐름 상세는 `01_기획서_v3.md` 7장(사용자 플로우) 및 `03_DB_설계서.md` 3장(Pinecone 인덱스 설계) 참고.

## 5. 처방전 업로드 API (설계안 — 로그인 필요)

로드맵 Phase 5 대상. 화이트리스트 처리 파이프라인은 `02_설계서_아키텍처_보안.md` 2-2절에 상세.

| 메서드 | 경로 | 설명 | 상태 |
|---|---|---|---|
| POST | `/prescriptions/extract` | 처방전 이미지 업로드 → 서버 메모리에서 OCR → 화이트리스트 필드(약품명·용량·복용 횟수·식전/식후)만 추출해 저장, 원본 이미지·OCR 원문은 즉시 폐기 | 설계안 |

## 6. RAG/벡터DB 관리자 API (설계안 — 관리자 전용)

`04_UI_설계서.md`의 `RAGAdmin` 화면(일반 사용자 비노출)과 대응합니다.

| 메서드 | 경로 | 설명 | 상태 |
|---|---|---|---|
| GET | `/admin/rag/status` | Pinecone 저장 용량·청크 수·임베딩 배치 로그 조회 | 설계안 |

## 7. 공통 사항

- **에러 응답 형식**: 구현된 라우트는 FastAPI의 `{"detail": "..."}` 형식을 사용합니다.
- **인증 실패**: `/me/drugs`에 토큰 없이 접근하거나 유효하지 않은 토큰을 보내면 `401`입니다. 아직 미구현인 관리자 전용 라우트의 권한 부족 응답은 구현 시 결정합니다.

## 8. 근거 자료

- `01_기획서_v3.md` 4장(핵심 기능), 6장(기능 범위), 10장(로드맵) — 엔드포인트 범위·우선순위 근거
- `02_설계서_아키텍처_보안.md` 1장(시스템 구성), 2장(보안·개인정보 설계) — 인증 방식, 공개 라우트, 처방전 파이프라인 근거
- `03_DB_설계서.md` 2장(Supabase 스키마), 3장(Pinecone 인덱스) — 나의 약/채팅/처방전 API의 데이터 구조 근거
- 로컬 저장소 `D:\Project_KYB\smart-medication\backend` 코드 직접 확인 (2026.11.20) — `app/main.py`, `app/routers/drugs.py`, 나의 약 라우터·인증 dependency — 2~3장의 구현 상태 근거
- Supabase 공식 JWT/Signing Keys 및 API Keys 가이드 — JWKS 검증과 사용자 JWT·publishable key 헤더 조합 근거
- 4~6장의 "설계안" 항목은 실제 코드가 아니라 01~04 문서의 서술을 바탕으로 구성한 설계입니다. 실제 구현 시 이 문서와 코드를 맞춰 갱신이 필요합니다.
