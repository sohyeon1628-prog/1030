// 파티 편지: 정한 날에 도착한 섬의 항구에서 마을 친구들이 파티를 열어 주고, 노래가 끝나면 편지가 열린다.
// 기념일 종류 목록은 두지 않는다. 분위기·장식·하늘·차림을 고르고, 무슨 날인지는 현수막 문구로 적는다.
export const MOODS = [
  { id: "calm", label: "잔잔한", sway: 0.5, bounce: 0.2, speed: 0.8 },
  { id: "merry", label: "흥겨운", sway: 1.0, bounce: 0.9, speed: 1.6 },
  { id: "touch", label: "뭉클한", sway: 0.35, bounce: 0.1, speed: 0.6 },
  { id: "play", label: "장난스러운", sway: 1.2, bounce: 1.2, speed: 2.0 },
];
export const DECOS = [
  { id: "balloon", label: "풍선과 꽃" },
  { id: "lantern", label: "등불" },
  { id: "fireworks", label: "불꽃놀이" },
  { id: "snow", label: "눈 내리는 항구" },
];
export const SKIES = [
  { id: "day", label: "낮" },
  { id: "dusk", label: "노을" },
  { id: "night", label: "별이 뜬 밤" },
];
export const OUTFITS = [
  { id: "hat", label: "파티 모자" },
  { id: "bouquet", label: "꽃다발" },
  { id: "sparkle", label: "반짝이 소품" },
];
// 고르기 어려운 사람을 위한 기본 콘셉트(한 번에 채우고, 이후 항목별로 바꿀 수 있다)
export const CONCEPTS = [
  { id: "lantern-dusk", label: "노을 등불 파티", mood: "calm", deco: "lantern", sky: "dusk", outfit: "bouquet" },
  { id: "night-fire", label: "한밤 불꽃 파티", mood: "merry", deco: "fireworks", sky: "night", outfit: "hat" },
  { id: "day-balloon", label: "낮 풍선 파티", mood: "play", deco: "balloon", sky: "day", outfit: "hat" },
  { id: "snow-harbor", label: "눈 내리는 항구", mood: "touch", deco: "snow", sky: "night", outfit: "sparkle" },
];
export const DEFAULT_PARTY = { mood: "merry", deco: "balloon", sky: "day", outfit: "hat", banner: "" };

export const MAX_VOICE_SEC = 30;             // 녹음 최대 길이(제안값)
export const QUICK_WHEN = [                  // 도착 시점 빠른 선택
  { label: "1분 뒤 (체험용)", ms: 60 * 1000 },
  { label: "내일", ms: 24 * 3600 * 1000 },
  { label: "일주일 뒤", ms: 7 * 24 * 3600 * 1000 },
  { label: "한 달 뒤", ms: 30 * 24 * 3600 * 1000 },
];
export const MIN_FUTURE_MS = 55 * 1000;      // 도착 시각은 지금보다 최소 1분 뒤

export const fmtWhen = (t) => new Date(t).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
