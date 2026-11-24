import { COLOR } from "../constants/warnings";

export default function WarningItem({ item, color }) {
  const s = COLOR[color];
  return (
    <div className={`rounded-2xl border px-[18px] py-4 ${s.wrap}`}>
      <p className="break-keep text-base font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
        {item.MIXTURE_ITEM_NAME || item.INGR_KOR_NAME || "-"}
      </p>
      {item.MIXTURE_INGR_KOR_NAME && (
        <p className="mt-1 break-keep text-base text-muted [overflow-wrap:anywhere]">
          {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
        </p>
      )}
      {item.AGRDE_SE_NAME && (
        <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${s.badge}`}>{item.AGRDE_SE_NAME}</span>
      )}
      {item.GRADE && (
        <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${s.badge}`}>{item.GRADE}등급</span>
      )}
      {item.PROHBT_CONTENT && (
        <p className={`mt-2 break-keep text-base leading-relaxed [overflow-wrap:anywhere] ${s.text}`}>{item.PROHBT_CONTENT}</p>
      )}
    </div>
  );
}
