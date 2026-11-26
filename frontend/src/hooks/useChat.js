import { useEffect, useRef, useState } from "react";
import { createChatSession, listChatMessages, listChatSessions, sendChatMessage } from "../api";
import { supabase } from "../supabaseClient";

const emptyState = {
  userId: null, sessionId: null, messages: [], loadError: null, actionError: null, busy: false,
};
const uncertainSendMessage = "전송 결과를 확인하지 못했습니다. 같은 질문을 다시 보내기 전에 대화를 다시 불러와 저장 여부를 확인해주세요.";

function errorMessage(error, action) {
  if (error?.status === 401) return "로그인 상태가 만료되었습니다. 로그아웃한 뒤 다시 로그인해주세요.";
  if (error?.status === 403) return "대화에 접근할 권한이 없습니다. 잠시 후 다시 시도해주세요.";
  if (error?.status === 429) return "AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
  if (action === "send" && (!error?.status || error.status === 502)) return uncertainSendMessage;
  if (error?.status === 503) return "AI 또는 대화 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해주세요.";
  if (error?.status === 502) return "대화 또는 공공 의약품 정보를 불러오지 못했습니다. 잠시 후 다시 불러와주세요.";
  return action === "load"
    ? "대화를 불러오지 못했습니다. 서버 연결을 확인한 뒤 다시 불러와주세요."
    : "질문을 전송하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

async function accessTokenFor(userId) {
  const { data, error } = supabase ? await supabase.auth.getSession() : {};
  if (error || data?.session?.user?.id !== userId || !data.session.access_token) {
    const authError = new Error("로그인이 필요합니다.");
    authError.status = 401;
    throw authError;
  }
  return data.session.access_token;
}

export function useChat(session, onRequireAuth) {
  const userId = session?.user?.id;
  const [state, setState] = useState(emptyState);
  const [reloadCount, setReloadCount] = useState(0);
  const generationRef = useRef(0);
  const pendingRef = useRef(false);
  const activeUserRef = useRef(null);

  useEffect(() => {
    const generation = ++generationRef.current;
    activeUserRef.current = userId || null;
    pendingRef.current = Boolean(userId);
    let active = true;
    const isCurrent = () => active && generationRef.current === generation;
    if (!userId) {
      // 화면은 아래 계정 마스킹으로 즉시 비우고, 보관 상태도 비동기로 정리한다.
      Promise.resolve().then(() => {
        if (isCurrent()) setState(emptyState);
      });
    } else {
      async function load() {
        let sessionId = null;
        try {
          const accessToken = await accessTokenFor(userId);
          if (!isCurrent()) return;
          const sessions = await listChatSessions(accessToken);
          if (!isCurrent()) return;
          // 서버의 최신순 목록 첫 대화를 이어가며, 정상 빈 목록일 때만 생성한다.
          let chatSession = sessions[0];
          if (!chatSession) {
            chatSession = await createChatSession(accessToken);
            if (!isCurrent()) return;
          }
          sessionId = chatSession.id;
          const messages = await listChatMessages(accessToken, sessionId);
          if (!isCurrent()) return;
          setState({ ...emptyState, userId, sessionId, messages });
        } catch (error) {
          if (isCurrent()) {
            setState({ ...emptyState, userId, sessionId, loadError: errorMessage(error, "load") });
          }
        } finally {
          if (isCurrent()) pendingRef.current = false;
        }
      }
      load();
    }
    return () => {
      active = false;
      activeUserRef.current = null;
      generationRef.current = generation + 1;
    };
  }, [userId, reloadCount]);

  // 이전 계정의 목록은 새 계정의 effect가 실행되기 전 렌더에서도 노출하지 않는다.
  const current = state.userId === userId ? state : emptyState;
  const { messages, loadError, actionError, busy } = current;
  const loading = Boolean(userId) && state.userId !== userId;

  function reload() {
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (pendingRef.current || loading || activeUserRef.current !== userId) return;
    // 재렌더 전 연속 클릭도 막는다. 목록 오류를 정상적인 빈 세션 목록으로 간주하지 않는다.
    pendingRef.current = true;
    setState(emptyState);
    setReloadCount((count) => count + 1);
  }

  async function send(content) {
    if (!userId) {
      onRequireAuth();
      return false;
    }
    if (pendingRef.current || loading || activeUserRef.current !== userId) return false;
    if (loadError || !current.sessionId) {
      setState((previous) => previous.userId === userId
        ? { ...previous, actionError: "대화를 다시 불러온 뒤 질문해주세요." }
        : previous);
      return false;
    }
    const question = typeof content === "string" ? content.trim() : "";
    if (!question) return false;

    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation && activeUserRef.current === userId;
    pendingRef.current = true;
    setState((previous) => previous.userId === userId
      ? { ...previous, busy: true, actionError: null }
      : previous);
    let sent = false;
    try {
      const accessToken = await accessTokenFor(userId);
      if (!isCurrent()) return false;
      await sendChatMessage(accessToken, current.sessionId, question);
      if (!isCurrent()) return false;
      sent = true;
      // 낙관적으로 메시지를 꾸미지 않고 서버에 함께 저장된 두 행을 다시 읽는다.
      const updatedMessages = await listChatMessages(accessToken, current.sessionId);
      if (!isCurrent()) return false;
      setState((previous) => previous.userId === userId
        ? { ...previous, messages: updatedMessages, busy: false, loadError: null, actionError: null }
        : previous);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      const notice = sent
        ? `질문 전송과 응답 저장은 완료되었지만 대화를 새로 읽지 못했습니다. 같은 질문을 다시 보내지 말고 대화를 다시 불러와주세요. ${errorMessage(error, "load")}`
        : errorMessage(error, "send");
      const needsReload = sent || !error?.status || error.status === 502;
      setState((previous) => previous.userId === userId
        ? { ...previous, busy: false, actionError: notice, loadError: needsReload ? notice : previous.loadError }
        : previous);
      return sent;
    } finally {
      if (isCurrent()) pendingRef.current = false;
    }
  }

  return { messages, loading, loadError, actionError, busy, reload, send };
}
