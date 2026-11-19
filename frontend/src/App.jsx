import { useState } from "react";
import { useMyDrugs } from "./hooks/useMyDrugs";
import { useAuth } from "./hooks/useAuth";
import Icon from "./components/Icon";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import InteractionPage from "./pages/InteractionPage";
import MyDrugsPage from "./pages/MyDrugsPage";
import AuthPage from "./pages/AuthPage";

const NAV_ITEMS = [
  { page: "home", label: "홈", icon: "home" },
  { page: "search", label: "약품 검색", icon: "search" },
  { page: "compare", label: "병용금기 확인", icon: "compare" },
  { page: "my-drugs", label: "나의 약", icon: "bookmark" },
];

export default function App() {
  const [page, setPage] = useState("landing");
  const [initialQuery, setInitialQuery] = useState("");
  const [searchMount, setSearchMount] = useState(0);
  const auth = useAuth();
  const myDrugsHook = useMyDrugs();

  function navigate(nextPage, query = "") {
    if (nextPage === "search") {
      setInitialQuery(query.trim());
      setSearchMount((value) => value + 1);
    }
    setPage(nextPage);
    window.scrollTo(0, 0);
  }

  const authLabel = auth.session ? "내 계정" : "로그인 · 회원가입";
  const navItems = [...NAV_ITEMS, { page: "auth", label: authLabel, icon: "user" }];
  const currentLabel = navItems.find((item) => item.page === page)?.label || "홈";

  return (
    <>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      {page === "landing" ? (
        <LandingPage onNavigate={navigate} onSearch={(query) => navigate("search", query)} isSignedIn={Boolean(auth.session)} />
      ) : (
        <div className="app-layout bg-[#F6F8F7]">
          <aside className="app-sidebar bg-sidebar text-white" aria-label="앱 내비게이션">
            <div className="sidebar-brand border-b border-white/10 p-6">
              <button
                type="button"
                onClick={() => navigate("landing")}
                className="flex items-center gap-3 rounded-lg text-left"
                aria-label="스마트 메디케이션 랜딩으로 이동"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
                  <Icon name="pill" size={21} />
                </span>
                <span>
                  <span className="block text-sm font-bold tracking-[-0.035em]">스마트 메디케이션</span>
                  <span className="block pt-0.5 text-[11px] text-white/50">Smart Medication</span>
                </span>
              </button>
            </div>

            <nav className="sidebar-nav px-3 py-6" aria-label="주 메뉴">
              <p className="sidebar-heading mb-3 px-3 text-[11px] font-bold tracking-[0.14em] text-white/40">둘러보기</p>
              {navItems.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => navigate(item.page)}
                  aria-current={page === item.page ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${
                    page === item.page
                      ? "bg-brand text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon name={item.icon} size={19} className="shrink-0" />
                  <span>{item.label}</span>
                  {item.page === "my-drugs" && myDrugsHook.myDrugs.length > 0 && (
                    <span className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 text-[11px]">{myDrugsHook.myDrugs.length}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="sidebar-aside mt-auto px-5 pb-5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                  <Icon name="sparkles" size={16} />
                  복약 질문 AI
                </div>
                <p className="mt-2 text-xs leading-5 text-white/50">내 약을 바탕으로 질문하는 기능을 준비하고 있습니다.</p>
                <span className="mt-3 inline-block rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/65">준비 중</span>
              </div>
            </div>
            <p className="sidebar-footer border-t border-white/10 px-6 py-5 text-[11px] text-white/40">공공 의약품 정보 기반</p>
          </aside>

          <div className="app-main min-w-0">
            <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-4 sm:px-8 lg:px-10">
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <span>스마트 메디케이션</span>
                <Icon name="chevronRight" size={14} />
                <span className="font-semibold text-ink">{currentLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-xs text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  공공 데이터 실시간 조회
                </span>
                <button type="button" onClick={() => navigate("auth")} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-brand transition-colors hover:border-brand hover:bg-mint">
                  <Icon name="user" size={16} />{authLabel}
                </button>
              </div>
            </header>

            <main id="main-content" className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
              {page === "home" && (
                <HomePage myDrugs={myDrugsHook.myDrugs} onNavigate={navigate} />
              )}
              {page === "search" && (
                <SearchPage key={searchMount} myDrugsHook={myDrugsHook} initialQuery={initialQuery} />
              )}
              {page === "compare" && (
                <InteractionPage myDrugsHook={myDrugsHook} />
              )}
              {page === "my-drugs" && (
                <MyDrugsPage myDrugsHook={myDrugsHook} onGoSearch={() => navigate("search")} />
              )}
              {page === "auth" && <AuthPage auth={auth} />}
            </main>
          </div>
        </div>
      )}
    </>
  );
}
