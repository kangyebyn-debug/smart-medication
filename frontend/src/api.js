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

async function profileRequest(accessToken, options = {}) {
  const res = await fetch(`${BASE}/me/profile`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const error = new Error("프로필 요청 실패");
    error.status = res.status;
    throw error;
  }
  const profile = await res.json();
  if (!profile || !(profile.display_name === null || typeof profile.display_name === "string")) {
    throw new Error("프로필 응답 형식 오류");
  }
  return profile;
}

export function getMyProfile(accessToken) {
  return profileRequest(accessToken);
}

export function updateMyProfile(accessToken, displayName) {
  return profileRequest(accessToken, {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName.trim() || null }),
  });
}

function invalidChatResponse() {
  const error = new Error("대화 응답 형식 오류");
  error.status = 502;
  return error;
}

async function chatRequest(path, accessToken, options = {}) {
  const res = await fetch(`${BASE}/chat${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const error = new Error("대화 요청 실패");
    error.status = res.status;
    throw error;
  }
  try {
    return await res.json();
  } catch {
    throw invalidChatResponse();
  }
}

function isChatSession(row) {
  return row && typeof row.id === "string" && row.id.length > 0
    && (row.title === null || typeof row.title === "string")
    && typeof row.created_at === "string";
}

function isChatMessage(row, sessionId) {
  return row && typeof row.id === "string" && row.id.length > 0
    && row.session_id === sessionId && (row.role === "user" || row.role === "assistant")
    && typeof row.content === "string" && typeof row.created_at === "string";
}

export async function createChatSession(accessToken) {
  const row = await chatRequest("/sessions", accessToken, { method: "POST" });
  if (!isChatSession(row)) throw invalidChatResponse();
  return row;
}

export async function listChatSessions(accessToken) {
  const rows = await chatRequest("/sessions", accessToken);
  if (!Array.isArray(rows) || !rows.every(isChatSession)) throw invalidChatResponse();
  return rows;
}

export async function listChatMessages(accessToken, sessionId) {
  const rows = await chatRequest(`/sessions/${encodeURIComponent(sessionId)}/messages`, accessToken);
  if (!Array.isArray(rows) || !rows.every((row) => isChatMessage(row, sessionId))) {
    throw invalidChatResponse();
  }
  return rows;
}

export async function sendChatMessage(accessToken, sessionId, content) {
  const row = await chatRequest(`/sessions/${encodeURIComponent(sessionId)}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  if (!isChatMessage(row, sessionId) || row.role !== "assistant") throw invalidChatResponse();
  return row;
}
