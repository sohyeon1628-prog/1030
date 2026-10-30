// 서사 뼈대: 우체부 해무가 사십 년 지켜 온 가방을 넘기는 날. 남의 편지를 나르던 가방으로, 오늘은 내가 아끼는 사람들에게 안부 편지를 전한다.
// 톤은 담담하고 따뜻하게. 세계관(편지가 오가는 동안에만 열리는 바람길)은 그대로 유지한다.

// 3D 오프닝이 끝나고 "시작하기" 버튼이 나오는 시각(초). 자막은 data/profile.js의 buildIntro가 만든다.
export const INTRO_END = 47.4;

// 처음 온 사람을 위한 안내 카드
export const HOWTO = [
  { icon: "✉", title: "당신이 주인공이에요", body: "선배 우체부 해무가 오늘 당신에게 우편 가방을 넘겨요. 당신이 정한 사랑하는 네 사람에게 편지를 전해요. 섬을 눌러 편지를 읽고 날아가세요. 한 사람에게 닿으면 다음 섬이 열려요." },
  { icon: "↕", title: "한 줄씩 옮겨 날아요", body: "높이는 위·가운데·아래 세 줄이에요. 키보드는 ↑ ↓(W·S, 스페이스는 위로), 터치는 화면 위쪽·아래쪽을 탭하거나 위아래로 쓸어 넘기면 돼요. 오른쪽의 ▲▼ 버튼도 있어요. 누르고 있을 필요가 없어요." },
  { icon: "⚠", title: "경고가 뜬 줄을 피하세요", body: "새 떼와 비행기는 화면 오른쪽에서 갑자기 날아오고, 상어와 고래는 바다에서 뛰어올라요. 사고 직전에 경고(빨간 띠, 물결과 그림자)가 먼저 뜨니 다른 줄로 옮기세요. 상어와 고래는 위쪽 줄까지 닿지 않아요. 검은 새 떼(경고에 ?)는 오다가 옆 줄로 꺾으니 끝까지 지켜보세요. 비행은 갈수록 빨라지고, 코스는 날 때마다 달라져요." },
  { icon: "✦", title: "구슬과 아이템을 모아요", body: "반짝이는 기억 구슬은 모으면 도착했을 때 추억이 한 줄 더 떠올라요. 깃털 방패는 충돌을 한 번 막고, 심장은 하트를 채우고, 순풍 리본은 3초 동안 바람을 무시하며 빨라지고, 우산은 비를 막아요. 아이템은 안전한 줄에 놓여 있어서 길잡이도 돼요." },
  { icon: "🌬", title: "바람과 비", body: "바닷바람이 불면 앞으로 가는 속도가 잠깐 느려져요. 멈추거나 뒤로 밀리지는 않아요. 비가 오면 줄을 옮기는 게 느려져요. 회오리에 들어가면 위아래가 반대로 돼요." },
  { icon: "🔁", title: "실패해도 이야기는 끊기지 않아요", body: "하트는 4개예요. 연속으로 8번 피하면 깃털 방패를 얻어요. 다 닳으면 그 구간만 체크포인트에서 다시 해요. 착륙은 자동이에요. 편지는 결국 도착하고, 등급(완벽·무사·아슬아슬)은 부딪힌 횟수로 정해질 뿐 이야기는 똑같아요." },
  { icon: "🧭", title: "바람길이 이어져요", body: "섬 사이의 부표는 아직 끊긴 항로예요. 편지를 전하면 부표가 사라지고 금빛 바람길이 흘러요. 모은 기억 구슬로 새 편지지도 열 수 있어요. 네 통을 모두 전하면 '내 편지 쓰기'가 열려요." },
];

// 내 편지: "마지막으로 이야기한 게 언제인가요?" → windStrength
export const GAPS = [
  { value: 1, label: "어제나 며칠 전", hint: "가벼운 바람" },
  { value: 2, label: "몇 달 전", hint: "바람이 조금 거칠어진다" },
  { value: 3, label: "몇 년 전", hint: "가장 거센 바람" },
];
export const FLIGHT_BY_GAP = {
  1: { windStrength: 1, corridorWidth: 220, gustPattern: "steady" },
  2: { windStrength: 2, corridorWidth: 140, gustPattern: "pulse" },
  3: { windStrength: 3, corridorWidth: 100, gustPattern: "reverse" },
};
export const FLIGHT_COMMON = { checkpoints: [0, 0.5, 0.75], landingTolerance: 0.35 };

// 미래의 나에게: 도착까지 걸리는 시간
export const DELAYS = [
  { ms: 60 * 1000, label: "1분 뒤 (체험용)" },
  { ms: 24 * 3600 * 1000, label: "내일" },
  { ms: 7 * 24 * 3600 * 1000, label: "일주일 뒤" },
  { ms: 30 * 24 * 3600 * 1000, label: "한 달 뒤" },
];

export const PAPERS = [
  { id: "cream", label: "크림", color: "#fbf4e2", need: 0 },
  { id: "mint", label: "민트", color: "#dff3ea", need: 0 },
  { id: "coral", label: "코랄", color: "#fde3df", need: 0 },
  { id: "star", label: "별빛", color: "#e6e4ff", need: 10 },     // 기억 구슬을 모아 연다
  { id: "gold", label: "황금", color: "#fff0c2", need: 25 },
];

// 도착한 편지에 섬이 돌려주는 짧은 답. 등급과 무관하게 동일.
export const REPLIES = {
  1: [
    "섬이 가볍게 흔들렸다. \"받았어요! 오늘 하루가 조금 환해졌어요.\"",
    "창가에 놓인 편지 위로 햇빛이 한 뼘 움직였다.",
  ],
  2: [
    "섬이 반가운 듯 반짝였다. \"편지 기다리고 있었어요. 와 줘서 고마워요.\"",
    "서랍에서 꺼낸 새 편지지 위로 따뜻한 바람이 스쳤다.",
  ],
  3: [
    "긴 노을이 번졌다. \"이렇게 편지가 오다니, 정말 반가워요. 잘 지냈죠?\"",
    "바람길 위로 반가운 소리가 천천히 되돌아왔다.",
  ],
};
export function pickReply(gap, id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const list = REPLIES[gap];
  return list[h % list.length];
}
