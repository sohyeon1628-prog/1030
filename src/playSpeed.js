// 영상(오프닝·에필로그·병 편지) 재생 속도: 느리게 / 보통 / 빠르게 / 아주 빠르게. 고른 값은 이 기기에 기억한다.
// 대본의 시간은 그대로 두고 시간이 흐르는 빠르기만 곱한다(자막 길이와 연출이 함께 빨라지거나 느려진다).
export const SPEEDS = [{ v: 0.8, label: "느리게" }, { v: 1, label: "보통" }, { v: 1.5, label: "빠르게" }, { v: 2, label: "아주 빠르게" }];
const KEY = "naru-speed";
export const getSpeed = () => { try { const v = Number(localStorage.getItem(KEY)); return SPEEDS.some((s) => s.v === v) ? v : 1; } catch { return 1; } };
export const nextSpeed = (cur) => { const i = SPEEDS.findIndex((s) => s.v === cur); const n = SPEEDS[(i + 1) % SPEEDS.length].v; try { localStorage.setItem(KEY, String(n)); } catch { /* 저장 불가 */ } return n; };
export const speedLabel = (v) => SPEEDS.find((s) => s.v === v)?.label || "보통";
