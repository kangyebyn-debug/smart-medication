export default function SearchResultItem({ drug, onSelect }) {
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
