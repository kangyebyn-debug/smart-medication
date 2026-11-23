import { useState } from "react";
import Icon from "../components/Icon";
import HeroIllustration from "../components/HeroIllustration";
import HeaderAuth from "../components/HeaderAuth";

const actions = [
  {
    page: "search",
    icon: "search",
    title: "약품 검색",
    description: "제품명으로 효능·용법과 주의사항을 찾아보세요.",
  },
  {
    page: "compare",
    icon: "compare",
    title: "병용금기 확인",
    description: "두 약을 선택해 공공 DUR에 등록된 금기 항목을 조회하세요.",
  },
  {
    page: "my-drugs",
    icon: "bookmark",
    title: "나의 약",
    description: "계정에 저장한 약을 모아보고 조합을 확인하세요.",
  },
];

const steps = [
  {
    number: "01",
    title: "약 이름 검색",
    description: "궁금한 약의 제품명을 입력해 목록을 찾습니다.",
    preview: "제품명을 입력하면 검색 결과로 이어집니다.",
    icon: "search",
  },
  {
    number: "02",
    title: "제품 선택",
    description: "제품명과 제조사를 확인해 해당 품목을 선택합니다.",
    preview: "비슷한 이름의 약도 있으니 제품명과 제조사를 함께 확인하세요.",
    icon: "pill",
  },
  {
    number: "03",
    title: "결과 읽기",
    description: "효능·용법과 금기 항목을 확인하세요.",
    preview: "항목이 없어도 복용 안전성이 확정되는 것은 아닙니다.",
    icon: "shield",
  },
];

export default function LandingPage({ onNavigate, onSearch, auth }) {
  const [query, setQuery] = useState("");
  const [activeStep, setActiveStep] = useState(0);

  function submitSearch(event) {
    event.preventDefault();
    const name = query.trim();
    if (name) onSearch(name);
  }

  function handleStepKeyDown(event, index) {
    let next;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % steps.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + steps.length) % steps.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = steps.length - 1;
    else return;

    event.preventDefault();
    setActiveStep(next);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return (
    <main id="main-content" className="min-h-screen break-keep bg-surface text-ink">
      <div className="border-b border-line bg-white">
        <header className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
              <Icon name="pill" size={21} />
            </span>
            <span className="text-base font-bold tracking-[-0.035em]">스마트 메디케이션</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("home")}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-mint sm:text-sm"
            >
              서비스 둘러보기
              <Icon name="arrowRight" size={17} />
            </button>
            <HeaderAuth auth={auth} onSignIn={() => onNavigate("auth")} />
          </div>
        </header>
      </div>

      <section className="landing-hero relative overflow-hidden border-b border-line">
        <HeroIllustration />
        <div className="relative mx-auto max-w-[1320px] px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:px-12">
          <div className="max-w-[780px]">
            <p className="mb-6 inline-flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              공공 의약품 정보로 확인하는 첫걸음
            </p>
            <h1 className="text-[clamp(2.3rem,6vw,5.4rem)] leading-[1.16] font-black tracking-[-0.075em] text-ink">
              함께 먹는 약,<br />
              <span className="text-brand">먼저 확인하세요.</span>
            </h1>
            <p className="mt-7 max-w-[580px] text-base leading-8 text-muted sm:text-lg">
              약 이름으로 효능과 용법을 찾고, 두 약 사이의 병용금기 항목을 조회할 수 있습니다.
              검색과 확인에는 로그인이 필요하지 않습니다.
            </p>

            <form onSubmit={submitSearch} className="mt-10 max-w-[720px]" role="search">
              <label htmlFor="landing-drug-name" className="mb-3 block text-sm font-semibold text-ink">
                어떤 약이 궁금한가요?
              </label>
              <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-2 shadow-[0_16px_45px_rgba(23,36,31,0.08)] focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 sm:flex-row sm:items-center sm:gap-0">
                <Icon name="search" size={22} className="ml-4 hidden shrink-0 text-brand sm:block" />
                <input
                  id="landing-drug-name"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="약 이름을 입력하세요. 예: 타이레놀"
                  autoComplete="off"
                  required
                  className="min-w-0 flex-1 rounded-xl px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:outline-none sm:py-2"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] bg-brand px-6 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
                >
                  약품 검색
                  <Icon name="arrowRight" size={18} />
                </button>
              </div>
            </form>
            <p className="mt-4 flex items-start gap-2 text-base leading-7 text-muted">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              조회 결과는 공공자료의 확인 범위이며, 개인의 복용 안전성을 확정하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white" aria-labelledby="landing-how-title">
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
          <p className="text-xs font-bold tracking-[0.16em] text-brand">사용 방법</p>
          <h2 id="landing-how-title" className="mt-2 text-2xl font-bold tracking-[-0.045em] text-ink sm:text-3xl">
            세 단계로 확인하세요
          </h2>
          <div role="tablist" aria-label="약품 정보 확인 단계" className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {steps.map((step, index) => (
              <button
                key={step.number}
                id={`landing-step-${index}`}
                type="button"
                role="tab"
                aria-selected={activeStep === index}
                aria-controls="landing-step-panel"
                tabIndex={activeStep === index ? 0 : -1}
                onClick={() => setActiveStep(index)}
                onKeyDown={(event) => handleStepKeyDown(event, index)}
                className={`border-t-2 pt-5 text-left transition-colors ${activeStep === index ? "border-brand" : "border-line hover:border-brand/50"}`}
              >
                <span className="block text-xs font-bold tracking-[0.12em] text-brand">{step.number}</span>
                <span className="mt-3 block text-base font-bold text-ink">{step.title}</span>
                <span className="mt-2 block text-base leading-7 text-muted">{step.description}</span>
              </button>
            ))}
          </div>
          <div
            id="landing-step-panel"
            role="tabpanel"
            aria-labelledby={`landing-step-${activeStep}`}
            tabIndex={0}
            className="mt-7 rounded-2xl border border-line bg-surface p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-brand">
                <Icon name={steps[activeStep].icon} size={22} />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-brand">STEP {steps[activeStep].number}</p>
                <h3 className="mt-0.5 text-base font-bold text-ink">{steps[activeStep].title}</h3>
              </div>
            </div>
            <p className="mt-4 text-base leading-7 text-muted">{steps[activeStep].preview}</p>
            {activeStep === 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3 text-base">
                <Icon name="search" size={18} className="text-brand" />
                <span className="min-w-0 flex-1 text-muted">예: 타이레놀</span>
                <span className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">검색</span>
              </div>
            )}
            {activeStep === 1 && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-white p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint text-brand"><Icon name="pill" size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-ink">제품명 확인</p>
                  <p className="mt-0.5 text-base text-muted">제조사와 품목도 함께 비교</p>
                </div>
                <Icon name="chevronRight" size={17} className="shrink-0 text-brand" />
              </div>
            )}
            {activeStep === 2 && (
              <div className="mt-5 flex flex-wrap gap-2" aria-label="확인할 정보">
                {["효능·효과", "용법·용량", "금기·주의"].map((label) => (
                  <span key={label} className="rounded-lg border border-[#D8EFE1] bg-white px-3 py-2 text-xs font-semibold text-brand-dark">{label}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20" aria-labelledby="landing-actions-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-brand">바로 시작하기</p>
            <h2 id="landing-actions-title" className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:text-3xl">
              필요한 정보부터 찾아보세요
            </h2>
          </div>
          <p className="text-base text-muted">공개 조회 기능은 로그인 없이 사용할 수 있습니다.</p>
        </div>
        <div className="feature-grid">
          {actions.map((action) => (
            <button
              key={action.page}
              type="button"
              onClick={() => onNavigate(action.page)}
              className="elevated-card group flex min-h-56 flex-col items-start rounded-2xl border border-line bg-white p-6 text-left"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint text-brand">
                <Icon name={action.icon} size={23} />
              </span>
              <span className="mt-7 text-lg font-bold tracking-[-0.035em] text-ink">{action.title}</span>
              <span className="mt-2 text-base leading-7 text-muted">{action.description}</span>
              <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-semibold text-brand">
                이동하기 <Icon name="chevronRight" size={16} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 lg:px-12 lg:pb-24" aria-labelledby="ai-preview-title">
        <div className="flex flex-wrap items-center justify-between gap-10 rounded-[24px] bg-sidebar px-7 py-9 text-white sm:px-10 sm:py-11">
          <div className="max-w-[650px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/75">
              <Icon name="sparkles" size={14} />
              개발 중인 기능
            </div>
            <h2 id="ai-preview-title" className="text-2xl font-bold tracking-[-0.04em] sm:text-3xl">복약 질문 AI</h2>
            <p className="mt-3 text-base leading-7 text-white/70">
              등록한 약을 기준으로 구어체 질문에 답하고 공공자료의 근거를 함께 보여주는 기능을 준비하고 있습니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
            <Icon name="info" size={17} />
            준비 중
          </span>
        </div>
      </section>

      <footer className="border-t border-line bg-white px-5 py-6 text-center text-xs text-muted">
        스마트 메디케이션 · 공공 의약품 정보를 이해하기 쉽게 확인하는 개인 프로젝트
      </footer>
    </main>
  );
}
