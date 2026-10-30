import { LEN, ISLAND, R, SX, VX, LANE_Y, LANE_TAU, MAX_HITS, INV } from "./constants.js";
import { buildLevel, buildPracticeLevel, guide, clamp } from "./level.js";

export function createFlight(letter, tutorialSeen, practice = false) {
  return {
    letter,
    lv: practice ? buildPracticeLevel() : buildLevel(letter),
    practice, coach: null, hitMark: 0,   // 연습 비행: 안내 문구와 맞은 자리 표시
    x: 0, y: LANE_Y[1], vy: 0, thrust: 0.4,
    lane: 1,                           // 지금 줄(0 아래, 1 가운데, 2 위)
    moves: [],                         // 입력 대기열: +1 위로 한 줄, -1 아래로 한 줄
    hits: 0, totalHits: 0, fails: 0, inv: 0, rev: 0, shake: 0,
    guard: 0, ribbon: 0, umbrella: 0,  // 깃털 방패 개수, 순풍 리본/우산 남은 시간
    cd: practice ? 3 : tutorialSeen ? 2 : 4,          // 이륙 카운트(초)
    mode: "count",                     // count | fly | done
    msg: "", msgT: 0, t: 0, doneT: 0,
    landSpeed: 0.1,
    finished: false,
    showTutorial: practice || !tutorialSeen,
    hintsOn: !practice && !tutorialSeen,            // 첫 비행에서만 단계별 안내를 띄운다
    hinted: {},
    rainK: 0, flash: 0,                // 비의 세기(0~1), 번개/천둥 번쩍임
    windState: "none",                 // none | warn(예고) | blow(부는 중). 바람은 앞으로 가는 속도만 줄인다
    windT: 4, windPush: 0,
    pop: null,                         // 아이템을 얻은 순간의 효과 { kind, t }
  };
}

const say = (F, text, sec = 1.6) => { F.msg = text; F.msgT = sec; };
export const orbsCollected = (F) => F.lv.items.filter((i) => i.kind === "orb" && i.taken).length;

// 실패한 구간을 직전 체크포인트에서 다시 시작한다. 처음부터 재도전하지 않는다.
function restart(F) {
  const p = F.x / LEN;
  let cp = 0;
  for (const c of F.lv.f.checkpoints) if (c <= p && c > cp) cp = c;
  F.x = cp * LEN; F.lane = 1; F.y = LANE_Y[1]; F.vy = 0; F.moves.length = 0;
  F.hits = 0; F.rev = 0; F.inv = 2; F.cd = 1.2; F.mode = "count";
  F.guard = 0; F.ribbon = 0; F.umbrella = 0;
  F.windState = "none"; F.windT = 3; F.windPush = 0;
  for (const v of F.lv.vortices) v.inside = false;
  for (const ev of F.lv.events) { ev.state = "idle"; ev.t = 0; ev.h = 0; }
  for (const b of F.lv.bolts) { b.state = "idle"; b.t = 0; }
  for (const it of F.lv.items) if (it.x >= F.x) it.taken = false;      // 되돌아간 구간의 아이템은 다시 나타난다
  F.rainK = 0; F.flash = 0;
}

function fail(F, why) {
  F.fails++; F.shake = 0.4;
  say(F, why);
  restart(F);
}

// 등급: 실패 1회 = 2점, 부딪힘 1회 = 1점. 1점 이하 완벽, 4점 이하 무사, 그 위는 아슬아슬.
export function computeGrade(fails, totalHits) {
  const score = fails * 2 + totalHits;
  return score <= 1 ? "perfect" : score <= 4 ? "safe" : "rough";
}

// fx: { chime(freq), thud() } — 사운드 콜백. 입력은 F.moves(줄 옮기기)로 들어온다.
export function stepFlight(F, dt, fx) {
  F.t += dt;
  F.msgT -= dt;
  F.inv = Math.max(0, F.inv - dt);
  F.shake = Math.max(0, F.shake - dt);
  F.rev = Math.max(0, F.rev - dt);
  F.flash = Math.max(0, F.flash - dt);
  F.ribbon = Math.max(0, F.ribbon - dt);
  F.umbrella = Math.max(0, F.umbrella - dt);
  if (F.pop) { F.pop.t -= dt; if (F.pop.t <= 0) F.pop = null; }
  const f = F.lv.f;
  const p = F.x / LEN;
  F.hitMark = Math.max(0, F.hitMark - dt);
  if (F.practice && F.mode === "fly") {
    for (const c of F.lv.coach) if (!c.done && F.x >= c.x) { c.done = true; F.coach = { text: c.text, n: c.n, total: c.total, t: c.n === c.total ? 6 : 7 }; }
    if (F.coach) { F.coach.t -= dt; if (F.coach.t <= 0 && F.coach.n < F.coach.total) F.coach = null; }
  }
  if (F.hintsOn && F.mode === "fly") {
    const hints = [[0.05, "a", "경고가 뜬 줄을 피하고, 반짝이는 구슬을 모아요"], [0.5, "b", "회오리에 들어가면 위아래가 반대로 돼요!"], [0.75, "c", "착륙은 자동이에요. 편안히 내려앉아요"]];
    for (const [thr, key, text] of hints) if (p >= thr && !F.hinted[key]) { F.hinted[key] = true; say(F, text, 3.6); }
  }

  // 줄 옮기기: 위·아래로 한 줄씩. 회오리 안에서는 반대로 움직인다.
  const flip = F.rev > 0 ? -1 : 1;
  for (const m of F.moves.splice(0)) F.lane = clamp(F.lane + m * flip, 0, 2);

  if (F.mode === "count") {
    F.cd -= dt;
    F.y += (LANE_Y[F.lane] - F.y) * (1 - Math.exp(-dt / LANE_TAU));
    if (F.cd <= 0) F.mode = "fly";
    return;
  }
  if (F.mode === "done") {
    F.doneT -= dt;
    if (F.doneT <= 0) F.finished = true;
    return;
  }

  // 비: 내리는 동안 날개가 젖어 줄을 옮기는 것이 느려진다(우산이 있으면 괜찮다). 가끔 천둥이 번쩍인다.
  const raining = F.lv.rain.some(([a, b]) => p >= a && p < b);
  F.rainK += ((raining ? 1 : 0) - F.rainK) * (1 - Math.exp(-dt / 0.8));
  if (raining && F.hintsOn && !F.hinted.r) { F.hinted.r = true; say(F, "비가 내려요! 날개가 젖어 줄 옮기기가 느려져요", 3.4); }
  if (raining && Math.random() < dt * 0.25) F.flash = 0.3;

  // 높이: 착륙 구간(76% 이후)은 자동으로 내려앉고, 그 전에는 고른 줄로 부드럽게 옮겨 간다.
  const auto = p >= 0.76;
  const target = auto ? guide(p) : LANE_Y[F.lane];
  const tau = auto ? 0.35 : LANE_TAU * (1 + 0.8 * F.rainK * (F.umbrella > 0 ? 0 : 1));
  const ny = F.y + (target - F.y) * (1 - Math.exp(-dt / tau));
  F.vy = (ny - F.y) / dt; F.y = ny;
  F.thrust = clamp(Math.abs(F.vy) / 500 + 0.3, 0, 1);              // 날개 퍼덕임 세기

  // 바닷바람: 예고(0.9초) → 부는 동안 전진 속도가 줄어든다(멈추거나 뒤로 밀리지 않는다). 순풍 리본이 있으면 영향이 없다.
  const ws = f.windStrength;
  if (p >= 0.1 && p < 0.86 && !F.practice) {
    F.windT -= dt;
    if (F.windState === "none" && F.windT <= 0) {
      F.windState = "warn"; F.windT = 0.9;
      if (F.hintsOn && !F.hinted.w) { F.hinted.w = true; say(F, "바람이 몰려와요! 잠깐 속도가 느려져요", 3.2); }
    } else if (F.windState === "warn" && F.windT <= 0) {
      F.windState = "blow"; F.windT = 1.4 + 0.3 * ws;
    } else if (F.windState === "blow" && F.windT <= 0) {
      F.windState = "none"; F.windT = Math.max(4, 8 - 1.2 * ws);
    }
  } else F.windState = "none";
  const slow = F.windState === "blow" ? 0.4 + 0.08 * ws : 0;
  F.windPush += (slow - F.windPush) * (1 - Math.exp(-dt / 0.25));
  const vx = VX * (1 - (F.ribbon > 0 ? 0 : F.windPush)) * (F.ribbon > 0 ? 1.35 : 1) * (F.practice ? 0.75 : 1);   // 연습은 천천히
  F.x = clamp(F.x + vx * dt, 0, LEN);

  // 착륙: 섬에 가까워지면 자동으로 부드럽게 내려앉는다
  if (F.x >= 0.95 * LEN) {
    F.landSpeed = 0.1; F.y = ISLAND; F.vy = 0; F.mode = "done"; F.doneT = 0.9;
    fx.chime?.(660);
    return;
  }

  // 충돌: 깃털 방패가 있으면 한 번 막아 주고, 아니면 하트가 하나 줄어든다
  const hit = () => {
    if (F.inv > 0) return false;
    if (F.guard > 0) { F.guard--; F.inv = 1.0; F.pop = { kind: "guard", t: 0.5 }; fx.chime?.(520); if (F.practice) say(F, "방패가 막아 줬어요! 하트는 그대로예요", 2.2); return false; }
    F.hits++; F.totalHits++; F.inv = INV; F.shake = 0.25; F.x = Math.max(0, F.x - 40);
    fx.thud?.();
    if (F.practice) { F.hitMark = 1.1; F.hits = Math.min(F.hits, 3); }
    if (F.hits >= MAX_HITS) { fail(F, "편지가 흔들렸다 — 체크포인트에서 다시"); return true; }
    return false;
  };

  // 갑자기 일어나는 사건: 경고(tele) → 발생(act). 경고 동안 줄을 옮겨 피한다.
  const warn = F.lv.warn;
  for (const ev of F.lv.events) {
    const breach = ev.kind === "shark" || ev.kind === "whale";
    const d = ev.x - F.x;
    if (ev.state === "idle") {
      if (breach ? (d <= VX * (warn + 0.85) && d > -60) : F.x >= ev.x) {   // 뛰어오르는 정점이 내가 도착할 때와 맞도록 미리 경고한다
        ev.state = "tele"; ev.t = warn;
        if (!breach) ev.y = LANE_Y[ev.lane];                                   // 새·비행기는 정해진 한 줄을 지난다(경고 띠로 알려 준다)
        if (F.hintsOn && !F.hinted.ev) { F.hinted.ev = true; say(F, breach ? "바다가 일렁여요! 위쪽 줄로 피하세요" : "빨간 띠가 뜬 줄을 피하세요!", 3.2); }
      }
    } else if (ev.state === "tele") {
      ev.t -= dt;
      if (ev.t <= 0) {
        ev.state = "act";
        if (breach) ev.t = 0;
        else ev.px = F.x + ((F.viewW || 800) - SX) + 60;                      // 화면 오른쪽 바깥에서 날아온다
      }
    } else if (ev.state === "act") {
      if (breach) {
        ev.t += dt;
        const u = ev.t / 1.7;
        ev.h = ev.peak * 4 * u * (1 - u);                                      // 포물선으로 뛰어올랐다 떨어진다
        if (u >= 1) { ev.state = "done"; ev.h = 0; }
        else if (Math.abs(F.x - ev.x) < ev.w / 2 + R * 0.7 && F.y - R < ev.h && hit()) return;
      } else {
        const vxe = ev.kind === "plane" ? -760 : -520;
        ev.px += vxe * dt;
        ev.cy = ev.y + Math.sin(F.t * 3 + ev.seed) * (ev.kind === "plane" ? 4 : 8);
        const w = ev.kind === "plane" ? 80 : 74, h = ev.kind === "plane" ? 24 : 50;
        if (Math.abs(F.x - ev.px) < w / 2 + R * 0.7 && Math.abs(F.y - ev.cy) < h / 2 + R * 0.8 && hit()) return;
        if (ev.px < F.x - 300) ev.state = "done";
      }
    }
  }
  for (const c of F.lv.clouds) {
    if (Math.hypot(F.x - c.x, F.y - c.y) < c.r + R && hit()) return;
  }
  // 번개: 예고(0.9초) → 내리침(0.6초). 표시된 줄에 있으면 맞는다.
  for (const b of F.lv.bolts) {
    const d = b.x - F.x;
    if (b.state === "idle" && d < 300 && d > 0) {
      b.state = "warn"; b.t = 0.9;
      if (F.hintsOn && !F.hinted.bolt) { F.hinted.bolt = true; say(F, "번개가 쳐요! 표시된 줄을 피하세요", 3.6); }
    } else if (b.state === "warn") {
      b.t -= dt;
      if (b.t <= 0) { b.state = "strike"; b.t = 0.6; F.flash = 0.35; fx.thud?.(); }
    } else if (b.state === "strike") {
      b.t -= dt;
      if (b.t <= 0) b.state = "done";
      else if (Math.abs(F.x - b.x) < 24 && Math.abs(F.y - LANE_Y[b.lane]) < 90 && hit()) return;
    } else if (b.state === "done" && d > 420) b.state = "idle";
  }
  for (const v of F.lv.vortices) {
    const inside = Math.hypot(F.x - v.x, F.y - v.y) < v.r;
    if (inside && !v.inside) { F.rev = 2; say(F, "회오리! 위아래가 반대로 돼요", 1.4); }
    v.inside = inside;
  }

  // 아이템 얻기
  for (const it of F.lv.items) {
    if (it.taken || Math.abs(F.x - it.x) > 32 || Math.abs(F.y - LANE_Y[it.lane]) > 48) continue;
    it.taken = true;
    F.pop = { kind: it.kind, t: 0.6 };
    if (it.kind === "orb") fx.chime?.(1040 + Math.random() * 120);
    else fx.chime?.(780);
    if (it.kind === "shield") { F.guard = Math.min(2, F.guard + 1); if (F.hintsOn && !F.hinted.i1) { F.hinted.i1 = true; say(F, "깃털 방패! 다음 충돌을 한 번 막아 줘요", 3); } }
    else if (it.kind === "heart") { F.hits = Math.max(0, F.hits - 1); if (F.hintsOn && !F.hinted.i2) { F.hinted.i2 = true; say(F, "심장! 하트가 하나 돌아와요", 3); } }
    else if (it.kind === "ribbon") { F.ribbon = 3; if (F.hintsOn && !F.hinted.i3) { F.hinted.i3 = true; say(F, "순풍 리본! 3초 동안 바람을 무시하고 빨라져요", 3); } }
    else if (it.kind === "umbrella") { F.umbrella = 10; if (F.hintsOn && !F.hinted.i4) { F.hinted.i4 = true; say(F, "우산! 비에 젖지 않아요", 3); } }
    else if (F.hintsOn && !F.hinted.i0) { F.hinted.i0 = true; say(F, "기억 구슬! 모으면 도착했을 때 추억이 한 줄 더 떠올라요", 3.2); }
  }
}
