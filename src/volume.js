// 소리 크기: 음악 / 효과음 / 목소리·노래를 따로 조절하고 이 기기에 기억한다(0~1). 값이 바뀌면 듣고 있는 소리에도 바로 반영된다.
const KEY = "naru-vol";
const DEFAULT = { bgm: 1, fx: 1, voice: 1 };
let vol = (() => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULT }; } })();
const subs = new Set();
export const getVolume = () => vol;
export function setVolume(patch) {
  vol = { ...vol, ...patch };
  for (const k of Object.keys(vol)) vol[k] = Math.max(0, Math.min(1, Number(vol[k]) || 0));
  try { localStorage.setItem(KEY, JSON.stringify(vol)); } catch { /* 저장 불가 */ }
  subs.forEach((f) => f(vol));
}
export const onVolume = (f) => { subs.add(f); return () => subs.delete(f); };
