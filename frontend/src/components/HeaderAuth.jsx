import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

function getErrorMessage(error) {
  return error?.message || "로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export default function HeaderAuth({ auth, onSignIn, onOpenAccount }) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const firstItemRef = useRef(null);
  const menuId = useId();
  const triggerId = useId();
  const email = auth.session?.user?.email;

  useEffect(() => {
    if (!menuOpen || !auth.session) return;

    firstItemRef.current?.focus();

    function closeOnOutsideInteraction(event) {
      if (!dropdownRef.current?.contains(event.target)) setMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("focusin", closeOnOutsideInteraction);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("focusin", closeOnOutsideInteraction);
    };
  }, [menuOpen, auth.session]);

  function closeMenu() {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event) {
    const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const index = items.indexOf(document.activeElement);
    let next;

    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Tab") {
      // Let the browser move focus before removing the menu from the tab order.
      window.setTimeout(() => setMenuOpen(false), 0);
      return;
    } else return;

    event.preventDefault();
    items[next]?.focus();
  }

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
    <div
      ref={dropdownRef}
      className="relative z-20 flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2"
      onKeyDown={(event) => {
        if (menuOpen && event.key === "Escape") {
          event.preventDefault();
          closeMenu();
        }
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setMenuOpen(true);
            if (menuOpen) firstItemRef.current?.focus();
          }
        }}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-xs text-muted transition-colors hover:border-brand hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-sm"
      >
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-brand">
          <Icon name="user" size={16} />
        </span>
        <span title={email} className="max-w-[180px] truncate sm:max-w-[240px]">{email || "로그인 사용자"}</span>
        <Icon name="chevronRight" size={14} className="shrink-0 rotate-90" />
      </button>
      {menuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-2xl border border-line bg-white/95 p-1.5 shadow-lg backdrop-blur"
        >
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              closeMenu();
              onOpenAccount();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-mint focus:bg-mint focus:outline-none"
          >
            <Icon name="user" size={17} />
            내 계정
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              closeMenu();
              signOut();
            }}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted hover:bg-mint hover:text-brand focus:bg-mint focus:text-brand focus:outline-none disabled:cursor-wait disabled:opacity-50"
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 17l5-5-5-5M15 12H3" />
              <path d="M12 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
            </svg>
            로그아웃
          </button>
        </div>
      )}
      {errorMessage && <p role="alert" className="basis-full text-right text-xs text-[#B3443C]">{errorMessage}</p>}
    </div>
  );
}
