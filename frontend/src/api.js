const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function searchDrug(name, page = 1, size = 10) {
  const res = await fetch(
    `${BASE}/drugs/search?name=${encodeURIComponent(name)}&page=${page}&size=${size}`
  );
  if (!res.ok) throw new Error("검색 실패");
  return res.json();
}

export async function checkInteraction(drug1, drug2) {
  const res = await fetch(
    `${BASE}/drugs/check?drug1=${encodeURIComponent(drug1)}&drug2=${encodeURIComponent(drug2)}`
  );
  if (!res.ok) throw new Error("병용금기 조회 실패");
  return res.json();
}
