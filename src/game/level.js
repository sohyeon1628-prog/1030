import { H, LEN, LAND_Y, LANE_Y, VX, VX_MAX, WALK_Y } from "./constants.js";

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 시드가 있는 난수. 비행마다 새 시드를 써서 같은 편지라도 매번 다른 코스가 나온다.
function seeded(str) {
  let s = 0;
  for (const c of str) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// 진행률 p에서의 전진 속도. 출발은 VX, 착륙 구간 직전(p=0.8)에 VX_MAX까지 오른다.
export const speedAt = (p) => VX + (VX_MAX - VX) * clamp(p / 0.8, 0, 1);

// 진행률 p(0~1)에서의 이상적인 고도(px). 착륙 구간에서는 자동으로 이 높이를 따라 내려앉는다.
export function guide(p) {
  if (p < 0.05) return 0.2 * H;
  if (p < 0.5) return lerp(0.2 * H, 0.68 * H, (p - 0.05) / 0.45);
  if (p < 0.75) return 0.68 * H + Math.sin((p - 0.5) * 40) * 0.1 * H;
  const t = clamp((p - 0.75) / 0.2, 0, 1);
  return lerp(0.68 * H, LAND_Y, t * t * (3 - 2 * t));                  // 착륙 지점(p=0.95)에서 발이 잔디에 닿는다
}

// 사고는 정해진 간격이 아니라 "패턴"을 무작위로 뽑아 불규칙한 간격으로 놓는다. 뒤로 갈수록 촘촘하고 경고가 짧다.
//   단일: 새 떼·비행기 한 줄 / 상어·고래 점프
//   급강하: 검은 새 떼가 경고된 줄로 오다가 도중에 옆 줄로 꺾는다
//   벽: 두 줄에 동시에 날아온다(남은 한 줄로 피한다)
//   협공: 바다에서 뛰어오르는 동안 위 줄에도 새가 온다
//   먹구름(위아래로 떠다니기도 한다) · 번개 · 회오리
// 모든 사고가 막는 줄과 구간(x)을 blocks에 적어 두고, 같은 자리에서 세 줄이 모두 막히는 패턴은 버린다.
export function buildLevel(letter, seed = `${letter.id}:${Date.now()}:${Math.random()}`) {
  const f = letter.flight;
  const rnd = seeded(seed);
  const ws = f.windStrength;
  const pick = (a) => a[Math.min(a.length - 1, Math.floor(rnd() * a.length))];
  const lane = () => pick([0, 1, 2]);
  const clouds = [], vortices = [], events = [], bolts = [], blocks = [];
  // 하늘길(3장부터): 이 구간은 날지 않고 구름 길을 걷는다. 사고는 이 구간 앞뒤로 비워 둔다.
  const walk = f.skyWalk ? { a: 0.52 * LEN, b: 0.7 * LEN, obs: [] } : null;
  const inWalk = (x, pad = 0) => walk && x > walk.a - pad && x < walk.b + pad;

  const free = (l, a, b) => !blocks.some((k) => k.lane === l && k.b > a && k.a < b);
  const fits = (want) => {                                   // want: [{lane, a, b}] — 더해도 어느 x에서나 한 줄은 비어 있는가
    const all = [...blocks, ...want];
    const xs = all.flatMap((k) => [k.a, k.b]);
    return xs.every((x) => [0, 1, 2].some((l) => !all.some((k) => k.lane === l && k.a <= x && x <= k.b)));
  };
  const commit = (want, add) => { if (!fits(want)) return false; blocks.push(...want); add(); return true; };
  const fly = (kind, x, l, p, extra = {}) => ({
    kind, x, lane: l, warn: warnAt(p), seed: rnd() * 6, state: "idle", t: 0, y: 0, h: 0, px: 0, cy: 0, ...extra,
  });
  // 경고 시간: 길 여유(corridorWidth)가 넓을수록 길고, 뒤로 갈수록 짧다
  const warnAt = (p) => clamp(0.5 + f.corridorWidth / 700 - 0.35 * p, 0.42, 0.95);

  const patterns = [
    { w: 3, min: 0, make: (x, p) => { const l = lane(); return commit([{ lane: l, a: x - 90, b: x + 90 }], () => events.push(fly(p > 0.4 && rnd() < 0.45 ? "plane" : "birds", x, l, p))); } },
    { w: 2.2, min: 0, make: (x, p) => {
      const kind = rnd() < 0.55 ? "shark" : "whale", high = rnd() < 0.35 + 0.3 * p;
      // 낮게 뛰면 정점이 아래 줄, 높게 뛰면 가운데 줄에 걸린다(그 밑으로 빠져나갈 수 있다)
      return commit([{ lane: high ? 1 : 0, a: x - 110, b: x + 110 }], () => events.push(fly(kind, x, 0, p, { peak: high ? 285 + rnd() * 30 : 120 + rnd() * 25 })));
    } },
    { w: 1.6 + ws * 0.3, min: 0.18, make: (x, p) => {
      const from = lane(), to = from === 1 ? pick([0, 2]) : 1;
      return commit([{ lane: from, a: x - 260, b: x - 40 }, { lane: to, a: x - 120, b: x + 90 }], () => events.push(fly("birds", x, from, p, { dive: to, dived: false })));
    } },
    { w: 1.2 + ws * 0.4, min: 0.3, make: (x, p) => {
      const open = lane(), ls = [0, 1, 2].filter((l) => l !== open);
      return commit(ls.map((l) => ({ lane: l, a: x - 90, b: x + 90 })), () => ls.forEach((l, i) => events.push(fly(i && p > 0.55 ? "plane" : "birds", x, l, p))));
    } },
    { w: 1, min: 0.45, make: (x, p) => {
      const kind = rnd() < 0.5 ? "shark" : "whale";
      return commit([{ lane: 0, a: x - 110, b: x + 110 }, { lane: 2, a: x - 90, b: x + 90 }], () => {
        events.push(fly(kind, x, 0, p, { peak: 120 + rnd() * 25 }));
        events.push(fly("birds", x, 2, p));
      });
    } },
    { w: 1.6, min: 0.12, make: (x) => {
      const drift = rnd() < 0.5, l = drift ? pick([0, 1]) : lane();                   // 떠다니는 구름은 두 줄 사이를 오르내린다
      const want = drift ? [{ lane: l, a: x - 90, b: x + 90 }, { lane: l + 1, a: x - 90, b: x + 90 }] : [{ lane: l, a: x - 70, b: x + 70 }];
      return commit(want, () => clouds.push({ x, lane: l, y: LANE_Y[l], r: 32, drift: drift ? { a: LANE_Y[l], b: LANE_Y[l + 1], w: 1.4 + rnd() * 1.2, ph: rnd() * 6 } : null }));
    } },
    { w: 0.6 + ws * 0.35, min: 0.35, make: (x, p) => { const l = lane(); return commit([{ lane: l, a: x - 60, b: x + 60 }], () => bolts.push({ x, lane: l, warn: clamp(0.85 - 0.4 * p, 0.5, 0.85), state: "idle", t: 0 })); } },
    { w: 0.5, min: 0.4, make: (x) => { const l = lane(); return commit([{ lane: l, a: x - 60, b: x + 60 }], () => vortices.push({ x, lane: l, y: LANE_Y[l], r: 55, inside: false })); } },
  ];

  // 사고는 도착 2초 전(착륙 직전)보다 훨씬 앞에서 끝난다: 마지막 사고의 위험이 사라지는 자리까지 계산해 0.78에서 멈춘다
  // 비바람 구간: 위치로 정해진다(약 5초 동안 천천히 나아가며 버텨야 한다). 바람이 거센 편지일수록 자주 온다. 도착 2초 전(0.86)보다 먼저 그친다.
  // 비바람 구간과 그 앞(150px)·뒤(650px)에는 장애물이 없다: 버티는 동안 새나 번개가 날아오지 않고, 구간이 끝난 뒤의 경고도 구간 안에서 시작하지 않는다.
  const rain = [];
  {
    const slots = ws === 1 ? [0.22] : ws === 2 ? [0.16, walk ? 0.76 : 0.58] : [0.14, 0.34, 0.76];
    slots.forEach((base) => { const a = base + rnd() * 0.03, b = Math.min(a + 0.06 + rnd() * 0.02, 0.84); rain.push([a, b]); });
  }
  const inStorm = (x, before = 150, after = 650) => rain.some(([a, b]) => x > a * LEN - before && x < b * LEN + after);

  for (let x = 0.07 * LEN; x < 0.78 * LEN;) {
    if (inStorm(x)) { const st = rain.find(([a, b]) => x > a * LEN - 150 && x < b * LEN + 650); x = st[1] * LEN + 650; continue; }       // 비바람 구간 앞뒤는 비워 둔다
    if (walk && x > walk.a - 1000 && x < walk.b + 100) { x = walk.b + 400; continue; }
    const p = x / LEN;
    const pool = patterns.filter((q) => p >= q.min);
    for (let tries = 0; tries < 4; tries++) {                    // 세 줄을 다 막는 패턴이면 다른 패턴을 다시 뽑는다
      let r = rnd() * pool.reduce((a, q) => a + q.w, 0), q = pool[0];
      for (const c of pool) { if ((r -= c.w) <= 0) { q = c; break; } }
      if (q.make(x, p)) break;
    }
    // 다음 사고까지의 거리: 짧게 몰아치다가 숨을 고르기도 한다
    const base = lerp(620, 360, p) - ws * 25;
    x += base * (rnd() < 0.2 ? 0.45 : 0.7 + rnd() * 0.9);
  }
  // 하늘길: 뛰어올라 위를 걸을 수 있는 귀여운 해적(부딪히면 아프다)과 구름 길의 구멍(뛰어 건넌다)
  if (walk) {
    let k = 0;
    for (let x = walk.a + 560; x < walk.b - 380; x += 470 + rnd() * 200, k++) {
      walk.obs.push(k % 2 === 0 || rnd() < 0.35 ? { kind: "pirate", x, w: 52, h: 66, passed: false } : { kind: "gap", x, w: 120, h: 0, passed: false });
    }
  }

  // ── 아이템: 사고가 나는 줄을 피해, 안전한 줄에만 놓는다(길을 알려 주는 역할도 한다) ──
  const items = [];
  const put = (kind, x0, prefer = -1) => {
    const x = inWalk(x0, 60) ? walk.a - 160 : x0;                // 하늘길 안에는 줄 아이템을 놓지 않는다
    const safe = [0, 1, 2].filter((l) => free(l, x - 50, x + 50));
    if (!safe.length) return -1;
    const l = safe.includes(prefer) ? prefer : pick(safe);
    items.push({ kind, x, lane: l, taken: false });
    return l;
  };
  for (let g = 0; g < 3; g++) {                                  // 기억 구슬: 세 개씩 세 무리, 자리는 매번 다르다
    let l = -1;
    const x0 = (0.16 + g * 0.22 + rnd() * 0.08) * LEN;
    if (walk && g === 1 && walk.obs.length) {                    // 하늘길에서는 구름 블록 위로 구슬이 떠 있어서, 뛰어 넘으며 모은다
      const o = walk.obs.find((q) => q.kind === "pirate") || walk.obs[0];
      for (let k = -1; k <= 1; k++) items.push({ kind: "orb", x: o.x + k * 34, lane: 1, y: WALK_Y + o.h + 42, taken: false });
      continue;
    }
    for (let k = 0; k < 3; k++) l = put("orb", x0 + k * 110, l);
  }
  put("shield", (0.22 + rnd() * 0.12) * LEN); put("shield", (0.52 + rnd() * 0.12) * LEN);   // 깃털 방패
  put("heart", (0.38 + rnd() * 0.1) * LEN); if (ws >= 2) put("heart", (0.64 + rnd() * 0.1) * LEN);   // 심장
  put("ribbon", (0.45 + rnd() * 0.25) * LEN);                    // 순풍 리본
  if (rain.length) put("umbrella", Math.max(0.06 * LEN, rain[0][0] * LEN - 500)); // 우산(첫 비 직전)
  items.sort((a, b) => a.x - b.x);
  return { f, clouds, vortices, events, warn: warnAt(0), bolts, rain, items, blocks, walk };
}

// 연습 비행: 처음 하는 사람을 위해 구슬·아이템·위험 하나하나를 차례로 만나고, 위험이 닥치는 곳을 짚어 주는 짧은 코스.
// 코스는 고정이고, 안내(coach)는 해당 위치(x = LEN의 비율)를 지날 때 하나씩 뜬다.
export function buildPracticeLevel() {
  const X = (p) => p * LEN;
  const ev = (kind, p, lane, peak = 135) => ({ kind, x: X(p), peak, lane, warn: 1.2, seed: p * 9, state: "idle", t: 0, y: 0, h: 0, px: 0, cy: 0 });
  const it = (kind, p, lane, off = 0) => ({ kind, x: X(p) + off, lane, taken: false });
  const clouds = [{ x: X(0.39), lane: 2, y: LANE_Y[2], r: 32 }];
  const vortices = [{ x: X(0.6), lane: 1, y: LANE_Y[1], r: 55, inside: false }];
  const bolts = [{ x: X(0.69), lane: 1, warn: 0.9, state: "idle", t: 0 }];
  const events = [ev("birds", 0.25, 1), ev("shark", 0.42, 0), ev("birds", 0.54, 1)];
  const items = [
    it("orb", 0.13, 1), it("orb", 0.13, 2, 90), it("orb", 0.13, 1, 180),
    it("heart", 0.33, 2), it("shield", 0.49, 1), it("umbrella", 0.735, 1),
  ];
  const coach = [
    [0.03, "↑ ↓ 키나 화면 위쪽·아래쪽 누르기(휴대폰), 쓸어 넘기기로 높이를 한 줄씩 옮겨요. 높이는 위·가운데·아래 세 줄이에요."],
    [0.09, "반짝이는 기억 구슬을 지나며 모아요. 모으면 도착했을 때 추억이 한 줄 떠올라요."],
    [0.17, "빨간 띠가 뜬 줄에 새가 날아와요. 그 줄을 피해요! 부딪히면 하트가 줄어요 (연습에서는 괜찮아요)."],
    [0.285, "심장 아이템! 닳은 하트가 하나 돌아와요. 위쪽 하트 줄을 보세요."],
    [0.34, "바다가 일렁이면 상어·고래가 뛰어올라요. 맞는 곳은 아래 줄이에요. 먹구름도 닿으면 아파요."],
    [0.46, "깃털 방패! 다음 부딪힘을 한 번 막아 줘요. 몸 둘레에 둥근 막이 생겨요."],
    [0.51, "방패가 있으면 새에게 부딪혀도 한 번은 괜찮아요. 일부러 부딪혀 봐도 돼요."],
    [0.55, "회오리에 들어가면 2초 동안 위아래가 반대로 돼요. 피하거나, 들어가 보고 느껴 봐요."],
    [0.65, "번개는 노란 띠와 !가 뜬 줄에 내리쳐요. 그 줄에서 벗어나요."],
    [0.7, "비바람이에요! Enter(휴대폰은 왼쪽 아래 버튼)를 연달아 눌러 버티기 게이지를 채워요. 비가 오면 줄 옮기기도 느려져요. 우산을 얻으면 덜 힘들어요."],
    [0.84, "착륙은 자동이에요. 이제 장애물은 나오지 않아요. 편안히 내려앉아요. 연습 끝!"],
  ].map(([p, text], n, a) => ({ x: X(p), text, n: n + 1, total: a.length, done: false }));
  return {
    f: { windStrength: 1, corridorWidth: 260, gustPattern: "steady", checkpoints: [0], landingTolerance: 0.35 },
    clouds, vortices, events, warn: 1.2, bolts, rain: [[0.72, 0.82]], items, coach, walk: null,
  };
}
