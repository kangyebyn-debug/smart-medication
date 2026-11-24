import { useState } from "react";
import { checkInteraction } from "../api";
import Spinner from "../components/Spinner";
import Icon from "../components/Icon";

export default function MyDrugsPage({ myDrugsHook, onGoSearch }) {
  const { myDrugs, loading, loadError, actionError, busy, remove, reload } = myDrugsHook;
  const [bulkCheck, setBulkCheck] = useState({ drugs: null, status: "idle", results: [] });
  const currentCheck = bulkCheck.drugs === myDrugs ? bulkCheck : null;
  const bulkResults = currentCheck?.results || [];
  const bulkChecking = currentCheck?.status === "loading";
  const checked = currentCheck?.status === "done";

  async function handleBulkCheck() {
    const checkedDrugs = myDrugs;
    setBulkCheck({ drugs: checkedDrugs, status: "loading", results: [] });

    const pairs = [];
    for (let i = 0; i < checkedDrugs.length; i++) {
      for (let j = i + 1; j < checkedDrugs.length; j++) {
        pairs.push([checkedDrugs[i], checkedDrugs[j]]);
      }
    }

    const settled = await Promise.allSettled(
      pairs.map(([d1, d2]) => checkInteraction(d1.ITEM_NAME, d2.ITEM_NAME))
    );

    const results = pairs.map(([d1, d2], i) => {
      const result = settled[i];
      const valid = result.status === "fulfilled" && typeof result.value?.is_prohibited === "boolean";
      return {
        ...(valid ? result.value : {}),
        drug1: d1,
        drug2: d2,
        checkFailed: !valid,
      };
    });

    results.sort((a, b) => (b.is_prohibited ? 1 : 0) - (a.is_prohibited ? 1 : 0));
    setBulkCheck(current =>
      current.drugs === checkedDrugs && current.status === "loading"
        ? { drugs: checkedDrugs, status: "done", results }
        : current
    );
  }

  const pageHeader = (
    <header>
      <p className="ui-eyebrow font-bold text-brand">복용 목록</p>
      <h1 className="ui-page-title font-extrabold text-ink">나의 약</h1>
      <p className="break-keep text-base leading-[1.6] text-muted">등록한 약은 로그인한 계정에 저장되어 다른 기기에서도 확인할 수 있습니다.</p>
    </header>
  );

  const actionFeedback = actionError && (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
      <span>{actionError}</span>
      <button type="button" onClick={reload} disabled={busy} className="rounded-full border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">목록 다시 불러오기</button>
    </div>
  );

  if (loading) {
    return (
      <section className="w-full space-y-[22px]">
        {pageHeader}
        <Spinner label="저장한 약을 불러오는 중…" />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="w-full space-y-[22px]">
        {pageHeader}
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
          <span>{loadError}</span>
          <button type="button" onClick={reload} className="rounded-full border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">다시 불러오기</button>
        </div>
      </section>
    );
  }

  if (myDrugs.length === 0) {
    return (
      <section className="w-full space-y-[22px]">
        {pageHeader}
        {actionFeedback}
        <div className="ui-glass-card rounded-[22px] border p-6 text-center sm:px-7 sm:py-[26px]">
          <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D8EFE1] bg-mint text-brand"><Icon name="bookmark" size={26} /></span>
          <h2 className="mt-5 text-lg font-bold text-ink">저장된 약이 없습니다</h2>
          <p className="mt-2 break-keep text-base leading-relaxed text-muted">약품을 검색한 뒤 ‘나의 약에 추가’를 누르면 계정에 저장됩니다.</p>
          <button type="button" onClick={onGoSearch} className="ui-primary-action mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-[13px] text-base font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <Icon name="search" size={17} />약품 검색하기
          </button>
        </div>
      </section>
    );
  }

  const prohibitedCount = bulkResults.filter(r => r.is_prohibited).length;
  const failedCount = bulkResults.filter(r => r.checkFailed).length;
  const pairCount = (myDrugs.length * (myDrugs.length - 1)) / 2;

  return (
    <section className="w-full space-y-[22px]">
      {pageHeader}
      {actionFeedback}
      <div className="ui-glass-card rounded-[22px] border p-5 sm:px-7 sm:py-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-ink"><Icon name="bookmark" size={19} className="text-brand" />계정에 저장한 약</h2>
          <span className="rounded-full bg-brand/[.14] px-[14px] py-[5px] text-[13px] font-bold text-brand-dark">{myDrugs.length}개</span>
        </div>
        <div className="mt-[18px] grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
          {myDrugs.map((d, i) => (
            <div
              key={d.id || d.ITEM_SEQ || i}
              className="elevated-card flex min-w-0 items-center gap-[14px] rounded-[18px] border border-[rgba(23,64,45,.13)] bg-white px-[18px] py-4 shadow-[0_10px_22px_-16px_rgba(23,64,45,.14)]"
            >
              <span aria-hidden="true" className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-brand/[.14] text-brand"><Icon name="pill" size={19} /></span>
              <div className="min-w-0 flex-1">
                <p className="break-keep break-words text-base font-semibold text-ink">{d.ITEM_NAME}</p>
                {d.ENTP_NAME && <p className="mt-0.5 break-keep break-words text-[13.5px] text-muted">{d.ENTP_NAME}</p>}
                {d.MATERIAL_NAME && <p className="mt-0.5 truncate text-[13.5px] text-muted">{d.MATERIAL_NAME}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(d)}
                disabled={busy}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(23,64,45,.13)] bg-white text-muted transition-colors hover:border-[#EFCAC7] hover:text-[#B3443C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`${d.ITEM_NAME} 목록에서 제거`}
              >
                <Icon name="close" size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {myDrugs.length >= 2 && (
        <div className="ui-glass-card rounded-[22px] border p-5 sm:px-7 sm:py-[26px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-ink"><Icon name="compare" size={19} className="text-brand" />전체 병용금기 조회</h2>
            <span className="rounded-full bg-brand/[.14] px-[14px] py-[5px] text-[13px] font-medium text-brand-dark">{pairCount}가지 조합</span>
          </div>
          <p className="mt-2 break-keep text-base leading-relaxed text-muted">
            저장된 {myDrugs.length}개 약의 모든 조합을 조회합니다. 항목이 없더라도 안전성이 확인된 것은 아닙니다.
          </p>

          <button
            type="button"
            onClick={handleBulkCheck}
            disabled={bulkChecking}
            className="ui-primary-action mt-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-[13px] text-[15.5px] font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="compare" size={17} />
            {bulkChecking ? "확인 중…" : checked ? "다시 확인" : "전체 병용금기 확인하기"}
          </button>

          {bulkChecking && <Spinner label={`${pairCount}가지 조합 조회 중…`} />}

          {checked && !bulkChecking && (
            <div className={`mt-[18px] flex items-start gap-3 rounded-2xl border px-[18px] py-4 text-base font-semibold ${
              prohibitedCount > 0
                ? "border-[#EFCAC7] bg-[#FDF3F3] text-[#9E3831]"
                : failedCount > 0
                  ? "border-[#EEDFC3] bg-[#FDF8EE] text-[#815511]"
                  : "border-line bg-white/[.65] text-ink"
            }`}>
              <Icon name={prohibitedCount > 0 ? "noEntry" : failedCount > 0 ? "alert" : "info"} size={19} className="shrink-0" />
              <span className="min-w-0 break-keep">
                {failedCount > 0
                  ? prohibitedCount > 0
                    ? `병용금기 ${prohibitedCount}건 발견 · ${failedCount}건 조회 실패 (일부 결과 미확인)`
                    : `${failedCount}건 조회 실패 · 전체 병용금기 여부를 확인할 수 없습니다`
                  : prohibitedCount > 0
                    ? `병용금기 ${prohibitedCount}건 발견`
                    : "조회 범위에서 병용금기 항목 없음 · 안전성은 확정할 수 없습니다"}
              </span>
            </div>
          )}

          {bulkResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {bulkResults.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border px-[18px] py-4 ${
                    r.checkFailed
                      ? "border-[#EEDFC3] bg-[#FDF8EE]"
                      : r.is_prohibited
                        ? "border-[#EFCAC7] bg-[#FDF3F3]"
                        : "border-line bg-white/[.65]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span aria-hidden="true" className={r.checkFailed ? "text-[#9A6A1C]" : r.is_prohibited ? "text-[#B3443C]" : "text-muted"}>
                      <Icon name={r.is_prohibited ? "noEntry" : r.checkFailed ? "alert" : "info"} size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="break-keep break-words text-base font-semibold text-ink">
                        {r.drug1.ITEM_NAME}
                        <span className="mx-2 font-normal text-muted">+</span>
                        {r.drug2.ITEM_NAME}
                      </p>
                    </div>
                    <span className={r.checkFailed ? "ml-auto text-base font-bold text-[#815511]" : r.is_prohibited ? "ml-auto text-base font-bold text-[#9E3831]" : "ml-auto text-base font-bold text-muted"}>
                      {r.checkFailed ? "조회 실패" : r.is_prohibited ? "금기" : "조회 범위에 항목 없음"}
                    </span>
                  </div>
                  {r.is_prohibited && r.interactions?.map((item, j) => (
                    <p key={j} className="ml-7 mt-2 break-keep break-words text-base leading-relaxed text-[#B3443C]">
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
    </section>
  );
}
