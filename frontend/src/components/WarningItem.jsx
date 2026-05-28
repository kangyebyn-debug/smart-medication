import { COLOR } from "../constants/warnings";

export default function WarningItem({ item, color }) {
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
