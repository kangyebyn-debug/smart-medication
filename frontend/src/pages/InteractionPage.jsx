import { useState, useRef } from "react";
import { getDrugImage, checkInteraction } from "../api";
import { useDebounce } from "../hooks/useDebounce";
import DrugImage from "../components/DrugImage";
import DrugInfoCard from "../components/DrugInfoCard";
import SearchResultItem from "../components/SearchResultItem";
import Spinner from "../components/Spinner";
import Icon from "../components/Icon";

export default function InteractionPage({ myDrugsHook }) {
  const [query1, setQuery1] = useState("");
  const [drug1, setDrug1] = useState(null);
  const [image1, setImage1] = useState("");
  const [query2, setQuery2] = useState("");
  const [drug2, setDrug2] = useState(null);
  const [image2, setImage2] = useState("");
  const [result, setResult] = useState(null);
  const [checkError, setCheckError] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkRequestIdRef = useRef(0);
  const image1RequestIdRef = useRef(0);
  const image2RequestIdRef = useRef(0);

  const s1 = useDebounce(drug1 ? "" : query1);
  const s2 = useDebounce(drug2 ? "" : query2);
  const { myDrugs } = myDrugsHook;

  function resetCheck() {
    checkRequestIdRef.current++;
    setResult(null);
    setCheckError(false);
    setChecking(false);
  }

  function selectDrug1(d) {
    resetCheck();
    setDrug1(d);
    setQuery1(d.ITEM_NAME);
    s1.clear();
    const requestId = ++image1RequestIdRef.current;
    setImage1("");
    getDrugImage(d.ITEM_NAME, d.ITEM_SEQ)
      .then(img => {
        if (image1RequestIdRef.current === requestId) setImage1(img.imageUrl || "");
      })
      .catch(() => {});
  }
  function selectDrug2(d) {
    resetCheck();
    setDrug2(d);
    setQuery2(d.ITEM_NAME);
    s2.clear();
    const requestId = ++image2RequestIdRef.current;
    setImage2("");
    getDrugImage(d.ITEM_NAME, d.ITEM_SEQ)
      .then(img => {
        if (image2RequestIdRef.current === requestId) setImage2(img.imageUrl || "");
      })
      .catch(() => {});
  }
  function clearDrug1() {
    resetCheck();
    image1RequestIdRef.current++;
    setDrug1(null);
    setQuery1("");
    s1.clear();
    setImage1("");
  }
  function clearDrug2() {
    resetCheck();
    image2RequestIdRef.current++;
    setDrug2(null);
    setQuery2("");
    s2.clear();
    setImage2("");
  }

  async function handleCheck() {
    if (!drug1 || !drug2) return;
    const requestId = ++checkRequestIdRef.current;
    setChecking(true);
    setResult(null);
    setCheckError(false);
    try {
      const data = await checkInteraction(drug1.ITEM_NAME, drug2.ITEM_NAME);
      if (typeof data?.is_prohibited !== "boolean") throw new Error("Invalid interaction response");
      if (checkRequestIdRef.current === requestId) setResult(data);
    } catch {
      if (checkRequestIdRef.current === requestId) setCheckError(true);
    } finally {
      if (checkRequestIdRef.current === requestId) setChecking(false);
    }
  }

  const myDrugsForDrug2 = myDrugs.filter(d => d.ITEM_SEQ !== drug1?.ITEM_SEQ);

  return (
    <section className="mx-auto w-full max-w-[1200px] space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.16em] text-brand">함께 복용하기 전</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">병용금기 확인</h1>
        <p className="mt-2 break-keep text-base leading-relaxed text-muted">두 약품을 선택하면 공공 DUR에서 조회되는 병용금기 항목을 확인합니다.</p>
      </header>
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_12px_32px_-24px_rgba(27,58,75,0.4)] sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink"><Icon name="compare" size={20} className="text-brand" />비교할 약품</h2>

        <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))" }}>
          {/* 약품 1 */}
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <label htmlFor="drug-one-search" className="mb-3 block text-sm font-semibold text-ink">첫 번째 약품</label>
            {drug1 ? (
              <DrugInfoCard drug={drug1} imageUrl={image1} onClear={clearDrug1} />
            ) : (
              <>
                <div className="relative">
                  <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="drug-one-search"
                    type="search"
                    value={query1}
                    onChange={(e) => setQuery1(e.target.value)}
                    placeholder="약품명 입력"
                    className="w-full rounded-xl border border-line bg-white py-3 pl-11 pr-4 text-base text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-mint"
                  />
                </div>
                {s1.loading && <p className="mt-2 text-base text-brand">검색 중…</p>}
                {s1.error && (
                  <div role="alert" className="mt-3 break-keep rounded-xl border border-[#EEDFC3] bg-[#FDF8EE] p-3 text-base leading-relaxed text-[#815511]">
                    약품 검색에 실패했습니다. 서버 연결을 확인해 주세요.
                    <button type="button" onClick={s1.retry} className="ml-2 font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand">다시 검색</button>
                  </div>
                )}
                {s1.completed && !s1.error && s1.results.length === 0 && query1.trim() && <p className="mt-3 break-keep text-base text-muted">일치하는 약품이 없습니다. 제품명을 다시 확인해 주세요.</p>}
                {s1.results.length > 0 && (
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {s1.results.map((d, i) => (
                      <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={selectDrug1} />
                    ))}
                  </div>
                )}
                {myDrugs.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="mb-2 break-keep text-base font-medium text-muted">이 브라우저에 저장한 약에서 선택</p>
                    <div className="flex flex-wrap gap-2">
                      {myDrugs.map((d, i) => (
                        <button
                          type="button"
                          key={d.ITEM_SEQ || i}
                          onClick={() => selectDrug1(d)}
                          className="rounded-full border border-[#D8EFE1] bg-white px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:border-brand hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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

          {/* 약품 2 */}
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <label htmlFor="drug-two-search" className="mb-3 block text-sm font-semibold text-ink">두 번째 약품</label>
            {drug2 ? (
              <DrugInfoCard drug={drug2} imageUrl={image2} onClear={clearDrug2} />
            ) : (
              <>
                <div className="relative">
                  <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="drug-two-search"
                    type="search"
                    value={query2}
                    onChange={(e) => setQuery2(e.target.value)}
                    placeholder="약품명 입력"
                    className="w-full rounded-xl border border-line bg-white py-3 pl-11 pr-4 text-base text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-mint"
                  />
                </div>
                {s2.loading && <p className="mt-2 text-base text-brand">검색 중…</p>}
                {s2.error && (
                  <div role="alert" className="mt-3 break-keep rounded-xl border border-[#EEDFC3] bg-[#FDF8EE] p-3 text-base leading-relaxed text-[#815511]">
                    약품 검색에 실패했습니다. 서버 연결을 확인해 주세요.
                    <button type="button" onClick={s2.retry} className="ml-2 font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand">다시 검색</button>
                  </div>
                )}
                {s2.completed && !s2.error && s2.results.length === 0 && query2.trim() && <p className="mt-3 break-keep text-base text-muted">일치하는 약품이 없습니다. 제품명을 다시 확인해 주세요.</p>}
                {s2.results.length > 0 && (
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {s2.results.map((d, i) => (
                      <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={selectDrug2} />
                    ))}
                  </div>
                )}
                {myDrugsForDrug2.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="mb-2 break-keep text-base font-medium text-muted">이 브라우저에 저장한 약에서 선택</p>
                    <div className="flex flex-wrap gap-2">
                      {myDrugsForDrug2.map((d, i) => (
                        <button
                          type="button"
                          key={d.ITEM_SEQ || i}
                          onClick={() => selectDrug2(d)}
                          className="rounded-full border border-[#D8EFE1] bg-white px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:border-brand hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
          type="button"
          onClick={handleCheck}
          disabled={!drug1 || !drug2 || checking}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="compare" size={17} />
          {checking ? "조회 중…" : checkError ? "다시 조회하기" : "병용금기 확인하기"}
        </button>

        {checking && <Spinner label="병용금기 정보 조회 중…" />}
        {checkError && (
          <p role="alert" className="mt-4 break-keep rounded-xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
            병용금기 정보를 조회하지 못했습니다. 다시 확인해 주세요.
          </p>
        )}
      </div>

      {result && (
        <section className={result.is_prohibited
          ? "rounded-2xl border border-[#EFCAC7] bg-[#FDF3F3] p-5 sm:p-6"
          : "rounded-2xl border border-line bg-surface p-5 sm:p-6"}>
          <div className="mb-4 flex items-start gap-3">
            <span aria-hidden="true" className={result.is_prohibited ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7DEDC] text-[#B3443C]" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E7ECE9] text-muted"}>
              <Icon name={result.is_prohibited ? "alert" : "info"} size={20} />
            </span>
            <h2 className={result.is_prohibited ? "text-lg font-bold text-[#9E3831]" : "text-lg font-bold text-ink"}>
              {result.is_prohibited ? "병용금기 약물입니다" : "조회 범위에서 병용금기 항목 없음"}
            </h2>
          </div>

          <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))" }}>
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-white p-3">
              <DrugImage drug={drug1} imageUrl={image1} size="sm" />
              <p className="min-w-0 break-keep break-words text-base font-semibold leading-snug text-ink">{drug1?.ITEM_NAME}</p>
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-white p-3">
              <DrugImage drug={drug2} imageUrl={image2} size="sm" />
              <p className="min-w-0 break-keep break-words text-base font-semibold leading-snug text-ink">{drug2?.ITEM_NAME}</p>
            </div>
          </div>

          {result.is_prohibited && result.message && <p className="mb-3 break-keep text-base text-muted">{result.message}</p>}

          {result.is_prohibited && result.interactions?.length > 0 && (
            <div className="space-y-2">
              <p className="mb-2 text-xs font-bold text-[#B3443C]">조회된 금기 상세</p>
              {result.interactions.map((item, i) => (
                <div key={i} className="rounded-xl border border-[#EFCAC7] bg-white p-4">
                  <p className="break-keep break-words text-base font-semibold text-ink">
                    {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
                  </p>
                  {item.PROHBT_CONTENT && (
                    <p className="mt-2 break-keep break-words text-base leading-relaxed text-[#B3443C]">{item.PROHBT_CONTENT}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!result.is_prohibited && (
            <p className="break-keep text-base leading-relaxed text-muted">
              조회된 공공 DUR 항목에서 두 약품의 병용금기를 찾지 못했습니다. 안전성은 확정할 수 없습니다.
            </p>
          )}
        </section>
      )}
    </section>
  );
}
