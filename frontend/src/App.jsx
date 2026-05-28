import { useState } from "react";
import { useMyDrugs } from "./hooks/useMyDrugs";
import SearchPage from "./pages/SearchPage";
import InteractionPage from "./pages/InteractionPage";
import MyDrugsPage from "./pages/MyDrugsPage";

const PAGES = [
  { label: "🔍 약품 검색" },
  { label: "💊 병용금기 확인" },
  { label: "★ 나의 약" },
];

export default function App() {
  const [page, setPage] = useState(0);
  const myDrugsHook = useMyDrugs();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">💊 스마트 메디케이션</h1>
          <p className="text-sm text-gray-500">공공 DUR API 기반 약물 금기 정보 서비스</p>
        </div>

        <div className="flex rounded-2xl bg-white border border-gray-100 shadow-sm p-1 mb-5 gap-1">
          {PAGES.map((p, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-medium transition-all ${
                page === i
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p.label}
              {i === 2 && myDrugsHook.myDrugs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-400 text-white text-xs">
                  {myDrugsHook.myDrugs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {page === 0 && <SearchPage myDrugsHook={myDrugsHook} />}
        {page === 1 && <InteractionPage myDrugsHook={myDrugsHook} />}
        {page === 2 && <MyDrugsPage myDrugsHook={myDrugsHook} onGoSearch={() => setPage(0)} />}

        <p className="text-center text-xs text-gray-400 mt-6">
          식품의약품안전처 공공데이터 DUR API 기반
        </p>
      </div>
    </div>
  );
}
