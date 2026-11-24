export const WARN_TABS = [
  { key: "interaction", label: "병용금기", icon: "noEntry", color: "red" },
  { key: "pregnancy", label: "임부금기", icon: "info", color: "amber" },
  { key: "elderly", label: "노인주의", icon: "info", color: "amber" },
  { key: "age", label: "연령금기", icon: "info", color: "neutral" },
];

export const COLOR = {
  red: {
    wrap: "border-[#EFCAC7] bg-[#FDF3F3]",
    text: "text-[#B3443C]",
    badge: "bg-[#F7DEDC] text-[#9E3831]",
  },
  amber: {
    wrap: "border-[#EEDFC3] bg-[#FDF8EE]",
    text: "text-[#9A6A1C]",
    badge: "bg-[#F5E9CE] text-[#815511]",
  },
  neutral: {
    wrap: "border-line bg-[#F6F8F7]",
    text: "text-muted",
    badge: "bg-[#E7ECE9] text-[#39493F]",
  },
};
