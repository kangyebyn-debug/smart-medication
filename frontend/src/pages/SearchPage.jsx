import { useRef, useState } from "react";
import { getDrugImage, getAllWarnings } from "../api";
import { COLOR, WARN_TABS } from "../constants/warnings";
import { useDebounce } from "../hooks/useDebounce";
import DrugInfoCard from "../components/DrugInfoCard";
import SearchResultItem from "../components/SearchResultItem";
import WarningItem from "../components/WarningItem";
import Spinner from "../components/Spinner";
import Icon from "../components/Icon";

const sourceLabel = (source) => ({
  easy_drug: "공공 e약은요",
  permit: "식약처 의약품 제품 허가정보",
})[source] || "공공 의약품 API";

export default function SearchPage({ myDrugsHook, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [drug, setDrug] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [classNoName, setClassNoName] = useState("");
  const [loadingWarn, setLoadingWarn] = useState(false);
  const [warningError, setWarningError] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const [activeTab, setActiveTab] = useState("interaction");
  const requestIdRef = useRef(0);
  const slowTimerRef = useRef(null);

  const { results, loading, error: searchError, completed: searchCompleted, retry, clear } = useDebounce(drug ? "" : query);
  const { toggle, has, loadError, actionError, busy, reload, loading: myDrugsLoading } = myDrugsHook;

  async function handleSelect(d) {
    const requestId = ++requestIdRef.current;
    clearTimeout(slowTimerRef.current);
    setDrug(d);
    setQuery(d.ITEM_NAME);
    setWarnings(null);
    setWarningError(false);
    setImageUrl("");
    setClassNoName("");
    setActiveTab("interaction");
    clear();

    setLoadingWarn(true);
    setSlowServer(false);
    slowTimerRef.current = setTimeout(() => {
      if (requestId === requestIdRef.current) setSlowServer(true);
    }, 3000);

    getDrugImage(d.ITEM_NAME, d.ITEM_SEQ).then(img => {
      if (requestId !== requestIdRef.current) return;
      setImageUrl(img.imageUrl || "");
      setClassNoName(img.classNoName || "");
    }).catch(() => {});

    try {
      const data = await getAllWarnings(d.ITEM_NAME, d.ITEM_SEQ);
      if (requestId === requestIdRef.current) setWarnings(data);
    } catch {
      if (requestId === requestIdRef.current) setWarningError(true);
    }
    finally {
      if (requestId === requestIdRef.current) {
        setLoadingWarn(false);
        clearTimeout(slowTimerRef.current);
        setSlowServer(false);
      }
    }
  }

  function handleClear() {
    requestIdRef.current += 1;
    clearTimeout(slowTimerRef.current);
    setDrug(null);
    setQuery("");
    setWarnings(null);
    setWarningError(false);
    setLoadingWarn(false);
    setSlowServer(false);
    setImageUrl("");
    setClassNoName("");
    clear();
  }

  const activeColor = WARN_TABS.find((t) => t.key === activeTab)?.color || "red";
  const activeItems = warnings?.[activeTab] || [];
  const activeWarningStatus = warnings?.warningStatus?.[activeTab];

  return (
    <section className="mx-auto w-full max-w-[1200px] space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.16em] text-brand">의약품 정보</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">약품 검색</h1>
        <p className="mt-2 break-keep text-base leading-relaxed text-muted">제품명을 검색하고 공식 의약품 정보와 조회된 주의사항을 확인하세요.</p>
      </header>

      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_12px_32px_-24px_rgba(27,58,75,0.4)] sm:p-6">
        <label htmlFor="drug-search" className="mb-2 block text-sm font-semibold text-ink">약품명</label>
        <div className="relative">
          <Icon name="search" size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="drug-search"
            type="search"
            value={query}
            onChange={(e) => { if (drug) handleClear(); setQuery(e.target.value); }}
            placeholder="예: 타이레놀정, 탁센레이디"
            className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-base text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-mint"
          />
        </div>
        <p className="mt-2 break-keep text-base text-muted">식약처 공공데이터에서 제품명으로 검색합니다.</p>
        {loading && <p className="mt-3 text-base text-brand">검색 중…</p>}
        {searchError && !drug && (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
            <span>약품 검색에 실패했습니다. 서버 연결을 확인한 뒤 다시 검색해 주세요.</span>
            <button type="button" onClick={retry} className="rounded-lg border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">다시 검색</button>
          </div>
        )}
        {!drug && searchCompleted && !searchError && results.length === 0 && (
          <p className="mt-4 break-keep rounded-xl border border-line bg-surface p-4 text-base text-muted">일치하는 약품을 찾지 못했습니다. 제품명을 다시 확인해 주세요.</p>
        )}
        {results.length > 0 && !drug && (
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {results.map((d, i) => (
              <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>

      {drug && (
        <div className="space-y-5">
          {loadError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
              <span>{loadError}</span>
              <button type="button" onClick={reload} className="rounded-lg border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">다시 불러오기</button>
            </div>
          )}
          {actionError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
              <span>{actionError}</span>
              <button type="button" onClick={reload} disabled={busy} className="rounded-lg border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">목록 다시 불러오기</button>
            </div>
          )}
          <DrugInfoCard
            drug={drug}
            imageUrl={imageUrl}
            classNoName={classNoName}
            onClear={handleClear}
            onBookmark={() => toggle(drug)}
            isBookmarked={has(drug)}
            bookmarkDisabled={busy || myDrugsLoading || Boolean(loadError)}
          />

          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 23rem), 1fr))" }}>
            <div className="space-y-5">
              {warnings && (
                <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-brand">
                    <Icon name="info" size={19} />
                    <h2 className="text-base font-bold text-ink">효능·효과</h2>
                  </div>
                  <p className="mt-4 max-h-64 overflow-y-auto whitespace-pre-line break-keep text-base leading-7 text-[#39493F]">
                    {warnings.efficacy || "공공 의약품 API에서 해당 품목의 효능·효과 정보를 확인할 수 없습니다."}
                  </p>
                  {warnings.efficacy && <p className="mt-4 border-t border-line pt-3 text-xs text-muted">출처: {sourceLabel(warnings.efficacySource)}</p>}
                </section>
              )}

              {warnings && (
                <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-brand">
                    <Icon name="pill" size={19} />
                    <h2 className="text-base font-bold text-ink">용법·용량</h2>
                  </div>
                  <p className="mt-4 max-h-64 overflow-y-auto whitespace-pre-line break-keep text-base leading-7 text-[#39493F]">
                    {warnings.usage || "공공 의약품 API에서 해당 품목의 용법·용량 정보를 확인할 수 없습니다."}
                  </p>
                  {warnings.usage && (
                    <div className="mt-4 border-t border-line pt-3">
                      <p className="text-xs text-muted">출처: {sourceLabel(warnings.usageSource)}</p>
                      <p className="mt-2 break-keep text-base leading-relaxed text-muted">품목 일반 안내입니다. 개인별 복용법은 처방전이나 약사 안내를 확인하세요.</p>
                    </div>
                  )}
                </section>
              )}
            </div>
            <div className="space-y-5">
              {warningError && (
                <div role="alert" className="break-keep rounded-2xl border border-[#EEDFC3] bg-[#FDF8EE] p-5 text-base text-[#815511]">상세 정보 조회에 실패했습니다. 잠시 후 약품을 다시 검색해 주세요.</div>
              )}

              {loadingWarn && (
                <div className="rounded-2xl border border-line bg-white p-5">
                  <Spinner label="의약품 상세정보를 불러오는 중…" />
                  {slowServer && <p className="break-keep text-center text-base text-muted">서버 시작 중입니다. 최대 60초 소요될 수 있어요.</p>}
                </div>
              )}

              {warnings && (
                <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-brand">
                    <Icon name="shield" size={19} />
                    <h2 className="text-base font-bold text-ink">금기·주의 정보</h2>
                  </div>
                  <p className="mt-2 break-keep text-base leading-relaxed text-muted">공공 DUR에서 조회된 항목입니다. 항목이 없더라도 복용 안전성이 확인된 것은 아닙니다.</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {WARN_TABS.map((tab) => {
                      const count = warnings[tab.key]?.length || 0;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          aria-pressed={activeTab === tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={activeTab === tab.key
                            ? "inline-flex items-center gap-1.5 rounded-lg border border-brand bg-mint px-3 py-2 text-sm font-semibold text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            : "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"}
                        >
                          <Icon name={tab.icon} size={14} />
                          {tab.label}
                          {count > 0 && (
                            <span className={["rounded-full px-1.5 py-0.5 text-[11px] font-bold", COLOR[tab.color].badge].join(" ")}>{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5" aria-live="polite">
                    {activeWarningStatus === "error" ? (
                      <p role="alert" className="break-keep rounded-xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base leading-relaxed text-[#815511]">공공 DUR 금기 정보 조회에 실패했습니다. 잠시 후 약품을 다시 검색해 주세요.</p>
                    ) : activeItems.length === 0 ? (
                      <p className="break-keep rounded-xl border border-line bg-surface p-5 text-base leading-relaxed text-muted">조회 범위에서 해당 금기 항목을 찾지 못했습니다. 안전성을 확정하는 결과는 아닙니다.</p>
                    ) : (
                      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                        {activeItems.map((item, i) => (
                          <WarningItem key={i} item={item} color={activeColor} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
