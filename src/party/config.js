// 파티 편지: 정한 날에 도착한 섬의 항구에서 마을 친구들이 파티를 열어 주고, 노래가 끝나면 편지가 열린다.
// 기념일 종류 목록은 두지 않는다. 분위기·장식·하늘·차림을 고르고, 무슨 날인지는 현수막 문구로 적는다.
export const MOODS = [
  { id: "calm", label: "잔잔한", sway: 0.5, bounce: 0.2, speed: 0.8 },
  { id: "merry", label: "흥겨운", sway: 1.0, bounce: 0.9, speed: 1.6 },
  { id: "touch", label: "뭉클한", sway: 0.35, bounce: 0.1, speed: 0.6 },
  { id: "play", label: "장난스러운", sway: 1.2, bounce: 1.2, speed: 2.0 },
];
// 파티 설정은 콘셉트 세 가지 중 하나만 고른다. 콘셉트는 "어디에서 여는 파티인가"(무대)이고, 분위기와 현수막 문구는 콘셉트가 정한다.
//   섬 위: 항구에서 마을 친구들이 / 바닷속: 잠수한 해무와 나, 돌고래·거북·물고기 떼가 / 하늘 위: 구름 무대에서 갈매기 친구들과
export const CONCEPTS = [
  { id: "island", label: "섬 위 파티", hint: "항구에서 마을 친구들과", stage: "island", mood: "play", deco: "balloon", sky: "day", outfit: "hat", banner: "축하해요", tone: "#5ec9a7" },
  { id: "sea", label: "바닷속 파티", hint: "잠수한 해무와 바다 친구들", stage: "sea", mood: "calm", deco: "balloon", sky: "day", outfit: "hat", banner: "마음을 전해요", tone: "#2f7fbf" },
  { id: "sky", label: "하늘 위 파티", hint: "구름 무대, 갈매기 친구들", stage: "sky", mood: "merry", deco: "balloon", sky: "day", outfit: "hat", banner: "오늘의 주인공", tone: "#f59a4a" },
];
export const DEFAULT_PARTY = { stage: "island", mood: "merry", deco: "balloon", sky: "day", outfit: "hat", banner: "" };
// 콘셉트 → 파티 장면에 넘기는 설정
export const partyOf = (c) => ({ stage: c.stage, mood: c.mood, deco: c.deco, sky: c.sky, outfit: c.outfit, banner: c.banner });

export const MAX_VOICE_SEC = 30;             // 녹음 최대 길이(제안값)
export const fmtWhen = (t) => new Date(t).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
