import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import Icon from "../components/Icon";
import Spinner from "../components/Spinner";

export default function ChatPage({ session, onRequireAuth }) {
  const { messages, loading, loadError, actionError, busy, reload, send } = useChat(session, onRequireAuth);
  const [draft, setDraft] = useState("");
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const disabled = loading || busy || Boolean(loadError);

  useEffect(() => {
    // 대화 영역만 이동해 페이지와 입력창의 위치는 유지한다.
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy]);

  async function submit(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || disabled) return;
    if (await send(content)) {
      setDraft("");
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  return (
    <section className="w-full space-y-[22px] break-keep">
      <header>
        <p className="ui-eyebrow font-bold text-brand">등록약 기반 확인</p>
        <h1 className="ui-page-title text-2xl font-extrabold text-ink">복약 질문 AI</h1>
        <p className="text-base leading-[1.6] text-muted">등록한 약의 공공 DUR 병용금기 조회 결과를 바탕으로 답합니다.</p>
      </header>

      {(loadError || actionError) && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEDFC3] bg-[#FDF8EE] p-4 text-base text-[#815511]">
          <span>{loadError || actionError}</span>
          <button type="button" onClick={reload} disabled={busy || loading} className="rounded-full border border-[#D8C6A3] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#FDF8EE] disabled:opacity-50">
            대화 다시 불러오기
          </button>
        </div>
      )}

      <div className="ui-glass-card min-w-0 rounded-[22px] border p-5 sm:px-7 sm:py-[26px]">
        <h2 className="flex items-center gap-2.5 border-b border-line pb-4 text-[17px] font-bold text-ink">
          <Icon name="sparkles" size={20} className="text-brand" />대화
        </h2>
        <div ref={logRef} role="log" aria-label="복약 질문 대화" aria-live="polite" aria-relevant="additions" aria-busy={loading || busy} tabIndex={0} className="my-5 max-h-[55dvh] min-h-[240px] space-y-5 overflow-y-auto overscroll-contain rounded-xl p-1">
          {loading ? (
            <Spinner label="대화를 불러오는 중…" />
          ) : messages.length === 0 && !loadError ? (
            <div className="py-12 text-center">
              <p className="text-lg font-bold text-ink">등록한 약에 대해 질문해보세요</p>
              <p className="mt-2 text-base leading-7 text-muted">예: 등록한 약 사이에 병용금기가 있는지 알려주세요.</p>
            </div>
          ) : messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%] sm:px-5 sm:py-4 ${message.role === "user" ? "rounded-tr-sm bg-brand text-white" : "rounded-tl-sm border border-line bg-mint text-ink"}`}>
                <p className={`mb-1.5 text-sm font-bold ${message.role === "user" ? "text-white" : "text-brand-dark"}`}>{message.role === "user" ? "나" : "복약 질문 AI"}</p>
                <p className="whitespace-pre-wrap break-words text-base leading-7 [overflow-wrap:anywhere]">{message.content}</p>
              </div>
            </div>
          ))}
          {busy && <Spinner label="등록한 약의 병용금기 근거를 확인하고 답변을 준비하고 있습니다…" />}
        </div>

        <form onSubmit={submit} className="border-t border-line pt-5">
          <label htmlFor="chat-question" className="mb-2 block text-base font-semibold text-ink">질문</label>
          <div className="flex flex-wrap gap-3 sm:flex-nowrap">
            <input ref={inputRef} id="chat-question" type="text" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
            }} disabled={disabled} required aria-describedby="chat-question-help" autoComplete="off" placeholder="등록한 약에 대해 질문해주세요" className="min-h-12 w-full min-w-0 rounded-full border border-line bg-white px-4 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none disabled:bg-surface disabled:opacity-60" />
            <button type="submit" disabled={disabled || !draft.trim()} className="ui-primary-action inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:w-auto">
              {busy ? "답변 준비 중…" : "전송"}<Icon name="arrowRight" size={18} />
            </button>
          </div>
          <p id="chat-question-help" className="mt-3 text-sm leading-6 text-muted">현재 ‘나의 약’에 등록된 약 조합만 확인합니다.</p>
        </form>
      </div>
    </section>
  );
}
