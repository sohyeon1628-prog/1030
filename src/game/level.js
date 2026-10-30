import { H, LEN, ISLAND, LANE_Y } from "./constants.js";

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 편지 id로 시드를 만들어 같은 편지는 항상 같은 코스가 나오게 한다.
function seeded(str) {
  let s = 0;
  for (const c of str) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// 진행률 p(0~1)에서의 이상적인 고도(px). 착륙 구간에서는 자동으로 이 높이를 따라 내려앉는다.
export function guide(p) {
  if (p < 0.05) return 0.2 * H;
  if (p < 0.5) return lerp(0.2 * H, 0.68 * H, (p - 0.05) / 0.45);
  if (p < 0.75) return 0.68 * H + Math.sin((p - 0.5) * 40) * 0.1 * H;
  const t = clamp((p - 0.75) / 0.2, 0, 1);
  return lerp(0.68 * H, ISLAND + 30, t * t * (3 - 2 * t));
}

export function buildLevel(letter) {
  const f = letter.flight;
  const rnd = seeded(letter.id);
  const ws = f.windStrength;
  const lane = () => Math.min(2, Math.floor(rnd() * 3));
  const clouds = [], vortices = [], events = [], bolts = [];

  // 갑자기 일어나는 사건: 새 떼가 오른쪽에서 날아오고, 비행기가 가로지르고, 상어·고래가 바다에서 뛰어오른다.
  // 사건은 일어나기 직전에 경고(물결·그림자, 날아올 줄의 붉은 띠)가 먼저 뜬다. 길 여유(corridorWidth)가 넓은 편지일수록 경고가 길다.
  // 상어·고래는 아래 줄만(낮게) 또는 아래·가운데 줄(높게) 덮고, 위 줄은 늘 비어 있다.
  const warn = Math.max(0.8, Math.min(1.15, 0.55 + f.corridorWidth / 400));
  const step = 430 - 42 * ws;
  for (let x = 0.1 * LEN; x < 0.84 * LEN; x += step + (rnd() - 0.5) * 80) {
    const p = x / LEN, r = rnd();
    const kind = p < 0.5 ? (r < 0.28 ? "shark" : r < 0.52 ? "whale" : "birds")
      : (r < 0.15 ? "shark" : r < 0.28 ? "whale" : r < 0.55 ? "birds" : "plane");
    const peak = rnd() < 0.5 ? 190 + rnd() * 55 : 335 + rnd() * 60;
    events.push({ kind, x, peak, lane: lane(), w: kind === "whale" ? 56 : 46, seed: rnd() * 6, state: "idle", t: 0, y: 0, h: 0, px: 0 });
  }
  // 변속 구간: 먹구름과 역풍 소용돌이(회오리). 둘 다 한 줄을 막는다.
  for (let x = 0.53 * LEN; x < 0.74 * LEN; x += 300) if (rnd() < 0.45 + 0.25 * ws) clouds.push({ x, lane: lane(), y: 0, r: 32 });
  for (let i = 0; i < (ws === 3 ? 2 : 1); i++) vortices.push({ x: (0.58 + i * 0.1) * LEN, lane: lane(), y: 0, r: 55, inside: false });
  // 번개(변속 구간): 예고 뒤 한 줄을 내리친다. 표시된 줄을 피하면 된다.
  for (let i = 0; i < ws - 1; i++) bolts.push({ x: (0.58 + i * 0.09) * LEN, lane: lane(), state: "idle", t: 0 });
  clouds.forEach((c) => { c.y = LANE_Y[c.lane]; });
  vortices.forEach((v) => { v.y = LANE_Y[v.lane]; });
  // 비: 내리는 동안 날개가 젖어 줄을 옮기는 것이 느려진다. 바람이 거센 편지일수록 오래 내린다.
  const rain = ws === 1 ? [[0.2, 0.3]] : ws === 2 ? [[0.18, 0.3], [0.56, 0.68]] : [[0.15, 0.3], [0.52, 0.72]];

  // ── 아이템: 사고가 나는 줄을 피해, 안전한 줄에만 놓는다(길을 알려 주는 역할도 한다) ──
  const danger = (l, x) => {
    for (const e of events) {
      const breach = e.kind === "shark" || e.kind === "whale";
      if (breach) { if (x > e.x - 130 && x < e.x + 130 && (l === 0 || (l === 1 && e.peak > 285))) return true; }
      else if (e.lane === l && x > e.x + 230 && x < e.x + 680) return true;
    }
    for (const c of clouds) if (c.lane === l && Math.abs(x - c.x) < 100) return true;
    for (const v of vortices) if (v.lane === l && Math.abs(x - v.x) < 110) return true;
    for (const b of bolts) if (b.lane === l && Math.abs(x - b.x) < 130) return true;
    return false;
  };
  const items = [];
  const put = (kind, x, prefer = -1) => {
    const safe = [0, 1, 2].filter((l) => !danger(l, x));
    if (!safe.length) return -1;
    const l = safe.includes(prefer) ? prefer : safe[Math.min(safe.length - 1, Math.floor(rnd() * safe.length))];
    items.push({ kind, x, lane: l, taken: false });
    return l;
  };
  for (let g = 0; g < 3; g++) {                                  // 기억 구슬: 세 개씩 세 무리
    let l = -1;
    for (let k = 0; k < 3; k++) l = put("orb", (0.2 + g * 0.2) * LEN + k * 80, l);
  }
  put("shield", 0.28 * LEN); put("shield", 0.58 * LEN);          // 깃털 방패
  put("heart", 0.42 * LEN); if (ws >= 2) put("heart", 0.66 * LEN);   // 심장
  put("ribbon", 0.62 * LEN);                                     // 순풍 리본
  put("umbrella", Math.max(0.08 * LEN, rain[0][0] * LEN - 320)); // 우산(첫 비 직전)
  items.sort((a, b) => a.x - b.x);
  return { f, clouds, vortices, events, warn, bolts, rain, items };
}

// 연습 비행: 처음 하는 사람을 위해 구슬·아이템·위험 하나하나를 차례로 만나고, 위험이 닥치는 곳을 짚어 주는 짧은 코스.
// 코스는 고정이고, 안내(coach)는 해당 위치(x = LEN의 비율)를 지날 때 하나씩 뜬다.
export function buildPracticeLevel() {
  const X = (p) => p * LEN;
  const ev = (kind, p, lane, peak = 215) => ({ kind, x: X(p), peak, lane, w: kind === "whale" ? 56 : 46, seed: p * 9, state: "idle", t: 0, y: 0, h: 0, px: 0 });
  const it = (kind, p, lane, off = 0) => ({ kind, x: X(p) + off, lane, taken: false });
  const clouds = [{ x: X(0.39), lane: 2, y: LANE_Y[2], r: 32 }];
  const vortices = [{ x: X(0.6), lane: 1, y: LANE_Y[1], r: 55, inside: false }];
  const bolts = [{ x: X(0.69), lane: 1, state: "idle", t: 0 }];
  const events = [ev("birds", 0.25, 1), ev("shark", 0.42, 0), ev("birds", 0.54, 1)];
  const items = [
    it("orb", 0.13, 1), it("orb", 0.13, 2, 90), it("orb", 0.13, 1, 180),
    it("heart", 0.33, 2), it("shield", 0.49, 1), it("umbrella", 0.735, 1),
  ];
  const coach = [
    [0.03, "↑ ↓ 키, 화면 위·아래 탭, 쓸어 넘기기로 높이를 한 줄씩 옮겨요. 높이는 위·가운데·아래 세 줄이에요."],
    [0.09, "반짝이는 기억 구슬을 지나며 모아요. 모으면 도착했을 때 추억이 한 줄 떠올라요."],
    [0.17, "빨간 띠가 뜬 줄에 새가 날아와요. 그 줄을 피해요! 부딪히면 하트가 줄어요 (연습에서는 괜찮아요)."],
    [0.285, "심장 아이템! 닳은 하트가 하나 돌아와요. 위쪽 하트 줄을 보세요."],
    [0.34, "바다가 일렁이면 상어·고래가 뛰어올라요. 맞는 곳은 아래 줄이에요. 먹구름도 닿으면 아파요."],
    [0.46, "깃털 방패! 다음 부딪힘을 한 번 막아 줘요. 몸 둘레에 둥근 막이 생겨요."],
    [0.51, "방패가 있으면 새에게 부딪혀도 한 번은 괜찮아요. 일부러 부딪혀 봐도 돼요."],
    [0.55, "회오리에 들어가면 2초 동안 위아래가 반대로 돼요. 피하거나, 들어가 보고 느껴 봐요."],
    [0.65, "번개는 노란 띠와 !가 뜬 줄에 내리쳐요. 그 줄에서 벗어나요."],
    [0.7, "비가 오면 날개가 젖어 줄 옮기기가 느려져요. 우산을 얻으면 괜찮아요."],
    [0.8, "착륙은 자동이에요. 편안히 내려앉아요. 연습 끝!"],
  ].map(([p, text], n, a) => ({ x: X(p), text, n: n + 1, total: a.length, done: false }));
  return {
    f: { windStrength: 1, corridorWidth: 260, gustPattern: "steady", checkpoints: [0], landingTolerance: 0.35 },
    clouds, vortices, events, warn: 1.2, bolts, rain: [[0.74, 0.8]], items, coach,
  };
}
