const shapes = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  pill: <><rect x="3" y="7" width="18" height="10" rx="5" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 21v-7h6v7" /></>,
  compare: <><rect x="2.7" y="5" width="7.5" height="14" rx="3.7" /><path d="M2.8 12h7.3" /><rect x="13.8" y="5" width="7.5" height="14" rx="3.7" /><path d="M13.9 12h7.3" /><path d="M11.2 12h1.6" /></>,
  bookmark: <path d="M5.5 3.5h13v17l-6.5-4.2-6.5 4.2z" />,
  arrowRight: <><path d="M3.5 12h17" /><path d="m14 5.5 6.5 6.5-6.5 6.5" /></>,
  shield: <><path d="M12 2.5 20 6v5.8c0 5.1-3.4 8.3-8 9.7-4.6-1.4-8-4.6-8-9.7V6z" /><path d="m8.8 12 2.2 2.2 4.3-4.4" /></>,
  sparkles: <><path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" /><path d="M4 15v4M2 17h4" /></>,
  close: <><path d="M5 5 19 19" /><path d="M19 5 5 19" /></>,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  alert: <><path d="M10.3 3.8a2 2 0 0 1 3.4 0l8 13.5a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3z" /><path d="M12 9v4.5M12 17h.01" /></>,
};

export default function Icon({ name, size = 20, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {shapes[name] || shapes.info}
    </svg>
  );
}
