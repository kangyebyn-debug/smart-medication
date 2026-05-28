import { useState } from "react";
import { getDrugImage, getAllWarnings } from "../api";
import { WARN_TABS } from "../constants/warnings";
import { useDebounce } from "../hooks/useDebounce";
import DrugInfoCard from "../components/DrugInfoCard";
import SearchResultItem from "../components/SearchResultItem";
import WarningItem from "../components/WarningItem";
import Spinner from "../components/Spinner";

export default function SearchPage({ myDrugsHook }) {
  const [query, setQuery] = useState("");
  const [drug, setDrug] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [classNoName, setClassNoName] = useState("");
  const [loadingWarn, setLoadingWarn] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const [activeTab, setActiveTab] = useState("interaction");

  const { results, loading, clear } = useDebounce(drug ? "" : query);
  const { toggle, has } = myDrugsHook;

  async function handleSelect(d) {
    setDrug(d);
    setQuery(d.ITEM_NAME);
    setWarnings(null);
    setImageUrl("");
    setClassNoName("");
    setActiveTab("interaction");
    clear();

    setLoadingWarn(true);
    const t = setTimeout(() => setSlowServer(true), 3000);

    getDrugImage(d.ITEM_NAME).then(img => {
      setImageUrl(img.imageUrl || "");
      setClassNoName(img.classNoName || "");
    }).catch(() => {});

    try {
      const data = await getAllWarnings(d.ITEM_NAME);
      setWarnings(data);
    } catch { setWarnings(null); }
    finally {
      setLoadingWarn(false);
      clearTimeout(t);
      setSlowServer(false);
    }
  }

  function handleClear() {
    setDrug(null);
    setQuery("");
    setWarnings(null);
    setImageUrl("");
    setClassNoName("");
    clear();
  }

  const activeColor = WARN_TABS.find((t) => t.key === activeTab)?.color || "red";
  const activeItems = warnings?.[activeTab] || [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs font-semibold text-violet-600 mb-2 uppercase tracking-wide">약품명으로 검색</p>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (drug) handleClear(); }}
          placeholder="예: 탁센레이디, 타이레놀, 아스피린"
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300"
        />
        {loading && <p className="text-xs text-violet-400 mt-1.5">검색 중…</p>}
        {results.length > 0 && !drug && (
          <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
            {results.map((d, i) => (
              <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>

      {drug && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <DrugInfoCard
            drug={drug}
            imageUrl={imageUrl}
            classNoName={classNoName}
            onClear={handleClear}
            onBookmark={() => toggle(drug)}
            isBookmarked={has(drug)}
          />

          {warnings?.efficacy && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-1">효능·효과</p>
              <p className="text-xs text-gray-600 break-keep leading-relaxed">{warnings.efficacy}</p>
            </div>
          )}

          {loadingWarn && (
            <div className="mt-2">
              <Spinner label="금기 정보 불러오는 중…" />
              {slowServer && <p className="text-xs text-gray-400 text-center -mt-3">서버 시작 중입니다. 최대 60초 소요될 수 있어요.</p>}
            </div>
          )}

          {warnings && (
            <div className="mt-4">
              <div className="flex gap-0.5 border-b border-gray-100 mb-4 overflow-x-auto">
                {WARN_TABS.map((tab) => {
                  const count = warnings[tab.key]?.length || 0;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === tab.key
                          ? "border-violet-500 text-violet-700"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {tab.icon} {tab.label}
                      {count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 text-xs">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {activeItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">해당 금기 정보가 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {activeItems.map((item, i) => (
                    <WarningItem key={i} item={item} color={activeColor} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
