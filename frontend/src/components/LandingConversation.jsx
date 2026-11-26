import { useEffect, useRef } from "react";
import Icon from "./Icon";

const messages = [
  { speaker: "나", text: "오늘 이 약 받았는데, 집에 있는 약이랑 같이 먹어도 되나?" },
  { speaker: "친구", text: "AI한테 물어봐도 확실친 않다던데…" },
  { speaker: "나", text: "병원 가기도 번거로우니까, 한번 조회해볼까?" },
];

export default function LandingConversation() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer = null;

    function resetMotion() {
      observer?.disconnect();
      observer = null;
      delete section.dataset.motion;
      delete section.dataset.visible;
      if (reducedMotion.matches) return;

      // 내용 길이가 아닌 고정 높이 섹션을 관찰해, 작은 화면에서도 진입을 감지한다.
      const nextObserver = new IntersectionObserver(([entry]) => {
        if (observer !== nextObserver) return;
        if (entry.intersectionRatio >= 0.25) section.dataset.visible = "true";
        // 인접 섹션에 스냅되어 경계만 닿아 있는 경우도 이탈로 처리한다.
        else if (!entry.isIntersecting || entry.intersectionRatio === 0) section.dataset.visible = "false";
      }, {
        root: section.parentElement,
        // 스냅 경계에 닿았다는 이유로 계속 intersecting 상태가 되는 것을 피한다.
        rootMargin: "-1px 0px",
        threshold: [0, 0.25],
      });

      observer = nextObserver;
      section.dataset.motion = "ready";
      observer.observe(section);
    }

    resetMotion();
    reducedMotion.addEventListener("change", resetMotion);
    return () => {
      observer?.disconnect();
      observer = null;
      reducedMotion.removeEventListener("change", resetMotion);
      delete section.dataset.motion;
      delete section.dataset.visible;
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      tabIndex={0}
      className="landing-conversation wrap-anywhere border-b border-line bg-mint/40"
      aria-labelledby="landing-conversation-title"
    >
      <div className="mx-auto flex min-h-full max-w-[960px] flex-col justify-center px-5 py-14 sm:px-8 sm:py-16">
        <h2 id="landing-conversation-title" className="text-center text-xs font-bold text-brand-dark">
          AI 챗봇이 아니라, 공공 데이터로 확인
        </h2>
        <ol className="mt-10 flex flex-col gap-6 sm:mt-14 sm:gap-8">
          {messages.map(({ speaker, text }, index) => {
            const isFriend = speaker === "친구";

            return (
              <li
                key={index}
                className={`conversation-turn flex items-start gap-3 sm:gap-4 ${isFriend ? "flex-row-reverse" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border sm:h-12 sm:w-12 ${isFriend ? "border-line bg-white text-muted" : "border-brand/20 bg-mint text-brand"}`}
                >
                  <Icon name="user" size={21} />
                </span>
                <div className={`min-w-0 max-w-[680px] ${isFriend ? "text-right" : ""}`}>
                  <p className={`text-xs font-bold sm:text-sm ${isFriend ? "text-muted" : "text-brand-dark"}`}>
                    {speaker}
                  </p>
                  <p className={`mt-2 rounded-2xl px-5 py-4 text-left text-base leading-8 sm:px-6 sm:text-lg ${isFriend ? "rounded-tr-md border border-line bg-white text-ink" : "rounded-tl-md bg-brand-dark text-white"}`}>
                    {text}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
