# 스마트 메디케이션 API 설계서

- 작성일: 2026.11.18 / 2026.11.20 / 2026.11.24 / 2026.11.26 (Phase 3 복약 질문 AI 백엔드 API 구현 반영)
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
> 이 절의 공개 약품 API는 인증 없이 공공 API를 그때그때 호출합니다. 계정 인증과 Supabase 저장 데이터 호출은 3장의 `/me/drugs`, 3-1절의 `/me/profile`, 4장의 `/chat` 라우트에 적용합니다.

### Phase 1 약 상세정보 보강

- `/drugs/image`와 `/drugs/warnings`의 선택 파라미터 `item_seq`에는 `/drugs/search` 결과의 `ITEM_SEQ`를 전달합니다. 이 값이 있으면 e약은요의 `itemSeq`가 일치하는 품목만 사용하고, 없으면 요청한 `name`과 정확히 일치하는 품목을 찾습니다.
- `/drugs/warnings`의 효능·용법은 우선 e약은요의 `efcyQesitm`·`useMethodQesitm`을 사용합니다. 해당 값이 없고 `item_seq`가 있으면 공식 식약처 의약품 제품 허가정보 API의 같은 `ITEM_SEQ`에서 `EE_DOC_DATA`·`UD_DOC_DATA` 문단 텍스트를 가져와 빈 필드만 채웁니다. 코드가 없으면 동명 이품목을 구별할 수 없어 허가정보를 결합하지 않습니다.
- `efficacySource`와 `usageSource`는 각 필드의 출처로 `easy_drug`, `permit`, 또는 값이 없을 때 `null`입니다. 일반적인 품목 안내이므로 개인 처방의 복용 횟수나 식전·식후 지시로 해석하지 않습니다.
- `warningStatus`는 `interaction`, `pregnancy`, `elderly`, `age` 각각의 공공 DUR 조회 상태를 `ok` 또는 `error`로 나타냅니다. `error`일 때 해당 배열이 비어 있어도 금기 자료가 없다는 뜻이 아닙니다.
- `/drugs/check`는 공공 DUR 응답이 잘못되었거나 조회에 실패하면 HTTP 502와 일반적인 `detail` 메시지를 반환합니다. 정상 응답의 `is_prohibited: false`도 현재 조회 범위에서 일치 항목을 찾지 못했다는 의미이며, 복용 안전성을 확정하지 않습니다.
- 기존 응답 필드는 유지합니다. 4종 금기 배열은 현재 조회 범위에 해당하며, 빈 배열만으로 복용 안전성을 확정할 수 없습니다.

## 3. 나의 약 API (백엔드 구현 — 로그인 필요)

Phase 2에 구현한 API로 `03_DB_설계서.md`의 `saved_drugs` 테이블과 대응합니다. 프론트의 `useMyDrugs.js`는 로그인한 사용자의 JWT를 담아 이 API를 호출하며, 브라우저 로컬 저장은 사용하지 않습니다.

| 메서드 | 경로 | 요청 | 성공 응답 | 상태 |
|---|---|---|---|---|
| GET | `/me/drugs` | Bearer JWT | `200` · 본인 약 배열 (`id`, `drug_name`, `product_code`, `created_at`), 최신순 | **구현됨** |
| POST | `/me/drugs` | Bearer JWT · JSON `{ "drug_name": "...", "product_code": "..." }` (`product_code` 선택) | `201` · 생성된 약 한 건 | **구현됨** |
| DELETE | `/me/drugs/{id}` | Bearer JWT · 약 ID(UUID) | `204` · 본인 약 삭제, 응답 본문 없음 | **구현됨** |

- 모든 요청은 Supabase Auth JWT가 필요합니다. 백엔드는 프로젝트 JWKS 공개키로 ES256 서명·만료·발급자·대상을 검증하며, 토큰이 없거나 유효하지 않으면 `401`을 반환합니다. 현재 서명 키가 ECC(P-256)/ES256인 것은 2026.11.20 Supabase 대시보드 Settings → JWT Keys에서 확인했습니다. 이전 HS256 토큰은 JWKS로 검증할 수 없어 `401`이며 다시 로그인해야 합니다.
- Supabase Data API에는 publishable key를 `apikey` 헤더에, 검증된 **사용자 JWT**를 `Authorization: Bearer` 헤더에 전달합니다. `POST`의 `user_id`는 요청 본문을 받지 않고 JWT의 `sub`에서 설정하며, `GET`·`DELETE`에는 본인 `user_id` 필터와 `saved_drugs` RLS가 함께 적용됩니다. 서비스 키는 사용하지 않습니다.
- 삭제 대상이 없거나 본인 약이 아니면 같은 `404`를 반환합니다. 잘못된 요청 본문·UUID는 FastAPI의 `422`입니다.
- Supabase Data API가 `401`(인증 실패)을 반환하면 백엔드도 `401`, `403`(접근 권한 없음)을 반환하면 백엔드도 `403`을 반환합니다. 그 밖의 저장소 요청 실패는 `502`입니다.

### 3-1. 내 프로필 API (백엔드 구현 — 로그인 필요)

`backend/app/routers/profile.py`와 `app/services/profile.py`를 직접 확인한 계약입니다 (2026.11.24). 기존 `profiles` 테이블의 표시 이름만 조회·수정하며, 이메일은 응답하거나 변경하지 않습니다. 프런트는 기존 `auth.session.user.email`을 사용합니다.

| 메서드 | 경로 | 요청 | 성공 응답 | 상태 |
|---|---|---|---|---|
| GET | `/me/profile` | Bearer JWT | `200` · `{ "display_name": "..." }` 또는 `{ "display_name": null }` | **구현됨** |
| PATCH | `/me/profile` | Bearer JWT · JSON `{ "display_name": "..." }` 또는 `{ "display_name": null }` | `200` · 저장된 `display_name` 한 필드 | **구현됨** |

- `/me/drugs`와 같은 `CurrentUser`·`get_current_user` 인증 의존성을 재사용합니다. Supabase Data API에는 publishable key와 검증된 사용자 JWT를 전달하고, 두 메서드 모두 JWT의 사용자 ID로 `profiles.id`를 필터링하여 본인 행 RLS를 유지합니다. 관리자 키로 정책을 우회하지 않습니다.
- `PATCH`의 `display_name`은 필수 필드이며 문자열 또는 `null`만 받습니다. 문자열 앞뒤 공백은 제거하고, 빈 문자열·공백만 있는 문자열은 `null`로 정규화합니다. `id`, `email` 등 다른 필드는 허용하지 않으며, 누락·잘못된 자료형·추가 필드는 `422`입니다.
- `display_name: null`인 정상 프로필은 `200`입니다. 반면 조회·수정 결과가 빈 배열이면 행 부재 또는 RLS로 보이지 않는 경우이므로 `404`로 구분합니다. 잘못된 응답 형식·복수 행·요청/네트워크 실패는 `502`입니다.
- 미인증·유효하지 않은 JWT 및 Supabase의 `401`은 `401`(`WWW-Authenticate: Bearer`), Supabase의 `403`은 `403`입니다. 인증/저장소 설정 누락이나 JWKS 인증 서버 연결 실패는 `503`입니다. 저장소 내부 오류 내용은 그대로 노출하지 않습니다.
- 로컬 검증: `backend` 디렉터리에서 `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`를 실행하여 프로필 테스트 14개를 포함한 전체 44개 테스트가 통과했습니다 (2026.11.24). 프로필 자동 테스트는 생성한 ES256 키·오프라인 JWKS와 모의 Supabase 응답을 사용하며, 실제 Supabase 권한·데이터 검증과 구분합니다.
- 실제 권한 확인 (2026.11.24): 사용자가 유효한 사용자 JWT로 로컬 Swagger의 `GET /me/profile`을 호출하여 `403` 및 `"프로필 저장소 접근 권한이 없습니다."` 응답을 직접 확인했습니다. 이에 `backend/supabase/migrations/0003_profiles_authenticated_grant.sql`에 `grant select, update on public.profiles to authenticated;`를 추가했으며, 기존 RLS는 유지합니다. 사용자가 Supabase SQL Editor에서 GRANT를 실행한 뒤 다시 조회하여 **`200 OK` 및 `{ "display_name": null }` 응답(표시 이름 미설정)을 확인했습니다.** 실제 계정의 `PATCH /me/profile`과 나의 약 전체 삭제는 운영 DB에서 테스트하지 않았습니다.
- 나의 약 목록 초기화는 기존 `DELETE /me/drugs/{id}` 반복 호출을 사용하며 새 초기화 엔드포인트는 추가하지 않습니다. 이메일·비밀번호 변경 및 계정 삭제 API는 이번 구현 범위가 아닙니다.

## 4. 복약 질문 AI API (Phase 3 백엔드 구현 — 로그인 필요, ★메인 기능)

`backend/app/routers/chat.py`, `app/services/chat_evidence.py`·`gemini_chat.py`·`chat_store.py`, `app/config.py`, `app/main.py`를 직접 확인한 로컬 구현 계약입니다 (2026.11.26). **등록된 약의 실제 공공 DUR 병용금기 조회 결과만 설명**하며, Phase 4의 RAG·Pinecone·전체 의약품 검색, 스트리밍, 프런트 채팅 화면은 구현하지 않습니다. 아래의 "구현됨"은 실제 사용자 JWT·Supabase 권한·Gemini 실호출 검증 완료를 뜻하지 않습니다.

| 메서드 | 경로 | 요청 | 성공 응답 | 상태 |
|---|---|---|---|---|
| POST | `/chat/sessions` | Bearer JWT · JSON `{ "title": "..." }` 또는 `{ "title": null }` (본문·필드 생략 가능) | `201` · 세션 한 건 (`id`, `title`, `created_at`) | **구현됨** |
| GET | `/chat/sessions` | Bearer JWT | `200` · 본인 세션 전체 배열, `created_at.desc,id.desc` 순 | **구현됨** |
| GET | `/chat/sessions/{id}/messages` | Bearer JWT · 세션 ID(UUID) | `200` · 해당 세션 메시지 전체 배열 (`id`, `session_id`, `role`, `content`, `created_at`), `created_at.asc,id.asc` 순 | **구현됨** |
| POST | `/chat/sessions/{id}/messages` | Bearer JWT · JSON `{ "content": "질문" }` | `201` · 저장된 **assistant 메시지 한 건** (`id`, `session_id`, `role`, `content`, `created_at`) | **구현됨** |

### 요청·소유권·저장 계약

- 기존 `CurrentUser`·`get_current_user` 의존성으로 ES256/JWKS 인증을 재사용합니다. 사용자 ID는 JWT에서 가져오며, Supabase에는 publishable key와 사용자 JWT를 전달해 RLS를 유지합니다. 관리자 키로 우회하지 않습니다.
- 세션 생성의 `title`은 문자열 또는 `null`이며, 앞뒤 공백을 제거하고 빈 문자열·공백만 있는 문자열은 `null`로 저장합니다. 생략 시 `null`이고 자동 제목 생성은 하지 않습니다. 메시지는 `content` 문자열만 받으며, 앞뒤 공백을 제거한 결과가 비어 있으면 `422`입니다. 두 요청 모두 추가 필드를 금지하므로 `user_id`, `role` 등을 클라이언트가 지정할 수 없습니다. 잘못된 자료형·UUID도 `422`입니다.
- 메시지 조회·전송 전 세션 ID와 JWT 사용자 ID를 함께 필터링하여 소유권을 확인합니다. 없는 세션과 RLS로 보이지 않는 타인 세션은 동일한 `404`(`대화 세션을 찾을 수 없습니다.`)로 처리합니다.
- 세션·메시지 목록은 `limit=100`으로 페이지를 읽고 실제 응답 개수만큼 offset을 누적하여 **빈 페이지까지** 조회합니다. Supabase 행 수 상한으로 짧게 반환된 페이지를 마지막으로 추정하지 않으며, 별도 총건수 추정이나 사용자 지정 페이지 파라미터는 없습니다.
- 질문·응답은 답변이 준비된 뒤 한 번의 PostgREST 벌크 INSERT로 두 행을 함께 저장합니다. DUR 조회 또는 Gemini 생성 실패 시 두 메시지 모두 저장하지 않습니다. INSERT 자체는 하나의 DB 트랜잭션으로 처리하므로 한 행만 저장되는 반쪽 대화를 만들지 않습니다. 다만 저장 후 네트워크 응답 유실은 커밋 여부를 알 수 없으므로 오류 응답이 항상 미저장을 뜻하지는 않으며, 자동 재전송·중복 제거 기능은 없습니다.

### 근거 수집·Gemini 설명 흐름과 한계

1. 매 질문마다 본인 `saved_drugs` 전체를 `created_at.asc,id.asc` 순으로 페이지 조회합니다. 여기서도 빈 페이지까지 읽으며 기존 `/me/drugs` API 계약은 변경하지 않습니다.
2. 저장약이 0~1개면 DUR·Gemini를 호출하지 않고, 비교할 약을 더 등록하라는 고정 안내와 의학적 진단·개인 안전성 확정이 아니라는 면책을 반환·저장합니다. 이 경우에도 세션 소유권 확인과 두 메시지 저장은 수행합니다.
3. 2개 이상이면 `n × (n-1) / 2`개 **모든 조합**을 순차 조회합니다. 공개 `/drugs/check`와 같은 `check_interaction` 서비스를 직접 import하여 재사용하며 HTTP self-call, 임의 약 개수 제한, 조합 생략은 없습니다. 한 조합이라도 조회에 실패하면 답변 생성을 중단합니다.
4. 기존 `/drugs/check`의 조회·판정 범위는 그대로입니다. **품목명 기반 첫 페이지(최대 20건), 두 번째 약 이름의 부분 문자열 일치**이며 품목코드 기반 정확 식별이나 전체 DUR 자료 조회가 아닙니다. 저장약의 `product_code`는 근거에 포함되지만 이번 병용금기 조회의 정확 식별에 사용하지 않습니다. `is_prohibited: false`는 이 범위에서 미발견이라는 뜻이지, 개인의 복용 안전성 보장이 아닙니다.
5. `saved_drugs`, 모든 조합의 `evidence_id`·약품명·판정·금기 사유(`details`), 조회 범위(`scope`)를 구조화된 JSON 근거로 Gemini에 전달합니다. 현재 질문과 근거만 전송하고 **사용자 ID·JWT·과거 대화 이력은 전송하지 않습니다.** 저장된 이력 조회는 가능하지만 이전 대화 맥락을 이어 추론하는 기능은 없습니다.
6. 시스템 지시는 근거 밖 자체 의학 지식·추측·새 상호작용 생성·복용 가능 확정·진단·용량·복용 변경 조언 등을 금지합니다. 질문과 근거 속 문자열도 비신뢰 데이터로 취급하여 그 안의 명령을 따르지 않도록 합니다. 답변은 `answer`와 `evidence_ids`를 가진 JSON으로 요청하고, 정상 완료된 단일 텍스트 응답·JSON 형식·모든 조합 ID의 누락/중복/허구 참조를 검증합니다. 불완전·차단 응답이나 검증 실패를 정상 답변으로 사용하지 않습니다.
7. 모델 답변 뒤에 서버가 조회 범위와 의학적 진단이 아니라는 면책을 항상 추가합니다. **근거 ID 검사는 자연어의 모든 의학적 주장이 참인지 검증하지는 못합니다.** 프롬프트·형식 검증만으로 환각이 완전히 제거됐다고 주장하지 않으며 실제 모델 검증과 사람의 검토가 필요합니다.

### 환경변수·무료 티어·마이그레이션·검증 상태

- `GEMINI_API_KEY`는 사용자가 직접 발급해 `backend/.env`에 설정합니다. 키 값은 문서·코드·로그·커밋에 남기지 않습니다. 선택 환경변수 `GEMINI_MODEL`이 없거나 비어 있으면 `gemini-3.5-flash-lite`를 사용합니다. Google 공식 [모델 목록](https://ai.google.dev/gemini-api/docs/models)과 [가격표](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)에서 해당 Flash-Lite 모델·무료 티어를 확인한 기준일은 **2026.11.26**이며, 모델 제공 여부·쿼터는 변할 수 있습니다. 무거운 SDK 없이 기존 `httpx`로 REST `generateContent`를 호출합니다.
- Gemini 무료 서비스에는 [공식 약관](https://ai.google.dev/gemini-api/terms#unpaid-services)의 민감·기밀·개인정보 입력 금지 및 데이터 이용 조건이 적용됩니다. 사용자 ID·JWT를 제외하더라도 질문과 약 목록 자체가 건강정보를 포함할 수 있으므로 **이번 무료 티어 실호출 검증은 개인정보 없는 가상 약 목록·가상 질문으로만** 진행합니다. 실제 개인 건강정보를 무료 티어로 보내도 된다는 의미가 아닙니다.
- `backend/supabase/migrations/0004_chat_tables.sql`에 `chat_sessions`·`chat_messages`, RLS 본인 SELECT/INSERT 정책, `grant select, insert on public.chat_sessions, public.chat_messages to authenticated;`를 함께 포함합니다. 메시지의 본인 여부는 부모 세션 소유자로 확인합니다. **사용자가 Supabase SQL Editor에서 직접 실행하며, 에이전트는 DB에 대신 실행하지 않습니다.**
- 실제 로그인 JWT로 로컬 Swagger에서 세션 생성·목록·메시지 조회·전송, 저장약 2개 미만/이상, 타인 세션 접근, GRANT 적용 전후 상태 및 Gemini 실호출을 확인하는 절차는 **아직 미검증**입니다. 모의 테스트 성공을 실제 Supabase 권한 또는 Google API 성공으로 간주하지 않습니다. GRANT가 이미 포함된 파일이므로 적용 전 오류가 반드시 `403`이라고 단정하지 않으며, 실제 상태 코드·응답만 기록해야 합니다.
- 로컬 검증 (2026.11.26): 전체 백엔드 자동 테스트 **109개 통과**. 채팅 통합 테스트는 생성한 ES256 키·오프라인 JWKS와 모의 HTTP 응답으로 인증부터 근거 수집·Gemini 응답 검증·벌크 저장까지 실행했습니다. 실제 `http://localhost:8000/docs`에서도 새 4개 작업의 표시와 미인증 실행 시 모두 `401` 및 `WWW-Authenticate: Bearer`를 확인했습니다. 실제 계정 성공 흐름과는 별개의 결과입니다.

### 오류 응답

| 상태 | 조건 |
|---|---|
| `401` | JWT 누락·무효·만료 또는 Supabase의 인증 거절. `WWW-Authenticate: Bearer` 포함 |
| `403` | Supabase 대화/저장약 테이블 접근 권한 거절. 내부 DB 오류 내용은 노출하지 않음 |
| `404` | 메시지 조회·전송 대상 세션이 없거나 본인 소유가 아님 |
| `422` | 잘못된 UUID·자료형·추가 필드 또는 비어 있는 메시지 |
| `429` | Gemini 요청 한도 초과. 자동 재시도하지 않음 |
| `502` | 저장소/공공 DUR/Gemini 요청·네트워크 오류, 잘못된 저장소 응답 또는 AI 근거 형식·완료 상태 검증 실패 |
| `503` | 인증·저장소·Gemini 설정 누락/무효, JWKS 연결 실패 또는 Gemini의 키/권한 거절(`401`/`403`) |

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
- **인증 실패**: `/me/drugs`, `/me/profile`, `/chat`에 토큰 없이 접근하거나 유효하지 않은 토큰을 보내면 `401`입니다. 아직 미구현인 관리자 전용 라우트의 권한 부족 응답은 구현 시 결정합니다.

## 8. 근거 자료

- `01_기획서_v3.md` 4장(핵심 기능), 6장(기능 범위), 10장(로드맵) — 엔드포인트 범위·우선순위 근거
- `02_설계서_아키텍처_보안.md` 1장(시스템 구성), 2장(보안·개인정보 설계) — 인증 방식, 공개 라우트, 처방전 파이프라인 근거
- `03_DB_설계서.md` 2장(Supabase 스키마), 3장(Pinecone 인덱스) — 나의 약/채팅/처방전 API의 데이터 구조 근거
- 로컬 저장소 `D:\Project_KYB\smart-medication\backend` 코드 직접 확인 (2026.11.20) — `app/main.py`, `app/routers/drugs.py`, 나의 약 라우터·인증 dependency — 2~3장의 구현 상태 근거
- 로컬 `app/routers/profile.py`, `app/services/profile.py`, `app/auth.py`, `tests/test_profile.py` 직접 확인 (2026.11.24) — 3-1절 프로필 계약·인증·오류 처리·모의 테스트 범위 근거. 실제 Supabase GRANT 확인 결과를 의미하지 않음
- Supabase 공식 JWT/Signing Keys 및 API Keys 가이드 — JWKS 검증과 사용자 JWT·publishable key 헤더 조합 근거
- 로컬 `app/routers/chat.py`, `app/services/chat_evidence.py`·`gemini_chat.py`·`chat_store.py`·`interactions.py`, `app/config.py`, `app/main.py`, `supabase/migrations/0004_chat_tables.sql` 직접 확인 (2026.11.26) — 4장의 Phase 3 구현 계약·제한 근거. 실제 사용자 JWT·DB 권한·Gemini 실호출 성공을 의미하지 않음
- Google 공식 [모델](https://ai.google.dev/gemini-api/docs/models)·[가격](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)·[REST generateContent](https://ai.google.dev/api/generate-content)·[무료 서비스 약관](https://ai.google.dev/gemini-api/terms#unpaid-services) — 모델/무료 티어, REST 호출, 개인정보 제한 근거 (2026.11.26 확인)
- 5~6장의 "설계안" 항목은 실제 코드가 아니라 01~04 문서의 서술을 바탕으로 구성한 설계입니다. 실제 구현 시 이 문서와 코드를 맞춰 갱신이 필요합니다.
