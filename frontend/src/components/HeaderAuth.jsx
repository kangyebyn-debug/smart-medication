import { useState } from "react";
import Icon from "./Icon";

function getErrorMessage(error) {
  return error?.message || "로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export default function HeaderAuth({ auth, onSignIn }) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const email = auth.session?.user?.email;

  async function signOut() {
    if (busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { error } = await auth.signOut();
      if (error) setErrorMessage(getErrorMessage(error));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!auth.session) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-brand transition-colors hover:border-brand hover:bg-mint sm:text-sm"
      >
        <Icon name="user" size={16} />
        로그인
      </button>
    );
  }

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
      <div className="flex min-w-0 max-w-full items-center gap-2 text-xs text-muted sm:text-sm">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-brand">
          <Icon name="user" size={16} />
        </span>
        <span title={email} className="max-w-[180px] truncate sm:max-w-[240px]">{email || "로그인 사용자"}</span>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        title="로그아웃"
        aria-label="로그아웃"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-brand hover:bg-mint hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-50"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
        </svg>
      </button>
      {errorMessage && <p role="alert" className="basis-full text-right text-xs text-[#B3443C]">{errorMessage}</p>}
    </div>
  );
}
