import { useState, useEffect } from "react";
import { searchDrug } from "../api";

export function useDebounce(query, delay = 350) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await searchDrug(query.trim());
        setResults(d.items || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, delay);
    return () => clearTimeout(t);
  }, [query]);

  return { results, loading, clear: () => setResults([]) };
}
