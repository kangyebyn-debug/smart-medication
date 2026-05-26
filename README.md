# 스마트 메디케이션

약물 병용금기 조회 웹 서비스 — 식품의약품안전처 공공 DUR API 기반

**[라이브 데모](https://smart-medication.vercel.app)** · **[API 문서](https://smart-medication-api.onrender.com/docs)**

> ⚠️ 백엔드가 Render 무료 티어에서 동작합니다. 첫 요청은 콜드 스타트로 최대 60초 소요될 수 있습니다.

---

## 만든 이유

의료정보학을 전공하면서 임상에서 실제로 발생하는 약화(藥禍) 사례를 공부했다. 병원과 약국에는 DUR(의약품안전사용서비스) 시스템이 있어서 처방 시 병용금기 약물이 자동으로 걸러지지만, 일반인이 집에서 두 약을 함께 먹어도 되는지 확인할 방법은 마땅치 않다.

"내가 아는 도메인 지식으로 실제로 쓸 수 있는 걸 만들어보자"는 생각에서 시작했다. Python과 React를 이 프로젝트에서 처음 써봤다.

---

## 주요 기능

**약품 검색 탭**
- 상표명 입력 시 350ms 디바운스 검색 (불필요한 API 요청 최소화)
- 약품 선택 즉시 포장 이미지·전문/일반의약품 구분 표시 (금기 정보 로딩과 병렬)
- 효능·효과, 병용금기/임부금기/노인주의/연령금기 4종 금기 탭

**병용금기 확인 탭**
- 두 약품을 각각 검색하거나 '나의 약'에서 바로 선택
- 병용금기 여부와 금기 성분 상세 정보 표시

**나의 약 탭**
- `localStorage` 기반 복용 중인 약 저장 (최대 10개, 브라우저 재시작 후에도 유지)
- 2개 이상 저장 시 병용금기 확인 탭으로 바로 이동 안내

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | React 19, Vite, Tailwind CSS v4 |
| 백엔드 | Python 3.11, FastAPI, httpx |
| 데이터 | 식품의약품안전처 DUR 공공 API (XML), e약은요 API (JSON) |
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

DUR 계열 API는 XML만 지원하고, e약은요 API는 JSON을 지원한다. XML 파싱은 Python 표준 라이브러리 `xml.etree.ElementTree`로 처리했고, `resultCode == "00"` 체크와 `items` 추출을 공통 함수 하나로 묶어 각 API 함수가 항상 `list`를 반환하도록 통일했다. `asyncio.gather` 중 하나가 실패해도 나머지 결과를 그대로 쓸 수 있도록 `_safe()` 래퍼도 붙였다.

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
│                       └───► e약은요 API (JSON)      ┘
└─ GET /drugs/check    ─────► DUR 병용금기 API (XML)

FastAPI (Render)
│
└─ 공공데이터포털 (apis.data.go.kr)
```

---

## 배포 환경

| 구분 | 플랫폼 | URL |
|---|---|---|
| 프론트엔드 | Vercel | https://smart-medication.vercel.app |
| 백엔드 API | Render | https://smart-medication-api.onrender.com |
| API 문서 (Swagger) | Render | https://smart-medication-api.onrender.com/docs |

- **Vercel**: `main` 브랜치에 머지되면 자동 배포
- **Render**: `main` 브랜치에 머지되면 자동 배포 (빌드 약 3~5분 소요)
- Render 무료 티어는 15분 무요청 시 슬립 → 첫 요청 최대 60초 대기

---

## 로컬 개발

### 재부팅 후 빠른 시작 (설치가 이미 된 경우)

터미널 두 개를 열고 각각 실행합니다.

**터미널 1 — 백엔드**
```bash
cd d:/Project_KYB/smart-medication/backend
source .venv/Scripts/activate
uvicorn app.main:app --reload
```
→ http://localhost:8000 (Swagger: http://localhost:8000/docs)

**터미널 2 — 프론트엔드**
```bash
cd d:/Project_KYB/smart-medication/frontend
npm run dev
```
→ http://localhost:5173

> 로컬 프론트엔드가 로컬 백엔드를 바라보려면 `frontend/.env.local` 파일에 아래 내용이 있어야 합니다.
> ```
> VITE_API_URL=http://localhost:8000
> ```
> 이 파일이 없으면 프론트엔드는 배포된 Render 백엔드로 요청을 보냅니다.

---

### 처음 설치하는 경우

**백엔드**
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env             # .env에 SERVICE_KEY 입력
uvicorn app.main:app --reload
```

**프론트엔드**
```bash
cd frontend
npm install
npm run dev
```

### 환경 변수

`backend/.env` (git에 포함되지 않음 — 직접 생성)
```
SERVICE_KEY=공공데이터포털_발급키
```

`frontend/.env.local` (git에 포함되지 않음 — 로컬 개발 시만)
```
VITE_API_URL=http://localhost:8000
```

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/drugs/search?name={약품명}` | 상표명으로 DUR 품목 검색 |
| GET | `/drugs/image?name={약품명}` | 이미지 URL, 전문/일반 구분 |
| GET | `/drugs/warnings?name={약품명}` | 4종 금기 정보 + 효능 |
| GET | `/drugs/check?drug1={약품명}&drug2={약품명}` | 두 약품 병용금기 확인 |

자세한 요청/응답 스펙은 [Swagger UI](https://smart-medication-api.onrender.com/docs)에서 직접 확인할 수 있다.

---

## 향후 계획

- **처방전 OCR**: 처방전 사진을 찍으면 약품명을 자동으로 추출해 '나의 약' 목록에 등록 (Naver CLOVA OCR 활용)
- **HIRA 마이헬스웨이 연동**: 공동인증서/PASS 인증 기반으로 실제 처방 이력 조회
- **약-음식 상호작용**: 자몽, 우유, 알코올 등과의 주의 조합 안내

---

## 데이터 출처

모든 약물 정보는 [공공데이터포털](https://www.data.go.kr) 식품의약품안전처 DUR API를 통해 실시간 조회합니다. 데이터를 수집하거나 별도 저장하지 않습니다.

---

MIT License
