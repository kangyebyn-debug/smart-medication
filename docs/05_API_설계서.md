# 스마트 메디케이션 API 설계서

- 작성일: 2026.11.18 (수정) / 2026.11.18 (코드 직접 확인 후 2장 정정)
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
> DB·인증·세션 등은 백엔드 코드에 아직 전혀 없고(`requirements.txt`에 DB/Auth 관련 패키지 없음), 모든 응답은 공공 API를 그때그때 직접 호출해 반환하는 구조입니다.

### Phase 1 약 상세정보 보강

- `/drugs/image`와 `/drugs/warnings`의 선택 파라미터 `item_seq`에는 `/drugs/search` 결과의 `ITEM_SEQ`를 전달합니다. 이 값이 있으면 e약은요의 `itemSeq`가 일치하는 품목만 사용하고, 없으면 요청한 `name`과 정확히 일치하는 품목을 찾습니다.
- `/drugs/warnings`의 효능·용법은 우선 e약은요의 `efcyQesitm`·`useMethodQesitm`을 사용합니다. 해당 값이 없고 `item_seq`가 있으면 공식 식약처 의약품 제품 허가정보 API의 같은 `ITEM_SEQ`에서 `EE_DOC_DATA`·`UD_DOC_DATA` 문단 텍스트를 가져와 빈 필드만 채웁니다. 코드가 없으면 동명 이품목을 구별할 수 없어 허가정보를 결합하지 않습니다.
- `efficacySource`와 `usageSource`는 각 필드의 출처로 `easy_drug`, `permit`, 또는 값이 없을 때 `null`입니다. 일반적인 품목 안내이므로 개인 처방의 복용 횟수나 식전·식후 지시로 해석하지 않습니다.
- `warningStatus`는 `interaction`, `pregnancy`, `elderly`, `age` 각각의 공공 DUR 조회 상태를 `ok` 또는 `error`로 나타냅니다. `error`일 때 해당 배열이 비어 있어도 금기 자료가 없다는 뜻이 아닙니다.
- `/drugs/check`는 공공 DUR 응답이 잘못되었거나 조회에 실패하면 HTTP 502와 일반적인 `detail` 메시지를 반환합니다. 정상 응답의 `is_prohibited: false`도 현재 조회 범위에서 일치 항목을 찾지 못했다는 의미이며, 복용 안전성을 확정하지 않습니다.
- 기존 응답 필드는 유지합니다. 4종 금기 배열은 현재 조회 범위에 해당하며, 빈 배열만으로 복용 안전성을 확정할 수 없습니다.

## 3. 나의 약 API (설계안 — 로그인 필요)

로드맵 Phase 2(계정/DB 기반 전환) 대상. `03_DB_설계서.md`의 `saved_drugs` 테이블과 대응합니다.

| 메서드 | 경로 | 설명 | 상태 |
|---|---|---|---|
| GET | `/me/drugs` | 로그인한 사용자가 등록한 약 목록 조회 | 설계안 |
| POST | `/me/drugs` | 약 등록 (drug_name, product_code) | 설계안 |
| DELETE | `/me/drugs/{id}` | 등록한 약 삭제 | 설계안 |

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

## 7. 공통 사항 (설계안)

- **에러 응답 형식**: 아직 코드로 확정되지 않았으며, 구현 시점에 `{"detail": "..."}` (FastAPI 기본 형식) 사용 여부를 결정 예정
- **인증 실패**: 인증이 필요한 라우트에 토큰 없이 접근 시 401, 권한 부족(관리자 전용 라우트에 일반 사용자 접근) 시 403을 사용할 계획이나, 아직 구현 전이므로 확정된 사실은 아님

## 8. 근거 자료

- `01_기획서_v3.md` 4장(핵심 기능), 6장(기능 범위), 10장(로드맵) — 엔드포인트 범위·우선순위 근거
- `02_설계서_아키텍처_보안.md` 1장(시스템 구성), 2장(보안·개인정보 설계) — 인증 방식, 공개 라우트, 처방전 파이프라인 근거
- `03_DB_설계서.md` 2장(Supabase 스키마), 3장(Pinecone 인덱스) — 나의 약/채팅/처방전 API의 데이터 구조 근거
- 로컬 저장소 `D:\Project_KYB\smart-medication\backend` 코드 직접 확인 (2026.11.18) — `app/main.py`, `app/routers/drugs.py`, `requirements.txt` — 2장의 "구현됨" 6개 엔드포인트 및 "DB/인증 미구현" 서술의 근거
- 3~6장의 "설계안" 항목은 실제 코드가 아니라 01~04 문서의 서술을 바탕으로 구성한 설계입니다. 실제 구현 시 이 문서와 코드를 맞춰 갱신이 필요합니다.
