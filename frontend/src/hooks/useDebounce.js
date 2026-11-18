import { useState, useEffect, useRef } from "react";
import { searchDrug } from "../api";

export function useDebounce(query, delay = 350) {
  const normalizedQuery = query.trim();
  const [searchState, setSearchState] = useState({ query: "", results: [], loading: false, error: false, completed: false });
  const [retryToken, setRetryToken] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let active = true;
    const t = setTimeout(async () => {
      if (!active || requestIdRef.current !== requestId) return;
      if (!normalizedQuery) {
        setSearchState({ query: "", results: [], loading: false, error: false, completed: false });
        return;
      }

      setSearchState({ query: normalizedQuery, results: [], loading: true, error: false, completed: false });
      try {
        const data = await searchDrug(normalizedQuery);
        if (active && requestIdRef.current === requestId) {
          setSearchState({ query: normalizedQuery, results: data.items || [], loading: false, error: false, completed: true });
        }
      } catch {
        if (active && requestIdRef.current === requestId) {
          setSearchState({ query: normalizedQuery, results: [], loading: false, error: true, completed: true });
        }
      }
    }, normalizedQuery ? delay : 0);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [normalizedQuery, delay, retryToken]);

  const currentState = searchState.query === normalizedQuery ? searchState : null;
  return {
    results: currentState?.results || [],
    loading: currentState?.loading || false,
    error: currentState?.error || false,
    completed: currentState?.completed || false,
    retry: () => {
      requestIdRef.current++;
      setSearchState({ query: normalizedQuery, results: [], loading: true, error: false, completed: false });
      setRetryToken(token => token + 1);
    },
    clear: () => {
      requestIdRef.current++;
      setSearchState({ query: "", results: [], loading: false, error: false, completed: false });
    },
  };
}
