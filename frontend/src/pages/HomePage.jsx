import Icon from "../components/Icon";

export default function HomePage({ myDrugs, onNavigate }) {
  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-line bg-white p-7 sm:p-9" aria-labelledby="home-title">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-[660px]">
            <p className="text-xs font-bold tracking-[0.16em] text-brand">스마트 메디케이션</p>
            <h1 id="home-title" className="mt-3 break-keep text-3xl font-black leading-tight tracking-[-0.055em] text-ink sm:text-4xl">
              약 정보를 확인하는 공간
            </h1>
            <p className="mt-4 break-keep text-base leading-7 text-muted">
              약 이름을 검색하거나 두 약의 병용금기 항목을 조회하세요.
              저장한 약이 있다면 조합을 한 번에 확인할 수도 있습니다.
            </p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-brand">
            <Icon name="shield" size={28} />
          </span>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate("search")}
            className="inline-flex min-h-11 items-center gap-2 rounded-[9px] bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
          >
            약품 검색하기 <Icon name="arrowRight" size={17} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("compare")}
            className="inline-flex min-h-11 items-center gap-2 rounded-[9px] border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-mint"
          >
            병용금기 확인 <Icon name="compare" size={17} />
          </button>
        </div>
      </section>

      <div className="home-overview-grid">
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-7" aria-labelledby="saved-drugs-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="break-keep text-xs font-bold tracking-[0.12em] text-brand">현재 이 브라우저에 저장됨</p>
              <h2 id="saved-drugs-title" className="mt-2 text-xl font-bold tracking-[-0.035em] text-ink">나의 약</h2>
            </div>
            <span className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-mint px-2 text-sm font-bold text-brand">
              {myDrugs.length}
            </span>
          </div>
          {myDrugs.length === 0 ? (
            <p className="mt-5 break-keep rounded-xl bg-surface px-4 py-5 text-base leading-7 text-muted">
              아직 저장한 약이 없습니다. 검색 결과에서 약을 선택해 나의 약에 추가할 수 있습니다.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line px-4">
              {myDrugs.slice(0, 3).map((drug, index) => (
                <li key={drug.ITEM_SEQ || `${drug.ITEM_NAME}-${index}`} className="flex items-center gap-3 py-3">
                  <Icon name="pill" size={18} className="shrink-0 text-brand" />
                  <span className="min-w-0 truncate text-base font-medium text-ink">{drug.ITEM_NAME}</span>
                </li>
              ))}
              {myDrugs.length > 3 && (
                <li className="break-keep py-3 text-base text-muted">그 밖에 {myDrugs.length - 3}개 약이 더 있습니다.</li>
              )}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onNavigate("my-drugs")}
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark"
          >
            나의 약 보기 <Icon name="chevronRight" size={16} />
          </button>
        </section>

        <section className="flex flex-col rounded-2xl border border-line bg-mint p-6 sm:p-7" aria-labelledby="home-data-title">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand">
            <Icon name="info" size={21} />
          </span>
          <h2 id="home-data-title" className="mt-5 break-keep text-xl font-bold tracking-[-0.035em] text-ink">결과를 읽을 때</h2>
          <p className="mt-3 break-keep text-base leading-7 text-muted">
            표시된 금기 항목은 공공 DUR 자료의 조회 결과입니다. 항목이 보이지 않거나 조회가 실패했다면 복용 안전성이 확인된 것은 아닙니다.
          </p>
          <p className="mt-auto break-keep pt-7 text-base leading-7 text-muted">개인의 복용법은 처방전 또는 약사 안내를 확인하세요.</p>
        </section>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-sidebar p-6 text-white sm:p-7" aria-labelledby="home-ai-title">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Icon name="sparkles" size={20} />
          </span>
          <div>
            <h2 id="home-ai-title" className="text-base font-bold">복약 질문 AI</h2>
            <p className="mt-1 break-keep text-base leading-7 text-white/70">등록한 약을 바탕으로 질문하는 기능을 준비하고 있습니다.</p>
          </div>
        </div>
        <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/70">준비 중</span>
      </section>
    </div>
  );
}
