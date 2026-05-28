import { useState, useRef } from "react";

export default function DrugImage({ drug, imageUrl, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const prevUrl = useRef("");
  const sz = size === "sm" ? "w-12 h-12 text-2xl" : "w-24 h-24 text-5xl";

  if (imageUrl && imageUrl !== prevUrl.current) {
    prevUrl.current = imageUrl;
    if (failed) setFailed(false);
  }

  if (!imageUrl || failed) {
    return (
      <div className={`${sz} rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0`}>
        💊
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={drug?.ITEM_NAME}
      onError={() => setFailed(true)}
      className={`${sz} object-contain rounded-xl border border-gray-100 bg-white shrink-0`}
    />
  );
}
