import Icon from "./Icon";

export default function SearchResultItem({ drug, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(drug)}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-white p-3 text-left transition-colors hover:border-brand hover:bg-mint/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D8EFE1] bg-mint text-brand">
        <Icon name="pill" size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-keep text-base font-semibold text-ink [overflow-wrap:anywhere]">{drug.ITEM_NAME}</span>
        <span className="mt-0.5 block text-base text-muted [overflow-wrap:anywhere]">{drug.ENTP_NAME}</span>
        {drug.MATERIAL_NAME && <span className="mt-0.5 block truncate text-base text-muted">{drug.MATERIAL_NAME}</span>}
      </span>
      <span aria-hidden="true" className="shrink-0 text-brand">
        <Icon name="chevronRight" size={18} />
      </span>
    </button>
  );
}
