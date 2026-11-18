import { useState } from "react";
import Icon from "./Icon";

export default function DrugImage({ drug, imageUrl, size = "md" }) {
  const sz = size === "sm" ? "h-12 w-12" : "h-24 w-24";
  const iconSize = size === "sm" ? 21 : 36;

  if (!imageUrl) {
    return (
      <div aria-hidden="true" className={`${sz} flex shrink-0 items-center justify-center rounded-2xl border border-[#D8EFE1] bg-mint text-brand`}>
        <Icon name="pill" size={iconSize} />
      </div>
    );
  }

  return <ImageWithFallback key={imageUrl} drug={drug} imageUrl={imageUrl} sz={sz} iconSize={iconSize} />;
}

function ImageWithFallback({ drug, imageUrl, sz, iconSize }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div aria-hidden="true" className={`${sz} flex shrink-0 items-center justify-center rounded-2xl border border-[#D8EFE1] bg-mint text-brand`}>
        <Icon name="pill" size={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={drug?.ITEM_NAME}
      onError={() => setFailed(true)}
      className={`${sz} shrink-0 rounded-2xl border border-line bg-white object-contain p-1`}
    />
  );
}
