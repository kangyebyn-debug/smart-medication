# 💊 스마트 메디케이션

약물 병용금기 확인 서비스 — 식품의약품안전처 공공 DUR API 기반

**[🔗 라이브 데모](https://smart-medication.vercel.app)** · **[📡 API 문서](https://smart-medication-api.onrender.com/docs)**

---

## 주요 기능

- **약품 검색**: 상표명으로 DUR 등재 의약품 검색
- **병용금기 확인**: 두 약품을 선택하면 병용금기 여부 즉시 조회
- **상세 정보 표시**: 금기 성분명 및 금기 사유 출력

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | React 19, Vite 8, Tailwind CSS v4 |
| 백엔드 | Python 3.11, FastAPI, httpx |
| 데이터 | 식품의약품안전처 DUR 공공 API (XML 파싱) |
| 배포 | Vercel (프론트) · Render (백엔드) |

## 로컬 실행

### 백엔드

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env            # SERVICE_KEY 입력
uvicorn app.main:app --reload
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

## 환경 변수

**backend/.env**
```
SERVICE_KEY=공공데이터포털_발급키
```

**frontend/.env.local** (로컬 개발 시)
```
VITE_API_URL=http://localhost:8000
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/drugs/search?name={약품명}` | 상표명 검색 |
| GET | `/drugs/interaction?name={약품명}` | 병용금기 목록 조회 |
| GET | `/drugs/check?drug1={약품명}&drug2={약품명}` | 두 약품 병용금기 확인 |

## 데이터 출처

본 서비스의 모든 데이터는 [공공데이터포털](https://www.data.go.kr)에서 제공하는 식품의약품안전처 DUR API를 통해 실시간으로 조회합니다.
