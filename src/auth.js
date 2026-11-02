import { call, BASE } from "./api.js";

// 계정: 닉네임 + 비밀번호. 로그인하면 진행과 편지함이 서버에 보관되어 기기를 바꿔도 이어진다.
// 계정 없이 이 기기에서만 쓰는 것도 가능하다(닉네임만 정하는 손님 모드).
const KEY = "naru-token";
export const getToken = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* 저장 불가 */ } };

export const register = (nick, password, email = "") => call("/api/auth/register", { method: "POST", body: JSON.stringify({ nick, password, email }) });
export const login = (nick, password) => call("/api/auth/login", { method: "POST", body: JSON.stringify({ nick, password }) });
export const logout = () => call("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
export const getMe = () => call("/api/me");
export const pushState = (state) => call("/api/me/state", { method: "PUT", body: JSON.stringify({ state }) }, 15000);
// 계정 관리
// 소셜 로그인 목록: 무료 서버가 잠에서 깨는 동안(길면 1분)에는 응답이 늦으므로 여러 번 다시 시도한다. 끝내 못 받으면 null.
export async function getProviders() {
  for (let i = 0; i < 6; i++) {
    try { return await call("/api/auth/providers", {}, 20000); } catch (e) { if (e.status && e.status !== 0 && e.status < 500) return null; }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}
export const socialUrl = (p) => `${BASE}/api/auth/oauth/${p}/start`;
export const forgotPassword = (email) => call("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
export const resetPassword = (token, password) => call("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
export const changeNick = (nick) => call("/api/me/nick", { method: "POST", body: JSON.stringify({ nick }) });
export const changeEmail = (email, password) => call("/api/me/email", { method: "POST", body: JSON.stringify({ email, password }) });
export const changePassword = (current, next) => call("/api/me/password", { method: "POST", body: JSON.stringify({ current, next }) });
export const linkSocial = (p) => call(`/api/me/link/${p}`, { method: "POST", body: "{}" });
export const unlinkSocial = (p) => call(`/api/me/identities/${p}`, { method: "DELETE" });
export const deleteAccount = (body) => call("/api/me", { method: "DELETE", body: JSON.stringify(body) });

export { mergeStates } from "./mergeStates.js";
