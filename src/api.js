// 링크로 편지 보내기 API 클라이언트. 웹에서는 같은 출처(/api)를, 앱(Capacitor 등)에서는 VITE_API_BASE를 쓴다.
export const BASE = import.meta.env.VITE_API_BASE || "";
const PUBLIC = import.meta.env.VITE_PUBLIC_URL || (typeof location !== "undefined" ? location.origin : "");

export async function call(path, opt = {}, timeout = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    let token = ""; try { token = localStorage.getItem("naru-token") || ""; } catch { /* 저장 불가 */ }
    const r = await fetch(BASE + path, { headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...opt, signal: ctl.signal });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(data?.error || "error"), { status: r.status });
    return data;
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(new Error("network"), { status: 0 });          // 서버에 닿지 못함
  } finally {
    clearTimeout(timer);
  }
}

export const createLetter = (payload) => call("/api/letters", { method: "POST", body: JSON.stringify(payload) });
export const createLetters = (letters) => call("/api/letters/batch", { method: "POST", body: JSON.stringify({ letters }) });
// 보낸 사람의 녹음(data URL)을 올리고 id를 받는다. 같은 녹음을 여러 편지가 함께 쓴다.
export const uploadVoice = (dataUrl) => call("/api/voices", { method: "POST", body: JSON.stringify({ data: dataUrl }) }, 20000);
export const voiceUrl = (id) => `${BASE}/api/voices/${id}`;
// 받는 사람이 도착 영상을 보고 돌려보내는 반응(clap·fireworks·heart)
export const reactLetter = (id, kind) => call(`/api/letters/${id}/react`, { method: "POST", body: JSON.stringify({ kind }) });
// 보내기 전에 글을 미리 검사한다({ ok }). 막힌 글은 비행하기 전에 고칠 수 있다(보낼 때 서버가 다시 검사한다).
export const checkLetter = (to, body) => call("/api/moderate", { method: "POST", body: JSON.stringify({ to, body }) });
export const getLetter = (id) => call(`/api/letters/${id}`);
export const getStatus = (id, secret) => call(`/api/letters/${id}/status?secret=${encodeURIComponent(secret)}`);
export const deleteLetter = (id, secret) => call(`/api/letters/${id}?secret=${encodeURIComponent(secret)}`, { method: "DELETE" });
export const reportLetter = (id) => call(`/api/letters/${id}/report`, { method: "POST", body: "{}" });
export const letterUrl = (id) => `${PUBLIC}/l/${id}`;
