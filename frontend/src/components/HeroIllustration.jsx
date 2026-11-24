export default function HeroIllustration() {
  return (
    <svg className="hero-illustration" viewBox="0 0 600 700" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="capsule-shell" x1="160" y1="250" x2="430" y2="450" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D8EFE1" />
        </linearGradient>
        <linearGradient id="capsule-green" x1="300" y1="290" x2="460" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1F8A5E" stopOpacity=".72" />
          <stop offset="1" stopColor="#146A45" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id="capsule-highlight" x1="200" y1="290" x2="420" y2="325" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity=".85" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="#1F8A5E" strokeOpacity=".16" strokeWidth="2">
        <path d="m364 138 76-44 76 44v88l-76 44-76-44zM440 94V51M516 226l43 25M364 226l-44 26" />
        <path d="m376 145 64-37 64 37M504 154v65M440 256l-64-37" />
        <circle cx="440" cy="43" r="8" fill="#EAF6EF" />
        <circle cx="566" cy="255" r="8" fill="#EAF6EF" />
        <circle cx="313" cy="257" r="8" fill="#EAF6EF" />
      </g>
      <g transform="rotate(-36 310 350)">
        <rect x="140" y="278" width="340" height="144" rx="72" fill="url(#capsule-shell)" stroke="#FFFFFF" strokeWidth="2" />
        <path d="M310 278h98a72 72 0 0 1 0 144h-98z" fill="url(#capsule-green)" />
        <path d="M310 280v140" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="2" />
        <path d="M175 320a46 46 0 0 1 38-20h190" stroke="url(#capsule-highlight)" strokeWidth="10" strokeLinecap="round" />
        <path d="M216 405h184" stroke="#146A45" strokeOpacity=".08" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g stroke="#1F8A5E" strokeOpacity=".12" strokeWidth="2">
        <path d="m155 509 47 27v54l-47 27-47-27v-54zM202 590l38 22M108 536l-34-20" />
        <circle cx="246" cy="616" r="7" fill="#EAF6EF" />
        <circle cx="68" cy="512" r="7" fill="#EAF6EF" />
      </g>
    </svg>
  );
}
