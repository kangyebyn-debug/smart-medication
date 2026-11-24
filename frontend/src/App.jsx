import { useState } from "react";
import { useMyDrugs } from "./hooks/useMyDrugs";
import { useAuth } from "./hooks/useAuth";
import Icon from "./components/Icon";
import HeaderAuth from "./components/HeaderAuth";
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
  const [authNotice, setAuthNotice] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const auth = useAuth();

  function requireAuthForMyDrugs() {
    setAuthNotice("나의 약을 사용하려면 로그인해주세요. 로그인 후 약품을 다시 검색해 추가할 수 있습니다.");
    setPage("auth");
    window.scrollTo(0, 0);
  }

  const myDrugsHook = useMyDrugs(auth.session, requireAuthForMyDrugs);

  function navigate(nextPage, query = "") {
    setAuthNotice(null);
    if (nextPage === "search") {
      setInitialQuery(query.trim());
      setSearchMount((value) => value + 1);
    }
    setPage(nextPage);
    window.scrollTo(0, 0);
  }

  const authLabel = auth.session ? "내 계정" : "로그인 · 회원가입";
  const navItems = NAV_ITEMS;
  const currentLabel = page === "auth" ? authLabel : navItems.find((item) => item.page === page)?.label || "홈";

  return (
    <>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      {page === "landing" ? (
        <LandingPage onNavigate={navigate} onSearch={(query) => navigate("search", query)} auth={auth} />
      ) : (
        <div className={`app-layout${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
          <aside id="app-sidebar" className="app-sidebar text-ink" aria-label="앱 내비게이션">
            <div className="sidebar-brand px-[10px] pb-[22px]">
              <button
                type="button"
                onClick={() => navigate("landing")}
                className="flex items-center gap-3 rounded-lg text-left"
                aria-label="스마트 메디케이션 랜딩으로 이동"
              >
                <span className="sidebar-brand-mark flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl text-white">
                  <Icon name="pill" size={21} />
                </span>
                <span className="sidebar-label">
                  <span className="block text-sm font-bold tracking-[-0.035em]">스마트 메디케이션</span>
                  <span className="block pt-0.5 text-[11px] text-muted">Smart Medication</span>
                </span>
              </button>
            </div>

            <nav className="sidebar-nav" aria-label="주 메뉴">
              <p className="sidebar-heading mb-3 px-3 text-[11px] font-bold text-muted">둘러보기</p>
              {navItems.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => navigate(item.page)}
                  aria-current={page === item.page ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={`sidebar-nav-item flex w-full items-center gap-3 rounded-full px-[14px] py-[11px] text-left text-[14.5px] font-semibold transition-colors ${
                    page === item.page
                      ? "sidebar-nav-active bg-brand text-white"
                      : "text-ink hover:bg-white/75"
                  }`}
                >
                  <Icon name={item.icon} size={19} className="shrink-0" />
                  <span className="sidebar-label">{item.label}</span>
                  {item.page === "my-drugs" && auth.session && myDrugsHook.myDrugs.length > 0 && (
                    <span className="sidebar-label ml-auto rounded-full bg-white/40 px-1.5 py-0.5 text-[11px]">{myDrugsHook.myDrugs.length}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="sidebar-aside mt-4">
              <div className="sidebar-promo rounded-[18px] border p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-dark">
                  <Icon name="sparkles" size={16} />
                  복약 질문 AI
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">내 약을 바탕으로 질문하는 기능을 준비하고 있습니다.</p>
                <span className="mt-3 inline-block rounded-full bg-brand/10 px-2.5 py-1 text-[11px] text-brand-dark">준비 중</span>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-collapse mt-auto items-center justify-center gap-2 rounded-full border p-[10px] text-[13px] text-muted transition-colors hover:border-brand hover:text-brand"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              aria-expanded={!sidebarCollapsed}
              aria-controls="app-sidebar"
              title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            >
              <Icon name="chevronRight" size={16} className={sidebarCollapsed ? "" : "rotate-180"} />
              <span className="sidebar-label">접기</span>
            </button>
            <p className="sidebar-footer px-3 pt-5 text-[11px] text-muted">공공 의약품 정보 기반</p>
          </aside>

          <div className="app-main min-w-0">
            <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <span>스마트 메디케이션</span>
                <Icon name="chevronRight" size={14} />
                <span className="font-semibold text-ink">{currentLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <HeaderAuth auth={auth} onSignIn={() => navigate("auth")} onOpenAccount={() => navigate("auth")} />
              </div>
            </header>

            <main id="main-content" className={`w-full px-5 py-7 sm:px-8 sm:pb-[60px] sm:pt-9 ${page === "home" ? "max-w-none" : page === "auth" ? "mx-auto max-w-[1150px]" : "max-w-[1150px]"}`}>
              {page === "home" && (
                <HomePage myDrugsHook={myDrugsHook} signedIn={Boolean(auth.session)} onNavigate={navigate} />
              )}
              {page === "search" && (
                <SearchPage key={searchMount} myDrugsHook={myDrugsHook} initialQuery={initialQuery} />
              )}
              {page === "compare" && (
                <InteractionPage key={auth.session?.user?.id ?? "anonymous"} myDrugsHook={myDrugsHook} />
              )}
              {page === "my-drugs" && (
                auth.session
                  ? <MyDrugsPage myDrugsHook={myDrugsHook} onGoSearch={() => navigate("search")} />
                  : <AuthPage auth={auth} myDrugsHook={myDrugsHook} notice={auth.loading ? null : "나의 약을 사용하려면 로그인해주세요."} />
              )}
              {page === "auth" && <AuthPage auth={auth} myDrugsHook={myDrugsHook} notice={authNotice} />}
            </main>
          </div>
        </div>
      )}
    </>
  );
}
