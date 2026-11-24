import Icon from "../components/Icon";

export default function HomePage({ myDrugsHook, signedIn, onNavigate }) {
  const { myDrugs, loading, loadError, actionError, reload } = myDrugsHook;
  return (
    <div className="space-y-6">
      <section className="ui-glass-card rounded-[24px] border bg-white/[.78] px-6 py-7 shadow-[0_18px_36px_-22px_rgba(23,64,45,.22)] sm:px-[38px] sm:py-[34px]" aria-labelledby="home-title">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-[620px]">
            <p className="mb-[14px] inline-block rounded-full bg-brand px-[14px] py-[5px] text-[12.5px] font-bold tracking-normal text-white">스마트 메디케이션</p>
            <h1 id="home-title" className="mb-[10px] break-keep text-[26px] font-black leading-[1.35] text-ink">
              약 정보를 확인하는 공간
            </h1>
            <p className="break-keep text-base leading-[1.7] text-muted">
              약 이름을 검색하거나 두 약의 병용금기 항목을 조회하세요.
              저장한 약이 있다면 조합을 한 번에 확인할 수도 있습니다.
            </p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/[.14] text-brand">
            <Icon name="shield" size={28} />
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate("search")}
            className="ui-primary-action inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-[22px] py-3 text-[15px] font-bold text-white transition-colors hover:bg-brand-dark"
          >
            약품 검색하기 <Icon name="arrowRight" size={17} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("compare")}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[rgba(23,64,45,.13)] bg-white/[.85] px-[22px] py-3 text-[15px] font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-mint"
          >
            병용금기 확인 <Icon name="compare" size={17} />
          </button>
        </div>
      </section>

      <div className="home-overview-grid">
        <section className="ui-glass-card rounded-[20px] border bg-white/[.78] p-6 sm:p-[26px]" aria-labelledby="saved-drugs-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="break-keep text-[12.5px] font-bold tracking-normal text-brand">{signedIn ? "내 계정에 저장됨" : "로그인 후 이용 가능"}</p>
              <h2 id="saved-drugs-title" className="mt-2 text-[17px] font-bold text-ink">나의 약</h2>
            </div>
            <span className="flex min-w-10 items-center justify-center rounded-full bg-brand/[.14] px-[14px] py-[5px] text-[13px] font-bold text-brand-dark">
              {!signedIn || loading || loadError ? "–" : myDrugs.length}
            </span>
          </div>
          {!signedIn ? (
            <p className="mt-[18px] break-keep rounded-2xl bg-white/[.65] px-[18px] py-4 text-base leading-7 text-muted">나의 약을 저장하고 확인하려면 로그인해주세요.</p>
          ) : loading ? (
            <p role="status" className="mt-[18px] break-keep rounded-2xl bg-white/[.65] px-[18px] py-4 text-base leading-7 text-muted">저장한 약을 불러오는 중…</p>
          ) : loadError ? (
            <div role="alert" className="mt-[18px] rounded-2xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
              <p>{loadError}</p>
              <button type="button" onClick={reload} className="mt-3 rounded-full border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">다시 불러오기</button>
            </div>
          ) : myDrugs.length === 0 ? (
            <p className="mt-[18px] break-keep rounded-2xl bg-white/[.65] px-[18px] py-4 text-base leading-7 text-muted">
              아직 저장한 약이 없습니다. 검색 결과에서 약을 선택해 나의 약에 추가할 수 있습니다.
            </p>
          ) : (
            <ul className="mt-[18px] divide-y divide-line rounded-2xl border border-[rgba(23,64,45,.13)] bg-white/[.65] px-[18px]">
              {myDrugs.slice(0, 3).map((drug, index) => (
                <li key={drug.id || drug.ITEM_SEQ || `${drug.ITEM_NAME}-${index}`} className="flex items-center gap-3 py-3">
                  <Icon name="pill" size={18} className="shrink-0 text-brand" />
                  <span className="min-w-0 truncate text-base font-medium text-ink">{drug.ITEM_NAME}</span>
                </li>
              ))}
              {myDrugs.length > 3 && (
                <li className="break-keep py-3 text-base text-muted">그 밖에 {myDrugs.length - 3}개 약이 더 있습니다.</li>
              )}
            </ul>
          )}
          {signedIn && actionError && (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
              <span>{actionError}</span>
              <button type="button" onClick={reload} className="rounded-full border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">목록 다시 불러오기</button>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigate("my-drugs")}
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark"
          >
            나의 약 보기 <Icon name="chevronRight" size={16} />
          </button>
        </section>

        <section className="ui-glass-card flex flex-col rounded-[20px] border bg-white/[.78] p-6 sm:p-[26px]" aria-labelledby="home-data-title">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/[.14] text-brand">
            <Icon name="info" size={21} />
          </span>
          <h2 id="home-data-title" className="mb-2 mt-[14px] break-keep text-[17px] font-bold text-ink">결과를 읽을 때</h2>
          <p className="break-keep text-base leading-[1.65] text-muted">
            표시된 금기 항목은 공공 DUR 자료의 조회 결과입니다. 항목이 보이지 않거나 조회가 실패했다면 복용 안전성이 확인된 것은 아닙니다.
          </p>
          <p className="mt-auto break-keep pt-7 text-base leading-7 text-muted">개인의 복용법은 처방전 또는 약사 안내를 확인하세요.</p>
        </section>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-[linear-gradient(120deg,#146A45,#1F8A5E)] p-6 text-white shadow-[0_18px_34px_-20px_rgba(20,106,69,.55)] sm:px-[38px] sm:py-[30px]" aria-labelledby="home-ai-title">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Icon name="sparkles" size={20} />
          </span>
          <div>
            <h2 id="home-ai-title" className="text-[19px] font-bold">복약 질문 AI</h2>
            <p className="mt-1.5 max-w-[480px] break-keep text-base leading-[1.6] text-[#DFF3E8]">등록한 약을 바탕으로 질문하는 기능을 준비하고 있습니다.</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/[.22] px-[15px] py-[7px] text-[12.5px] font-semibold text-white">준비 중</span>
      </section>
    </div>
  );
}
