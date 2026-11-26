import Icon from "./Icon";

const messages = [
  { speaker: "나", text: "오늘 이 약 받았는데, 집에 있는 약이랑 같이 먹어도 되나?" },
  { speaker: "친구", text: "AI한테 물어봐도 확실친 않다던데…" },
  { speaker: "나", text: "병원 가기도 번거로우니까, 한번 조회해볼까?" },
];

export default function LandingConversation() {
  return (
    <section
      tabIndex={0}
      className="landing-conversation border-b border-line bg-mint/40"
      aria-labelledby="landing-conversation-title"
    >
      <div className="mx-auto flex min-h-full max-w-[960px] flex-col justify-center px-5 py-14 sm:px-8 sm:py-16">
        <h2 id="landing-conversation-title" className="text-center text-xs font-bold text-brand">
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
                  <p className={`mt-2 rounded-2xl px-5 py-4 text-left text-base leading-8 sm:px-6 sm:text-lg ${isFriend ? "rounded-tr-md border border-line bg-white text-ink" : "rounded-tl-md bg-brand text-white"}`}>
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
