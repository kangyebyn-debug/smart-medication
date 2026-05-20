import { useState } from "react";
import { searchDrug, checkInteraction } from "./api";

function DrugCard({ drug, onSelect }) {
  return (
    <div
      className="flex items-start justify-between p-4 rounded-xl border border-gray-200 bg-white hover:border-violet-300 transition-colors cursor-pointer"
      onClick={() => onSelect(drug)}
    >
      <div className="text-left min-w-0">
        <p className="font-semibold text-gray-800 text-sm break-keep">{drug.ITEM_NAME}</p>
        <p className="text-xs text-gray-500 mt-0.5 break-keep">{drug.ENTP_NAME}</p>
        <p className="text-xs text-gray-400 mt-1 break-keep">{drug.MATERIAL_NAME}</p>
      </div>
      <span className="ml-3 shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        {drug.TYPE_NAME || "의약품"}
      </span>
    </div>
  );
}

function SearchPanel({ label, onDrugSelected, selected }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const data = await searchDrug(query.trim());
      setResults(data.items || []);
      if ((data.items || []).length === 0) setError("검색 결과가 없습니다.");
    } catch {
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-violet-600 mb-2 uppercase tracking-wide">{label}</p>

      {selected && (
        <div className="mb-3 p-3 rounded-xl bg-violet-100 border border-violet-300 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-violet-800 text-sm break-keep">{selected.ITEM_NAME}</p>
            <p className="text-xs text-violet-500 break-keep">{selected.ENTP_NAME}</p>
          </div>
          <button
            onClick={() => { onDrugSelected(null); setResults([]); }}
            className="text-violet-400 hover:text-violet-700 text-xl leading-none ml-2"
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="약품명 입력 (예: 탁센레이디)"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "검색"}
        </button>
      </form>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {results.length > 0 && !selected && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {results.map((drug, i) => (
            <DrugCard
              key={drug.ITEM_SEQ || i}
              drug={drug}
              onSelect={onDrugSelected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [drug1, setDrug1] = useState(null);
  const [drug2, setDrug2] = useState(null);
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  async function handleCheck() {
    if (!drug1 || !drug2) return;
    setChecking(true);
    setResult(null);
    setCheckError("");
    try {
      const data = await checkInteraction(drug1.ITEM_NAME, drug2.ITEM_NAME);
      setResult(data);
    } catch {
      setCheckError("병용금기 조회 중 오류가 발생했습니다.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">💊 스마트 메디케이션</h1>
          <p className="text-gray-500 text-sm">약물 병용금기 확인 서비스 · 공공 DUR API 기반</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
            <SearchPanel label="약품 1" onDrugSelected={setDrug1} selected={drug1} />
            <div className="hidden sm:flex items-center text-gray-300 text-2xl">⇆</div>
            <SearchPanel label="약품 2" onDrugSelected={setDrug2} selected={drug2} />
          </div>

          <button
            onClick={handleCheck}
            disabled={!drug1 || !drug2 || checking}
            className="mt-6 w-full py-3 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? "조회 중..." : "병용금기 확인하기"}
          </button>
        </div>

        {checkError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {checkError}
          </div>
        )}

        {result && (
          <div
            className={`rounded-2xl border p-6 ${
              result.is_prohibited
                ? "border-red-300 bg-red-50"
                : "border-green-300 bg-green-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{result.is_prohibited ? "⚠️" : "✅"}</span>
              <p className={`font-bold text-lg ${result.is_prohibited ? "text-red-700" : "text-green-700"}`}>
                {result.is_prohibited ? "병용금기 약물입니다" : "병용금기 아님"}
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{result.drug1}</span>
              {" + "}
              <span className="font-medium">{result.drug2}</span>
            </p>
            {result.message && (
              <p className="text-sm text-gray-500">{result.message}</p>
            )}

            {result.is_prohibited && result.interactions?.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">병용금기 상세</p>
                {result.interactions.map((item, i) => (
                  <div key={i} className="bg-white rounded-xl border border-red-200 p-3 text-sm">
                    <p className="font-medium text-gray-700 mb-1">
                      {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
                    </p>
                    {item.PROHBT_CONTENT && (
                      <p className="text-xs text-gray-500">{item.PROHBT_CONTENT}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          본 서비스는 식품의약품안전처 공공데이터 DUR API를 기반으로 합니다.
        </p>
      </div>
    </div>
  );
}
