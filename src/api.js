// 링크로 편지 보내기 API 클라이언트. 웹에서는 같은 출처(/api)를, 앱(Capacitor 등)에서는 VITE_API_BASE를 쓴다.
const BASE = import.meta.env.VITE_API_BASE || "";
const PUBLIC = import.meta.env.VITE_PUBLIC_URL || (typeof location !== "undefined" ? location.origin : "");

async function call(path, opt = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...opt, signal: ctl.signal });
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
export const getLetter = (id) => call(`/api/letters/${id}`);
export const getStatus = (id, secret) => call(`/api/letters/${id}/status?secret=${encodeURIComponent(secret)}`);
export const deleteLetter = (id, secret) => call(`/api/letters/${id}?secret=${encodeURIComponent(secret)}`, { method: "DELETE" });
export const reportLetter = (id) => call(`/api/letters/${id}/report`, { method: "POST", body: "{}" });
export const letterUrl = (id) => `${PUBLIC}/l/${id}`;
