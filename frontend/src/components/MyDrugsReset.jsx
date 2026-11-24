import { useEffect, useRef, useState } from "react";

export default function MyDrugsReset({ userId, myDrugsHook, disabled, onFeedback }) {
  const { myDrugs, loading, loadError, busy, reload, reset } = myDrugsHook;
  const [confirmingDrugs, setConfirmingDrugs] = useState(null);
  const [resetting, setResetting] = useState(false);
  const activeRef = useRef(false);
  const pendingRef = useRef(false);
  const confirming = confirmingDrugs === myDrugs;
  const unavailable = disabled || loading || Boolean(loadError) || busy || resetting;

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  async function resetDrugs() {
    if (unavailable || !confirming || pendingRef.current || myDrugs.length === 0) return;
    pendingRef.current = true;
    setResetting(true);
    onFeedback(null);
    try {
      const result = await reset(confirmingDrugs);
      if (!activeRef.current || !result) return;
      const { deletedCount, failedCount, expired, refreshError } = result;
      onFeedback({
        type: failedCount > 0 || refreshError ? "error" : "success",
        message: `${deletedCount}개 삭제됨.${failedCount > 0 ? ` ${failedCount}개는 삭제하지 못했습니다.${expired ? " 로그인 상태를 확인해주세요." : " 목록을 확인한 뒤 다시 시도해주세요."}` : ""}${refreshError ? ` ${refreshError}` : ""}`,
        userId,
      });
      setConfirmingDrugs(null);
    } catch (error) {
      if (activeRef.current) {
        onFeedback({
          type: "error",
          message: error?.status === 401
            ? "로그인 상태가 만료되었습니다. 로그아웃한 뒤 다시 로그인해주세요."
            : "나의 약 목록을 초기화하지 못했습니다. 잠시 후 다시 시도해주세요.",
          userId,
        });
      }
    } finally {
      if (activeRef.current) {
        pendingRef.current = false;
        setResetting(false);
      }
    }
  }

  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="reset-drugs-title">
      <h2 id="reset-drugs-title" className="text-base font-semibold text-ink">나의 약 목록 초기화</h2>
      <p className="mt-2 text-base leading-7 text-muted">계정에 저장한 약 목록을 모두 삭제합니다.</p>
      {loading ? (
        <p role="status" className="mt-3 text-sm text-muted">저장한 약을 불러오는 중…</p>
      ) : loadError ? (
        <div role="alert" className="mt-4 rounded-xl border border-[#EFCAC7] bg-[#FDF3F3] p-4 text-base leading-7 text-[#9E3831]">
          <p>{loadError}</p>
          <button type="button" onClick={reload} disabled={disabled || busy || resetting} className="mt-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">목록 다시 불러오기</button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{myDrugs.length > 0 ? `저장된 약 ${myDrugs.length}개` : "저장된 약이 없습니다."}</p>
      )}
      {confirming ? (
        <div role="group" aria-label="나의 약 목록 초기화 확인" className="mt-4 rounded-xl border border-[#EFCAC7] bg-[#FDF3F3] p-4">
          <p className="text-base leading-7 text-[#9E3831]">저장한 약 {confirmingDrugs.length}개를 모두 삭제할까요?</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirmingDrugs(null)} disabled={resetting} className="min-h-12 rounded-xl border border-line bg-white px-5 text-base font-semibold text-ink disabled:opacity-50">취소</button>
            <button type="button" onClick={resetDrugs} disabled={unavailable} className="min-h-12 rounded-xl bg-[#9E3831] px-5 text-base font-semibold text-white disabled:opacity-50">{resetting ? "삭제 중…" : "삭제"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { onFeedback(null); setConfirmingDrugs(myDrugs); }} disabled={unavailable || myDrugs.length === 0} className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl border border-[#EFCAC7] px-5 text-base font-semibold text-[#9E3831] transition-colors hover:bg-[#FDF3F3] disabled:opacity-50">나의 약 목록 초기화</button>
      )}
    </section>
  );
}
