import DrugImage from "./DrugImage";
import Icon from "./Icon";

export default function DrugInfoCard({ drug, imageUrl, classNoName, onClear, onBookmark, isBookmarked, bookmarkDisabled }) {
  const typeLabel = classNoName || drug?.ETC_OTC_CODE || null;
  return (
    <div className="drug-info-card ui-glass-card flex flex-wrap items-center border sm:flex-nowrap">
      <DrugImage drug={drug} imageUrl={imageUrl} size="md" />
      <div className="min-w-[10rem] flex-1">
        <p className="ui-eyebrow font-bold text-brand">선택한 의약품</p>
        <h2 className="mt-1 break-keep font-bold leading-snug text-ink [overflow-wrap:anywhere]">{drug.ITEM_NAME}</h2>
        {drug.ENTP_NAME && <p className="mt-1 text-base text-muted [overflow-wrap:anywhere]">{drug.ENTP_NAME}</p>}
        {drug.MATERIAL_NAME && <p className="mt-2 break-keep text-base leading-relaxed text-muted [overflow-wrap:anywhere]">{drug.MATERIAL_NAME}</p>}
        {typeLabel && (
          <span className="mt-3 inline-flex rounded-full border border-[#D8EFE1] bg-mint px-2.5 py-1 text-xs font-semibold text-brand-dark">
            {typeLabel}
          </span>
        )}
      </div>
      {(onBookmark || onClear) && (
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:flex-col sm:items-end">
          {onBookmark && (
            <button
              type="button"
              onClick={onBookmark}
              aria-pressed={isBookmarked}
              disabled={bookmarkDisabled}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${isBookmarked ? "border-brand bg-mint text-brand-dark" : "border-line bg-white text-muted hover:border-brand hover:text-brand"}`}
            >
              <Icon name="bookmark" size={15} />
              {isBookmarked ? "나의 약에서 제거" : "나의 약에 추가"}
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="선택한 약품 닫기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Icon name="close" size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
