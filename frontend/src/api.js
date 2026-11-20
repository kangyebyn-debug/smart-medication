const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function drugLookupQuery(name, itemSeq) {
  const params = new URLSearchParams({ name });
  if (itemSeq) params.set("item_seq", String(itemSeq));
  return params.toString();
}

export async function searchDrug(name, page = 1, size = 10) {
  const res = await fetch(
    `${BASE}/drugs/search?name=${encodeURIComponent(name)}&page=${page}&size=${size}`
  );
  if (!res.ok) throw new Error("검색 실패");
  return res.json();
}

export async function getDrugImage(name, itemSeq) {
  const res = await fetch(`${BASE}/drugs/image?${drugLookupQuery(name, itemSeq)}`);
  if (!res.ok) return { imageUrl: "", classNoName: "" };
  return res.json();
}

export async function getAllWarnings(name, itemSeq) {
  const res = await fetch(
    `${BASE}/drugs/warnings?${drugLookupQuery(name, itemSeq)}`
  );
  if (!res.ok) throw new Error("금기 정보 조회 실패");
  return res.json();
}

export async function checkInteraction(drug1, drug2) {
  const res = await fetch(
    `${BASE}/drugs/check?drug1=${encodeURIComponent(drug1)}&drug2=${encodeURIComponent(drug2)}`
  );
  if (!res.ok) throw new Error("병용금기 조회 실패");
  return res.json();
}

async function myDrugsRequest(path, accessToken, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const error = new Error("나의 약 요청 실패");
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getMyDrugs(accessToken) {
  const rows = await myDrugsRequest("/me/drugs", accessToken);
  if (!Array.isArray(rows)) throw new Error("나의 약 응답 형식 오류");
  return rows;
}

export function addMyDrug(accessToken, drug) {
  return myDrugsRequest("/me/drugs", accessToken, {
    method: "POST",
    body: JSON.stringify({
      drug_name: drug.ITEM_NAME,
      product_code: drug.ITEM_SEQ ? String(drug.ITEM_SEQ) : null,
    }),
  });
}

export function deleteMyDrug(accessToken, id) {
  return myDrugsRequest(`/me/drugs/${encodeURIComponent(id)}`, accessToken, { method: "DELETE" });
}
