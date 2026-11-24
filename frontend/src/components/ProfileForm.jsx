import { useEffect, useRef, useState } from "react";
import { getMyProfile, updateMyProfile } from "../api";
import { supabase } from "../supabaseClient";

function profileError(error) {
  if (error?.status === 401) return "로그인 상태가 만료되었습니다. 로그아웃한 뒤 다시 로그인해주세요.";
  if (error?.status === 403) return "프로필에 접근할 권한이 없습니다. 잠시 후 다시 시도해주세요.";
  if (error?.status === 404) return "계정 프로필을 찾을 수 없습니다. 서비스 관리자에게 문의해주세요.";
  return "표시 이름을 처리하지 못했습니다. 서버 연결을 확인한 뒤 다시 시도해주세요.";
}

async function accessTokenFor(userId) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data?.session?.user?.id !== userId || !data.session.access_token) {
    const authError = new Error("로그인이 필요합니다.");
    authError.status = 401;
    throw authError;
  }
  return data.session.access_token;
}

export default function ProfileForm({ userId, disabled, onFeedback }) {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const activeRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    activeRef.current = true;
    async function load() {
      try {
        const token = await accessTokenFor(userId);
        const profile = await getMyProfile(token);
        if (active) {
          setDisplayName(profile.display_name ?? "");
          setLoadFailed(false);
        }
      } catch (error) {
        if (active) {
          setLoadFailed(true);
          onFeedback({ type: "error", message: profileError(error), userId });
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
      activeRef.current = false;
    };
  }, [userId, onFeedback, reloadCount]);

  async function save(event) {
    event.preventDefault();
    if (disabled || loading || loadFailed || pendingRef.current) return;
    pendingRef.current = true;
    setSaving(true);
    onFeedback(null);
    try {
      const token = await accessTokenFor(userId);
      if (!activeRef.current) return;
      const profile = await updateMyProfile(token, displayName);
      if (activeRef.current) {
        setDisplayName(profile.display_name ?? "");
        onFeedback({ type: "success", message: "표시 이름을 저장했습니다.", userId });
      }
    } catch (error) {
      if (activeRef.current) onFeedback({ type: "error", message: profileError(error), userId });
    } finally {
      if (activeRef.current) {
        pendingRef.current = false;
        setSaving(false);
      }
    }
  }

  return (
    <form onSubmit={save} className="mt-8 border-t border-line pt-6" aria-label="표시 이름 수정">
      <label htmlFor="profile-display-name" className="mb-2 block text-base font-semibold text-ink">표시 이름</label>
      {loading && <p role="status" className="mb-3 text-sm text-muted">표시 이름을 불러오는 중…</p>}
      {loadFailed && (
        <button type="button" onClick={() => { setLoading(true); setLoadFailed(false); onFeedback(null); setReloadCount((count) => count + 1); }} disabled={disabled} className="mb-3 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-brand disabled:opacity-50">표시 이름 다시 불러오기</button>
      )}
      <input id="profile-display-name" type="text" autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={disabled || loading || loadFailed || saving} className="min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink focus:border-brand focus:outline-none disabled:bg-surface" />
      <button type="submit" disabled={disabled || loading || loadFailed || saving} className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
        {saving ? "저장 중…" : "표시 이름 저장"}
      </button>
    </form>
  );
}
