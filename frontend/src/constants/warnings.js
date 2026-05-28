export const WARN_TABS = [
  { key: "interaction", label: "병용금기", icon: "⚠️", color: "red" },
  { key: "pregnancy",   label: "임부금기", icon: "🤰", color: "pink" },
  { key: "elderly",     label: "노인주의", icon: "👴", color: "amber" },
  { key: "age",         label: "연령금기", icon: "👶", color: "blue" },
];

export const COLOR = {
  red:   { wrap: "border-red-100 bg-red-50",    text: "text-red-600",   badge: "bg-red-100 text-red-700" },
  pink:  { wrap: "border-pink-100 bg-pink-50",   text: "text-pink-600",  badge: "bg-pink-100 text-pink-700" },
  amber: { wrap: "border-amber-100 bg-amber-50", text: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  blue:  { wrap: "border-blue-100 bg-blue-50",   text: "text-blue-600",  badge: "bg-blue-100 text-blue-700" },
};
