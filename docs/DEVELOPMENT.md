# 개발 환경 가이드

로컬 실행, 환경변수 설정, 배포 절차를 정리한 문서입니다.

---

## 배포 URL

| 구분 | URL |
|---|---|
| 프론트엔드 (Vercel) | https://smart-medication.vercel.app |
| 백엔드 API (Render) | https://smart-medication-api.onrender.com |
| API 문서 Swagger | https://smart-medication-api.onrender.com/docs |

> Render 무료 티어는 15분 동안 요청이 없으면 슬립 상태로 전환됩니다.
> 슬립 후 첫 요청은 최대 60초 소요될 수 있습니다.

---

## 로컬 실행

터미널 두 개를 열고 각각 실행합니다.

### 재부팅 후 빠른 시작 (설치가 이미 된 경우)

**터미널 1 — 백엔드**

```bash
cd d:/Project_KYB/smart-medication/backend
source .venv/Scripts/activate
uvicorn app.main:app --reload
```

실행 후 → http://localhost:8000/docs 에서 Swagger UI 확인

**터미널 2 — 프론트엔드**

```bash
cd d:/Project_KYB/smart-medication/frontend
npm run dev
```

실행 후 → http://localhost:5173

---

### 처음 설치하는 경우

**백엔드**

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env               # 아래 환경변수 섹션 참고
uvicorn app.main:app --reload
```

**프론트엔드**

```bash
cd frontend
npm install
npm run dev
```

---

## 환경변수

두 파일 모두 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다. 직접 생성해야 합니다.

### `backend/.env`

```
SERVICE_KEY=공공데이터포털_발급키
```

- 발급처: https://www.data.go.kr → 회원가입 → 아래 API 신청
  - 식품의약품안전처_의약품안전사용서비스(DUR)품목정보
  - 식품의약품안전처_의약품개요정보(e약은요)
- 승인까지 1~2일 소요 (자동 승인되는 경우도 있음)

### `frontend/.env.local`

```
VITE_API_URL=http://localhost:8000
```

이 파일이 없으면 프론트엔드는 배포된 Render 백엔드로 요청합니다.
로컬 백엔드와 연동해서 개발할 때만 필요합니다.

---

## 배포 절차

`main` 브랜치에 머지되면 Vercel과 Render가 각각 자동으로 배포합니다.
직접 배포 버튼을 누를 필요가 없습니다.

| 플랫폼 | 트리거 | 소요 시간 |
|---|---|---|
| Vercel (프론트) | main 머지 즉시 | 약 1분 |
| Render (백엔드) | main 머지 즉시 | 약 3~5분 |

배포 상태 확인:
- Vercel: https://vercel.com/dashboard
- Render: https://dashboard.render.com

---

## Git 브랜치 전략

```
main              ← 항상 배포 가능. 직접 커밋 금지.
  └─ feat/{이름}   새 기능
  └─ fix/{이름}    버그 수정
  └─ docs/{이름}   문서만
  └─ refactor/{이름}  리팩토링
```

작업 순서: `main`에서 분기 → 작업 → PR → 머지 → 브랜치 삭제

머지된 브랜치는 삭제해도 PR 기록과 `git log --graph`에 이력이 남습니다.
