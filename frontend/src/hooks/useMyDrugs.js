import { useEffect, useRef, useState } from "react";
import { addMyDrug, deleteMyDrug, getMyDrugs } from "../api";
import { supabase } from "../supabaseClient";

const emptyState = { userId: null, myDrugs: [], loadError: null, actionError: null, busy: false };

function errorMessage(error, action) {
  if (error?.status === 401) return "로그인 상태가 만료되었습니다. 로그아웃한 뒤 다시 로그인해주세요.";
  if (error?.status === 403) return "나의 약에 접근할 권한이 없습니다. 잠시 후 다시 시도해주세요.";
  return action === "load"
    ? "나의 약을 불러오지 못했습니다. 서버 연결을 확인한 뒤 다시 시도해주세요."
    : "나의 약을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function toMyDrug(row) {
  if (!row || typeof row.id !== "string" || typeof row.drug_name !== "string") {
    throw new Error("나의 약 응답 형식 오류");
  }
  // 저장소의 최소 필드를 기존 검색·병용금기 화면에서 쓰는 형태로 맞춘다.
  return { id: row.id, ITEM_NAME: row.drug_name, ITEM_SEQ: row.product_code || null };
}

function sameDrug(saved, drug) {
  const savedCode = saved.ITEM_SEQ ? String(saved.ITEM_SEQ) : "";
  const selectedCode = drug.ITEM_SEQ ? String(drug.ITEM_SEQ) : "";
  if (savedCode && selectedCode) return savedCode === selectedCode;
  return saved.ITEM_NAME === drug.ITEM_NAME;
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

export function useMyDrugs(session, onRequireAuth) {
  const userId = session?.user?.id;
  const [state, setState] = useState(emptyState);
  const [reloadCount, setReloadCount] = useState(0);
  const generationRef = useRef(0);
  const pendingRef = useRef(false);

  useEffect(() => {
    // 계정 전환이나 재조회 전의 응답이 새 목록을 덮어쓰지 않도록 세대를 구분한다.
    const generation = ++generationRef.current;
    pendingRef.current = false;
    if (!userId) {
      setState(emptyState);
      return;
    }

    let active = true;
    async function load() {
      try {
        const accessToken = await accessTokenFor(userId);
        const rows = await getMyDrugs(accessToken);
        const myDrugs = rows.map(toMyDrug);
        if (active && generationRef.current === generation) {
          setState({ ...emptyState, userId, myDrugs });
        }
      } catch (error) {
        if (active && generationRef.current === generation) {
          setState({ ...emptyState, userId, loadError: errorMessage(error, "load") });
        }
      }
    }
    load();
    return () => {
      active = false;
      generationRef.current = generation + 1;
    };
  }, [userId, reloadCount]);

  const current = state.userId === userId ? state : emptyState;
  const { myDrugs, loadError, actionError, busy } = current;
  const loading = Boolean(userId) && state.userId !== userId;

  function reload() {
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (!pendingRef.current) {
      setState(emptyState);
      setReloadCount((count) => count + 1);
    }
  }

  async function changeDrug(request, update) {
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (pendingRef.current || loading) return;
    if (loadError) {
      setState((previous) => ({ ...previous, actionError: "목록을 다시 불러온 뒤 시도해주세요." }));
      return;
    }

    const generation = generationRef.current;
    pendingRef.current = true;
    setState((previous) => ({ ...previous, busy: true, actionError: null }));
    try {
      const accessToken = await accessTokenFor(userId);
      const result = await request(accessToken);
      const updatedDrugs = update(myDrugs, result);
      if (generationRef.current === generation) {
        setState((previous) => previous.userId === userId ? {
          ...previous,
          myDrugs: updatedDrugs,
          busy: false,
        } : previous);
      }
    } catch (error) {
      if (generationRef.current === generation) {
        setState((previous) => previous.userId === userId
          ? { ...previous, busy: false, actionError: errorMessage(error, "change") }
          : previous);
      }
    } finally {
      if (generationRef.current === generation) pendingRef.current = false;
    }
  }

  function toggle(drug) {
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (pendingRef.current || loading) return;
    const existing = myDrugs.find((saved) => sameDrug(saved, drug));
    if (existing) {
      changeDrug(
        (accessToken) => deleteMyDrug(accessToken, existing.id),
        (previous) => previous.filter((saved) => saved.id !== existing.id)
      );
    } else {
      changeDrug(
        (accessToken) => addMyDrug(accessToken, drug),
        (previous, row) => [toMyDrug(row), ...previous]
      );
    }
  }

  function remove(drug) {
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (!drug.id) return;
    changeDrug(
      (accessToken) => deleteMyDrug(accessToken, drug.id),
      (previous) => previous.filter((saved) => saved.id !== drug.id)
    );
  }

  function has(drug) {
    return myDrugs.some((saved) => sameDrug(saved, drug));
  }

  return { myDrugs, loading, loadError, actionError, busy, reload, toggle, remove, has };
}
