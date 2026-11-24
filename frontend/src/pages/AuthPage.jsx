import { useState } from "react";
import Icon from "../components/Icon";

function errorMessage(error) {
  if (error?.message === "Invalid login credentials") return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (error?.message === "Email not confirmed") return "이메일 인증을 마친 뒤 로그인해주세요.";
  if (error?.message === "User already registered") return "이미 가입된 이메일입니다. 로그인해주세요.";
  return error?.message || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export default function AuthPage({ auth, notice }) {
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function changeMode(nextMode) {
    setMode(nextMode);
    setPassword("");
    setFeedback(null);
  }

  async function submit(event) {
    event.preventDefault();
    if (!auth.configured || busy) return;

    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = mode === "signUp"
        ? await auth.signUp(email.trim(), password)
        : await auth.signIn(email.trim(), password);
      if (error) {
        setFeedback({ type: "error", message: errorMessage(error) });
      } else if (mode === "signUp" && !data?.session) {
        setPassword("");
        setMode("signIn");
        setFeedback({ type: "success", message: "가입 요청을 완료했습니다. 확인 메일이 도착하면 인증한 뒤 로그인해주세요." });
      } else {
        setPassword("");
      }
    } catch (error) {
      setFeedback({ type: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setFeedback(null);
    try {
      const { error } = await auth.signOut();
      if (error) setFeedback({ type: "error", message: errorMessage(error) });
      else setFeedback({ type: "success", message: "로그아웃했습니다." });
    } catch (error) {
      setFeedback({ type: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[620px] break-keep py-3 sm:py-8">
      <p className="text-xs font-bold text-brand">계정</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {auth.session ? "내 계정" : "로그인하고 이어서 사용하세요"}
      </h1>
      <p className="mt-3 text-base leading-7 text-muted">
        {auth.session
          ? "현재 로그인한 계정을 확인하거나 로그아웃할 수 있습니다."
          : "약품 검색과 병용금기 확인은 로그인 없이 사용할 수 있습니다."}
      </p>
      {notice && !auth.session && (
        <p role="status" className="mt-5 rounded-xl border border-[#D8EFE1] bg-mint p-4 text-base leading-7 text-brand-dark">{notice}</p>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-[0_12px_32px_-24px_rgba(27,58,75,0.4)] sm:p-8">
        {auth.loading ? (
          <p role="status" className="text-base text-muted">로그인 상태를 확인하고 있습니다.</p>
        ) : auth.session ? (
          <div>
            <div className="flex items-start gap-4 rounded-xl border border-[#D8EFE1] bg-mint p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand"><Icon name="user" size={22} /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-dark">로그인 중</p>
                <p className="mt-1 break-all text-base text-ink">{auth.session.user.email}</p>
              </div>
            </div>
            <button type="button" onClick={signOut} disabled={busy} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl border border-line px-5 text-base font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50">
              {busy ? "처리 중…" : "로그아웃"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 border-b border-line" aria-label="계정 이용 방법">
              {[["signIn", "로그인"], ["signUp", "회원가입"]].map(([value, label]) => (
                <button key={value} type="button" onClick={() => changeMode(value)} aria-pressed={mode === value} className={`border-b-2 px-4 pb-3 text-base font-semibold ${mode === value ? "border-brand text-brand-dark" : "border-transparent text-muted hover:text-ink"}`}>
                  {label}
                </button>
              ))}
            </div>

            {!auth.configured && (
              <p role="alert" className="mt-5 rounded-xl border border-[#EFCAC7] bg-[#FDF3F3] p-4 text-base text-[#9E3831]">로그인 설정을 확인할 수 없습니다. 서비스 관리자에게 문의해주세요.</p>
            )}
            {auth.error && (
              <p role="alert" className="mt-5 rounded-xl border border-[#EFCAC7] bg-[#FDF3F3] p-4 text-base text-[#9E3831]">로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.</p>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="auth-email" className="mb-2 block text-base font-semibold text-ink">이메일</label>
                <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || !auth.configured} placeholder="name@example.com" className="min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none disabled:bg-surface" />
              </div>
              <div>
                <label htmlFor="auth-password" className="mb-2 block text-base font-semibold text-ink">비밀번호</label>
                <input id="auth-password" type="password" autoComplete={mode === "signUp" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy || !auth.configured} className="min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink focus:border-brand focus:outline-none disabled:bg-surface" />
                {mode === "signUp" && <p className="mt-2 text-sm text-muted">비밀번호는 6자 이상 입력해주세요.</p>}
              </div>
              <button type="submit" disabled={busy || !auth.configured} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
                {busy ? "처리 중…" : mode === "signUp" ? "회원가입" : "로그인"}
              </button>
            </form>
          </>
        )}

        {feedback && (
          <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border p-4 text-base leading-7 ${feedback.type === "error" ? "border-[#EFCAC7] bg-[#FDF3F3] text-[#9E3831]" : "border-[#D8EFE1] bg-mint text-brand-dark"}`}>
            {feedback.message}
          </p>
        )}
      </div>
    </section>
  );
}
