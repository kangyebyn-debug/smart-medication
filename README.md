# 스마트 메디케이션

약품 상세정보·병용금기 조회 웹 서비스 — 식품의약품안전처 공공 API 기반

**[라이브 데모](https://smart-medication.vercel.app)** · **[API 문서](https://smart-medication-api.onrender.com/docs)**

> **현재 코드 기준 (2026.11.26):** Phase 1 약 상세정보 보강·Phase 1-1 UI 리디자인에 이어, Phase 2 Supabase 로그인·나의 약 계정 저장과 Phase 3 등록약 기반 복약 질문 AI 채팅 화면·API가 구현되어 있습니다. 아래 기능 설명은 로컬 코드를 기준으로 합니다.
>
> **배포 확인 (2026.11.26):** 라이브 데모는 HTTP 200으로 열리고, 복약 질문 AI 시작 버튼과 비로그인 시 로그인 화면 안내가 반영되어 있습니다. API 문서는 Render 콜드 스타트의 일시적인 503 이후 200으로 열렸으며, 채팅 API 4개와 미인증 세션 목록 조회의 401 응답을 확인했습니다.
>
> **로그인·채팅 검증 (2026.11.27, 사용자 확인):** 사용자가 Vercel에 누락된 `VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`를 추가하고 재배포해 로그인 설정 오류를 해결했으며, 라이브 데모에서 실제 로그인·복약 질문 AI 채팅 응답까지 정상 동작함을 확인했습니다.
>
> ⚠️ 백엔드가 Render 무료 티어에서 동작합니다. 첫 요청은 콜드 스타트로 최대 60초 소요될 수 있습니다.

---

## 만든 이유

의료정보과를 전공하며 의학 용어·원무관리·개발을 함께 배웠다. 전공 때문인지 주변에서 약에 대해 묻는 경우가 종종 있었는데, 정작 전공에서는 임상이나 약화(藥禍) 사례를 다루지 않아 정확히 답하기 어려웠다. 아는 척하는 대신 실제 공공 데이터로 확인할 수 있는 걸 만들어보자는 생각에서 시작했다.

"내가 아는 도메인 지식으로 실제로 쓸 수 있는 걸 만들어보자"는 생각에서 시작했다. Python과 React를 이 프로젝트에서 처음 써봤다.

---

## 주요 기능

첫 화면은 서비스 소개 랜딩입니다. "바로 시작하기"의 기능 카드로 약품 검색·병용금기 확인·나의 약 화면에 진입하고, 복약 질문 AI 배너의 시작 버튼으로 채팅에 진입합니다. 데스크톱에서는 상시 사이드바, 좁은 화면에서는 상단 메뉴로 이동하며, 앱 홈에서도 검색·병용금기 확인·나의 약으로 이동할 수 있습니다. 약품 검색·병용금기 확인은 로그인 없이 사용할 수 있고, 나의 약·복약 질문 AI는 로그인이 필요합니다.

**약품 검색 화면**
- 상표명 입력 시 350ms 디바운스 검색 (불필요한 API 요청 최소화)
- 검색 실패는 정상적인 검색 결과 0건과 구분해 알리고, 같은 검색어로 다시 시도할 수 있음
- 약품 선택 즉시 포장 이미지·전문/일반의약품 구분 표시 (금기 정보 로딩과 병렬)
- 효능·효과와 용법·용량 일반 안내, 병용금기/임부금기/노인주의/연령금기 4종 금기 탭
- e약은요에 상세정보가 없는 품목은 공식 의약품 제품 허가정보 API에서 같은 품목코드의 효능·용법을 조회

**병용금기 확인 화면**
- 두 약품을 각각 검색하거나 '나의 약'에서 바로 선택
- 조회된 범위의 병용금기 항목과 금기 성분 상세 정보 표시 (항목이 없어도 복용 안전성을 확정하지 않음)

**나의 약 화면**
- Supabase 로그인 후 백엔드 `/me/drugs` API를 통해 약품명·품목코드를 계정별로 저장·조회·삭제하며, 다른 기기에서도 같은 계정으로 조회 가능
- 2개 이상 저장 시 모든 두 약 조합을 일괄 조회하고, 조회 실패는 미확인으로 구분

**복약 질문 AI 채팅 화면**

- 로그인한 계정의 최신 생성 세션을 재사용하고, 세션이 없으면 생성하여 저장된 질문·응답 이력을 표시
- 질문마다 서버가 "나의 약"을 조회하고 모든 두 약 조합의 실제 공공 DUR 병용금기 조회 결과를 수집한 뒤, Gemini가 그 근거를 자연어로 설명
- 등록약이 2개 미만이면 DUR·Gemini를 호출하지 않고 비교할 약을 더 등록하라는 안내 표시
- 전송 중 입력 잠금·로딩 표시, 인증 만료·요청 한도·서비스 오류의 한국어 안내와 대화 재조회 제공
- 조회 결과는 의학적 진단이나 개인의 복용 안전성 보장이 아니며, 서버 응답의 면책 문구를 중복 없이 표시
- Gemini 무료 티어 검증에는 개인정보 없는 가상 약 목록·가상 질문만 사용하며, 실제 개인 건강정보를 보내지 않음

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | React 19, Vite, Tailwind CSS v4 |
| 백엔드 | Python 3.11, FastAPI, httpx |
| 데이터 | 식품의약품안전처 DUR 공공 API (XML), e약은요·의약품 제품 허가정보 API (JSON) |
| 배포 | Vercel (프론트) · Render (백엔드) |

httpx를 쓴 이유는 Python의 `requests`가 동기 라이브러리라 FastAPI의 `async def`와 같이 쓰면 이벤트 루프를 블로킹하기 때문이다. `asyncio.gather`로 4개의 API를 병렬 호출하려면 비동기 HTTP 클라이언트가 필수였다.

---

## 설계에서 고민한 것들

### 이미지가 너무 늦게 나타나는 문제

처음에는 `/drugs/warnings` 하나에서 이미지 URL과 4종 금기 정보를 모두 반환했다. `asyncio.gather`로 5개 API를 동시에 호출하는데도 응답이 오래 걸렸고, 결국 이미지가 금기 탭과 동시에 뒤늦게 나타났다.

해결 방법은 이미지 전용 엔드포인트를 분리하는 것이었다. `/drugs/image`는 e약은요 API 하나만 호출해서 빠르고, 프론트엔드에서 약품 선택 직후 non-blocking `.then()`으로 먼저 요청한다. 금기 정보는 별도 `await`로 처리한다.

```
약품 선택
  ├── getDrugImage()    .then() → 이미지 먼저 표시
  └── getAllWarnings()   await  → 금기 탭은 천천히
```

### 공공 API의 XML/JSON 혼재

DUR 계열 API는 XML, e약은요·의약품 제품 허가정보 API는 JSON을 사용한다. XML 파싱은 Python 표준 라이브러리 `xml.etree.ElementTree`로 처리한다. DUR 오류 응답은 유효한 빈 조회와 구별하고, `/drugs/warnings`의 4종 금기 조회는 일부가 실패해도 각 상태를 `warningStatus`로 반환한다. 제품 허가정보 안의 문서형 XML은 문단 텍스트만 추출해 표시한다.

### 전문/일반의약품 구분 필드 혼동

DUR API에 `TYPE_NAME`이라는 필드가 있어서 여기에 "전문의약품" 같은 값이 들어있을 것 같았지만, 실제로는 DUR 내부 분류 코드라 쓸 수 없었다. 한참 디버깅하다가 API 명세를 다시 읽어보니 `ETC_OTC_CODE` 필드가 실제 전문/일반 구분값이었다. 결국 e약은요 API의 `classNoName` 필드를 우선 사용하고 없으면 `ETC_OTC_CODE`로 폴백하는 방식으로 처리했다.

---

## 아키텍처

```
React SPA (Vercel)
│
├─ GET /drugs/search   ─────► DUR 품목정보 API (XML)
├─ GET /drugs/image    ─────► e약은요 API (JSON)  ← 이미지만, 빠름
├─ GET /drugs/warnings ─┬───► DUR 병용금기 API (XML)  ┐
│                       ├───► DUR 임부금기 API (XML)  │ asyncio.gather
│                       ├───► DUR 노인주의 API (XML)  │
│                       ├───► DUR 연령금기 API (XML)  │
│                       ├───► e약은요 API (JSON)      ┘
│                       └───► 제품 허가정보 API (상세정보가 없을 때만)
└─ GET /drugs/check    ─────► DUR 병용금기 API (XML)

FastAPI (Render)
│
└─ 공공데이터포털 (apis.data.go.kr)
```

---

## 로컬 실행

### 백엔드

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
test -f .env || cp .env.example .env  # .env가 없을 때만 복사하고 SERVICE_KEY 입력
uvicorn app.main:app --reload
# http://localhost:8000/docs 에서 API 확인
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
# 기본 API 주소는 http://localhost:8000, 다른 주소를 쓰면 .env.local에 VITE_API_URL 설정
```

### 환경 변수

`backend/.env`
```
SERVICE_KEY=공공데이터포털_발급키
```

`frontend/.env.local` (로컬 개발 시만)
```
VITE_API_URL=http://localhost:8000
```

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/drugs/search?name={약품명}` | 상표명으로 DUR 품목 검색 |
| GET | `/drugs/image?name={약품명}&item_seq={품목코드}` | 이미지 URL, 전문/일반 구분 (`item_seq` 선택) |
| GET | `/drugs/warnings?name={약품명}&item_seq={품목코드}` | 4종 금기 정보 + 효능·용법 (`item_seq` 선택) |
| GET | `/drugs/check?drug1={약품명}&drug2={약품명}` | 두 약품 병용금기 확인 |

현재 로컬 코드의 요청/응답 스펙은 백엔드를 실행한 뒤 `http://localhost:8000/docs`에서 확인할 수 있다. 공개 [Swagger UI](https://smart-medication-api.onrender.com/docs)는 배포 상태를 확인한 뒤 비교한다.

---

## 향후 계획

Supabase Auth·나의 약 계정 동기화(Phase 2)와 등록약의 실제 DUR 근거를 설명하는 복약 질문 AI 채팅 화면·API(Phase 3)는 구현되어 있습니다. 다음 단계는 전체 공공 의약품 대상 RAG 확장(Phase 4)이며, 이후 처방전 OCR 순서로 진행합니다. 현재 채팅은 RAG·전체 의약품 검색이나 과거 대화 맥락을 활용한 추론을 제공하지 않습니다. 라이브 데모의 로그인·채팅도 2026.11.27 사용자 확인으로 검증되었습니다. 자세한 순서는 [기획서](docs/01_기획서_v3.md) 10장을 참고하세요. HIRA 투약이력 연동은 기관 등록 가능 여부를 확인할 때까지 장기 과제로 보류합니다.

---

## 데이터 출처

약품 검색과 금기 정보는 [공공데이터포털](https://www.data.go.kr)의 식품의약품안전처 DUR API에서 실시간 조회합니다. 상세정보는 e약은요 및 의약품 제품 허가정보 API에서 가져옵니다. 현재 약품 데이터를 별도 DB에 저장하지 않습니다.

---

MIT License
