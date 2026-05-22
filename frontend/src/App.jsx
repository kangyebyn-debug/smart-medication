import { useState, useEffect, useRef } from "react";
import { searchDrug, getDrugImage, getAllWarnings, checkInteraction } from "./api";

// ─── 상수 ──────────────────────────────────────────────────────────────────
const WARN_TABS = [
  { key: "interaction", label: "병용금기", icon: "⚠️", color: "red" },
  { key: "pregnancy",   label: "임부금기", icon: "🤰", color: "pink" },
  { key: "elderly",     label: "노인주의", icon: "👴", color: "amber" },
  { key: "age",         label: "연령금기", icon: "👶", color: "blue" },
];
const COLOR = {
  red:   { wrap: "border-red-100 bg-red-50",    text: "text-red-600",   badge: "bg-red-100 text-red-700" },
  pink:  { wrap: "border-pink-100 bg-pink-50",   text: "text-pink-600",  badge: "bg-pink-100 text-pink-700" },
  amber: { wrap: "border-amber-100 bg-amber-50", text: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  blue:  { wrap: "border-blue-100 bg-blue-50",   text: "text-blue-600",  badge: "bg-blue-100 text-blue-700" },
};

// ─── 공통 컴포넌트 ─────────────────────────────────────────────────────────
function DrugImage({ drug, imageUrl, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const prevUrl = useRef("");
  const sz = size === "sm" ? "w-12 h-12 text-2xl" : "w-24 h-24 text-5xl";

  if (imageUrl && imageUrl !== prevUrl.current) {
    prevUrl.current = imageUrl;
    if (failed) setFailed(false);
  }

  if (!imageUrl || failed) {
    return (
      <div className={`${sz} rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0`}>
        💊
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={drug?.ITEM_NAME}
      onError={() => setFailed(true)}
      className={`${sz} object-contain rounded-xl border border-gray-100 bg-white shrink-0`}
    />
  );
}

function DrugInfoCard({ drug, imageUrl, classNoName, onClear, onBookmark, isBookmarked }) {
  const typeLabel = classNoName || drug?.ETC_OTC_CODE || null;
  return (
    <div className="flex items-start gap-4 p-4 bg-violet-50 rounded-2xl border border-violet-200">
      <DrugImage drug={drug} imageUrl={imageUrl} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 break-keep leading-tight">{drug.ITEM_NAME}</p>
        <p className="text-xs text-gray-500 mt-0.5">{drug.ENTP_NAME}</p>
        <p className="text-xs text-gray-400 mt-0.5 break-keep">{drug.MATERIAL_NAME}</p>
        {typeLabel && (
          <span className="mt-1.5 inline-block text-xs px-2 py-0.5 rounded-full bg-violet-200 text-violet-700">
            {typeLabel}
          </span>
        )}
      </div>
      {(onBookmark || onClear) && (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {onBookmark && (
            <button
              onClick={onBookmark}
              title={isBookmarked ? "나의 약에서 제거" : "나의 약에 추가"}
              className={`text-xl leading-none transition-colors ${isBookmarked ? "text-violet-500" : "text-gray-300 hover:text-violet-400"}`}
            >
              {isBookmarked ? "★" : "☆"}
            </button>
          )}
          {onClear && (
            <button onClick={onClear} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultItem({ drug, onSelect }) {
  return (
    <button
      onClick={() => onSelect(drug)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-all text-left"
    >
      <div className="w-12 h-12 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-2xl shrink-0">💊</div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 text-sm break-keep">{drug.ITEM_NAME}</p>
        <p className="text-xs text-gray-500 mt-0.5">{drug.ENTP_NAME}</p>
        <p className="text-xs text-gray-400 break-keep line-clamp-1">{drug.MATERIAL_NAME}</p>
      </div>
    </button>
  );
}

function WarningItem({ item, color }) {
  const s = COLOR[color];
  return (
    <div className={`p-3 rounded-xl border ${s.wrap}`}>
      <p className="font-medium text-sm text-gray-800 break-keep">
        {item.MIXTURE_ITEM_NAME || item.INGR_KOR_NAME || "-"}
      </p>
      {item.MIXTURE_INGR_KOR_NAME && (
        <p className="text-xs text-gray-500 mt-0.5 break-keep">
          {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
        </p>
      )}
      {item.AGRDE_SE_NAME && (
        <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${s.badge}`}>{item.AGRDE_SE_NAME}</span>
      )}
      {item.GRADE && (
        <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${s.badge}`}>{item.GRADE}등급</span>
      )}
      {item.PROHBT_CONTENT && (
        <p className={`text-xs mt-1 break-keep ${s.text}`}>{item.PROHBT_CONTENT}</p>
      )}
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div className="text-center py-6">
      <div className="flex justify-center gap-1.5 mb-2">
        {[0, 150, 300].map((d) => (
          <span key={d} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function useDebounce(query, delay = 350) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await searchDrug(query.trim());
        setResults(d.items || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, delay);
    return () => clearTimeout(t);
  }, [query]);

  return { results, loading, clear: () => setResults([]) };
}

// ─── 나의 약 훅 ────────────────────────────────────────────────────────────
function useMyDrugs() {
  const [myDrugs, setMyDrugs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("myDrugs") || "[]"); }
    catch { return []; }
  });

  function toggle(drug) {
    setMyDrugs(prev => {
      const exists = prev.some(d => d.ITEM_SEQ === drug.ITEM_SEQ);
      const next = exists
        ? prev.filter(d => d.ITEM_SEQ !== drug.ITEM_SEQ)
        : [...prev, drug].slice(0, 10);
      localStorage.setItem("myDrugs", JSON.stringify(next));
      return next;
    });
  }

  function remove(drug) {
    setMyDrugs(prev => {
      const next = prev.filter(d => d.ITEM_SEQ !== drug.ITEM_SEQ);
      localStorage.setItem("myDrugs", JSON.stringify(next));
      return next;
    });
  }

  function has(drug) {
    return myDrugs.some(d => d.ITEM_SEQ === drug.ITEM_SEQ);
  }

  return { myDrugs, toggle, remove, has };
}

// ─── 페이지 1: 약품 검색 ────────────────────────────────────────────────────
function SearchPage({ myDrugsHook }) {
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
      {/* 검색창 */}
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

      {/* 약품 상세 + 금기 정보 */}
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

          {/* 효능·효과 */}
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

// ─── 페이지 2: 병용금기 확인 ─────────────────────────────────────────────────
function InteractionPage({ myDrugsHook }) {
  const [query1, setQuery1] = useState("");
  const [drug1, setDrug1] = useState(null);
  const [image1, setImage1] = useState("");
  const [query2, setQuery2] = useState("");
  const [drug2, setDrug2] = useState(null);
  const [image2, setImage2] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const s1 = useDebounce(drug1 ? "" : query1);
  const s2 = useDebounce(drug2 ? "" : query2);
  const { myDrugs } = myDrugsHook;

  function selectDrug1(d) {
    setDrug1(d); setQuery1(d.ITEM_NAME); s1.clear(); setResult(null);
    setImage1("");
    getDrugImage(d.ITEM_NAME).then(img => setImage1(img.imageUrl || "")).catch(() => {});
  }
  function selectDrug2(d) {
    setDrug2(d); setQuery2(d.ITEM_NAME); s2.clear(); setResult(null);
    setImage2("");
    getDrugImage(d.ITEM_NAME).then(img => setImage2(img.imageUrl || "")).catch(() => {});
  }
  function clearDrug1() { setDrug1(null); setQuery1(""); setResult(null); s1.clear(); setImage1(""); }
  function clearDrug2() { setDrug2(null); setQuery2(""); setResult(null); s2.clear(); setImage2(""); }

  async function handleCheck() {
    if (!drug1 || !drug2) return;
    setChecking(true);
    setResult(null);
    try {
      const data = await checkInteraction(drug1.ITEM_NAME, drug2.ITEM_NAME);
      setResult(data);
    } catch { setResult(null); }
    finally { setChecking(false); }
  }

  const myDrugsForDrug2 = myDrugs.filter(d => d.ITEM_SEQ !== drug1?.ITEM_SEQ);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs font-semibold text-violet-600 mb-4 uppercase tracking-wide">비교할 두 약품을 선택하세요</p>

        <div className="space-y-4">
          {/* 약품 1 */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">약품 1</p>
            {drug1 ? (
              <DrugInfoCard drug={drug1} imageUrl={image1} onClear={clearDrug1} />
            ) : (
              <>
                <input
                  type="text"
                  value={query1}
                  onChange={(e) => setQuery1(e.target.value)}
                  placeholder="약품명 입력 (예: 탁센레이디)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300"
                />
                {s1.results.length > 0 && (
                  <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto">
                    {s1.results.map((d, i) => (
                      <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={selectDrug1} />
                    ))}
                  </div>
                )}
                {myDrugs.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-xs text-gray-400 mb-1.5">나의 약에서 선택</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myDrugs.map((d, i) => (
                        <button
                          key={d.ITEM_SEQ || i}
                          onClick={() => selectDrug1(d)}
                          className="text-xs px-2.5 py-1.5 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                          {d.ITEM_NAME}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-dashed border-gray-200" />
            <span className="text-gray-300 text-lg">+</span>
            <div className="flex-1 border-t border-dashed border-gray-200" />
          </div>

          {/* 약품 2 */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">약품 2</p>
            {drug2 ? (
              <DrugInfoCard drug={drug2} imageUrl={image2} onClear={clearDrug2} />
            ) : (
              <>
                <input
                  type="text"
                  value={query2}
                  onChange={(e) => setQuery2(e.target.value)}
                  placeholder="약품명 입력 (예: 케라신주)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300"
                />
                {s2.results.length > 0 && (
                  <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto">
                    {s2.results.map((d, i) => (
                      <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={selectDrug2} />
                    ))}
                  </div>
                )}
                {myDrugsForDrug2.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-xs text-gray-400 mb-1.5">나의 약에서 선택</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myDrugsForDrug2.map((d, i) => (
                        <button
                          key={d.ITEM_SEQ || i}
                          onClick={() => selectDrug2(d)}
                          className="text-xs px-2.5 py-1.5 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                          {d.ITEM_NAME}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleCheck}
          disabled={!drug1 || !drug2 || checking}
          className="mt-5 w-full py-3 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {checking ? "조회 중…" : "병용금기 확인하기"}
        </button>

        {checking && <Spinner label="병용금기 정보 조회 중…" />}
      </div>

      {/* 결과 */}
      {result && (
        <div className={`rounded-2xl border p-5 ${
          result.is_prohibited ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{result.is_prohibited ? "⚠️" : "✅"}</span>
            <p className={`font-bold text-lg ${result.is_prohibited ? "text-red-700" : "text-green-700"}`}>
              {result.is_prohibited ? "병용금기 약물입니다" : "병용금기 아님"}
            </p>
          </div>

          {/* 두 약품 나란히 */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-xl border border-gray-100">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <DrugImage drug={drug1} imageUrl={image1} size="sm" />
              <p className="text-xs text-gray-700 break-keep font-medium leading-tight">{drug1?.ITEM_NAME}</p>
            </div>
            <span className={`text-xl font-bold shrink-0 ${result.is_prohibited ? "text-red-400" : "text-green-400"}`}>
              {result.is_prohibited ? "✕" : "✓"}
            </span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <DrugImage drug={drug2} imageUrl={image2} size="sm" />
              <p className="text-xs text-gray-700 break-keep font-medium leading-tight">{drug2?.ITEM_NAME}</p>
            </div>
          </div>

          {result.message && <p className="text-xs text-gray-500 mb-2">{result.message}</p>}

          {result.is_prohibited && result.interactions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-600 mb-1">금기 상세 정보</p>
              {result.interactions.map((item, i) => (
                <div key={i} className="p-3 bg-white rounded-xl border border-red-200">
                  <p className="font-medium text-sm text-gray-700 break-keep">
                    {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
                  </p>
                  {item.PROHBT_CONTENT && (
                    <p className="text-xs text-red-600 mt-1 break-keep">{item.PROHBT_CONTENT}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!result.is_prohibited && (
            <p className="text-sm text-green-600 mt-1">
              공공 DUR 데이터 기준으로 두 약품 사이의 병용금기 정보가 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 페이지 3: 나의 약 목록 ──────────────────────────────────────────────────
function MyDrugsPage({ myDrugsHook, onGoSearch }) {
  const { myDrugs, remove } = myDrugsHook;
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  // 약 목록이 바뀌면 이전 결과 초기화
  const prevCountRef = useRef(myDrugs.length);
  if (myDrugs.length !== prevCountRef.current) {
    prevCountRef.current = myDrugs.length;
    if (bulkResults.length > 0) {
      setBulkResults([]);
      setChecked(false);
    }
  }

  async function handleBulkCheck() {
    setBulkChecking(true);
    setBulkResults([]);

    const pairs = [];
    for (let i = 0; i < myDrugs.length; i++) {
      for (let j = i + 1; j < myDrugs.length; j++) {
        pairs.push([myDrugs[i], myDrugs[j]]);
      }
    }

    const settled = await Promise.allSettled(
      pairs.map(([d1, d2]) => checkInteraction(d1.ITEM_NAME, d2.ITEM_NAME))
    );

    const results = pairs.map(([d1, d2], i) => ({
      drug1: d1,
      drug2: d2,
      ...(settled[i].status === "fulfilled"
        ? settled[i].value
        : { is_prohibited: false, message: "조회 실패" }),
    }));

    // 금기 있는 것 먼저
    results.sort((a, b) => (b.is_prohibited ? 1 : 0) - (a.is_prohibited ? 1 : 0));
    setBulkResults(results);
    setBulkChecking(false);
    setChecked(true);
  }

  if (myDrugs.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-4xl mb-3">💊</p>
        <p className="font-semibold text-gray-700 mb-1">저장된 약이 없습니다</p>
        <p className="text-sm text-gray-400 mb-5">약품 검색 탭에서 별표(★)를 눌러 복용 중인 약을 저장하세요.</p>
        <button
          onClick={onGoSearch}
          className="text-sm px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          약품 검색하러 가기
        </button>
      </div>
    );
  }

  const prohibitedCount = bulkResults.filter(r => r.is_prohibited).length;
  const pairCount = (myDrugs.length * (myDrugs.length - 1)) / 2;

  return (
    <div className="space-y-4">
      {/* 약 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-3">
          ★ 복용 중인 약 ({myDrugs.length}/10)
        </p>
        <div className="space-y-2">
          {myDrugs.map((d, i) => (
            <div
              key={d.ITEM_SEQ || i}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl shrink-0">💊</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm break-keep">{d.ITEM_NAME}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.ENTP_NAME}</p>
                <p className="text-xs text-gray-400 break-keep line-clamp-1">{d.MATERIAL_NAME}</p>
              </div>
              <button
                onClick={() => remove(d)}
                className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors shrink-0"
                title="목록에서 제거"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 일괄 병용금기 확인 */}
      {myDrugs.length >= 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
              전체 병용금기 확인
            </p>
            <p className="text-xs text-gray-400">{pairCount}가지 조합</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            저장된 {myDrugs.length}개 약의 모든 조합을 한 번에 확인합니다.
          </p>

          <button
            onClick={handleBulkCheck}
            disabled={bulkChecking}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {bulkChecking ? "확인 중…" : checked ? "다시 확인" : "전체 병용금기 확인하기"}
          </button>

          {bulkChecking && <Spinner label={`${pairCount}가지 조합 조회 중…`} />}

          {/* 결과 요약 */}
          {checked && !bulkChecking && (
            <div className={`mt-3 p-3 rounded-xl text-sm font-semibold text-center ${
              prohibitedCount > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            }`}>
              {prohibitedCount > 0
                ? `⚠️ 병용금기 ${prohibitedCount}건 발견`
                : "✅ 병용금기 없음"}
            </div>
          )}

          {/* 결과 목록 */}
          {bulkResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {bulkResults.map((r, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border ${
                    r.is_prohibited
                      ? "border-red-200 bg-red-50"
                      : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base shrink-0">{r.is_prohibited ? "⚠️" : "✅"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium break-keep ${r.is_prohibited ? "text-red-800" : "text-gray-600"}`}>
                        {r.drug1.ITEM_NAME}
                        <span className="mx-1 font-normal opacity-60">+</span>
                        {r.drug2.ITEM_NAME}
                      </p>
                    </div>
                    <span className={`text-xs shrink-0 font-semibold ${r.is_prohibited ? "text-red-600" : "text-gray-400"}`}>
                      {r.is_prohibited ? "금기" : "이상없음"}
                    </span>
                  </div>
                  {r.is_prohibited && r.interactions?.map((item, j) => (
                    <p key={j} className="text-xs text-red-600 mt-1.5 ml-6 break-keep">
                      {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
                      {item.PROHBT_CONTENT && ` — ${item.PROHBT_CONTENT}`}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 루트 ──────────────────────────────────────────────────────────────────
const PAGES = [
  { label: "🔍 약품 검색",         },
  { label: "💊 병용금기 확인",      },
  { label: "★ 나의 약",            },
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
        {page === 2 && (
          <MyDrugsPage
            myDrugsHook={myDrugsHook}
            onGoSearch={() => setPage(0)}
          />
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          식품의약품안전처 공공데이터 DUR API 기반
        </p>
      </div>
    </div>
  );
}
