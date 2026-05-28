import DrugImage from "./DrugImage";

export default function DrugInfoCard({ drug, imageUrl, classNoName, onClear, onBookmark, isBookmarked }) {
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
