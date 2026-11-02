import { LEN, LAND_Y, R, SX, VX_PRACTICE, LANE_Y, LANE_TAU, MAX_HITS, INV, COMBO_SHIELD, JUMP_T, JUMP_SPAN, GROUND_Y, TAKEOFF, WALK_Y, WALK_JUMP, WALK_JUMP_T, LAND_P, CALM_DIST, GUARD_T, UMBRELLA_T } from "./constants.js";
import { buildLevel, buildPracticeLevel, guide, clamp, speedAt } from "./level.js";

export function createFlight(letter, tutorialSeen, practice = false) {
  return {
    letter,
    lv: practice ? buildPracticeLevel() : buildLevel(letter),
    practice, coach: null, hitMark: 0,   // 연습 비행: 안내 문구와 맞은 자리 표시
    x: 0, y: GROUND_Y, vy: 0, thrust: 0.4,
    lift: 0, takeX: 0,                 // 이륙 진행(0 출발 섬 위에 서 있음 → 1 날고 있음), 발을 뗀 자리
    lane: 1,                           // 지금 줄(0 아래, 1 가운데, 2 위)
    moves: [],                         // 입력 대기열: +1 위로 한 줄, -1 아래로 한 줄
    hits: 0, totalHits: 0, fails: 0, inv: 0, rev: 0, shake: 0,
    guard: 0, guardT: 0, ribbon: 0, umbrella: 0,  // 깃털 방패 개수와 남은 시간, 순풍 리본/우산 남은 시간
    cd: practice ? 3 : tutorialSeen ? 2 : 4,          // 이륙 카운트(초)
    mode: "count",                     // count | fly | done
    msg: "", msgT: 0, t: 0, doneT: 0,
    land: 0, landV: 0,                 // 착륙 자세로 바뀌는 정도(0~1), 내려앉은 뒤 미끄러지는 속도
    finished: false,
    showTutorial: practice || !tutorialSeen,
    hintsOn: !practice && !tutorialSeen,            // 첫 비행에서만 단계별 안내를 띄운다
    hinted: {},
    rainK: 0, flash: 0,                // 비의 세기(0~1), 번개/천둥 번쩍임
    windState: "none",                 // none | warn(예고) | blow(부는 중). 바람은 앞으로 가는 속도만 줄인다
    windT: 4, windPush: 0,
    pop: null,                         // 아이템을 얻은 순간의 효과 { kind, t }
    vx: 0,                             // 지금 전진 속도(속도선 연출에 쓴다)
    combo: 0, bestCombo: 0, comboT: 0, // 연속으로 피한 사고 수, 콤보 표시 남은 시간
    braceTaps: 0, brace: { on: false, g: 0.6 },   // 비바람 버티기: Enter 연타 횟수, 게이지(0~1)
    walkK: 0, jumpT: 0,                // 하늘길: 걷는 자세 정도(0~1), 뛰는 중 남은 시간
    calm: false, calmDone: false,      // 도착 2초 전부터는 장애물이 없다
  };
}

const say = (F, text, sec = 1.6) => { F.msg = text; F.msgT = sec; };
export const orbsCollected = (F) => F.lv.items.filter((i) => i.kind === "orb" && i.taken).length;

// 실패한 구간을 직전 체크포인트에서 다시 시작한다. 처음부터 재도전하지 않는다.
function restart(F) {
  const p = F.x / LEN;
  let cp = 0;
  for (const c of F.lv.f.checkpoints) if (c <= p && c > cp) cp = c;
  F.x = cp * LEN; F.lane = 1; F.vy = 0; F.moves.length = 0;
  F.lift = cp === 0 ? 0 : 1; F.y = cp === 0 ? GROUND_Y : LANE_Y[1];          // 처음으로 돌아가면 다시 섬에서 날아오른다
  F.hits = 0; F.rev = 0; F.inv = 2; F.cd = 1.2; F.mode = "count";
  F.guard = 0; F.guardT = 0; F.ribbon = 0; F.umbrella = 0;
  F.windState = "none"; F.windT = 3; F.windPush = 0;
  for (const v of F.lv.vortices) v.inside = false;
  for (const ev of F.lv.events) { ev.state = "idle"; ev.t = 0; ev.passed = false; ev.dived = false; ev.lane = ev.lane0 ?? ev.lane; }
  for (const b of F.lv.bolts) { b.state = "idle"; b.t = 0; }
  for (const it of F.lv.items) if (it.x >= F.x) it.taken = false;      // 되돌아간 구간의 아이템은 다시 나타난다
  F.rainK = 0; F.flash = 0; F.combo = 0;
  F.brace.on = false; F.brace.g = 0.6; F.braceTaps = 0; F.walkK = 0; F.jumpT = 0;
  for (const o of F.lv.walk?.obs || []) o.passed = false;
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
  if (F.umbrella > 0) { F.umbrella = Math.max(0, F.umbrella - dt); if (F.umbrella === 0) say(F, "우산이 사라졌어요", 1.4); }
  if (F.guard > 0) { F.guardT -= dt; if (F.guardT <= 0) { F.guard = 0; F.guardT = 0; say(F, "깃털 방패가 사라졌어요", 1.4); } }   // 방패는 시간이 지나면 사라진다
  F.comboT = Math.max(0, F.comboT - dt);
  if (F.pop) { F.pop.t -= dt; if (F.pop.t <= 0) F.pop = null; }
  const f = F.lv.f;
  const p = F.x / LEN;
  const calm = F.x >= LAND_P * LEN - CALM_DIST;            // 도착 2초 전부터: 새로운 위험도, 부딪힘도 없다
  F.calm = calm;
  const wk = F.lv.walk, inZone = !!wk && F.x >= wk.a && F.x < wk.b;
  F.hitMark = Math.max(0, F.hitMark - dt);
  if (F.practice && F.mode === "fly") {
    for (const c of F.lv.coach) if (!c.done && F.x >= c.x) { c.done = true; F.coach = { text: c.text, n: c.n, total: c.total, t: c.n === c.total ? 6 : 7 }; }
    if (F.coach) { F.coach.t -= dt; if (F.coach.t <= 0 && F.coach.n < F.coach.total) F.coach = null; }
  }
  if (F.hintsOn && F.mode === "fly") {
    const hints = [[0.04, "a", "경고가 뜬 줄을 피하고, 반짝이는 구슬을 모아요"], [0.3, "s", "점점 빨라져요! 연속으로 피하면 방패를 얻어요"], [0.78, "c", "착륙은 자동이에요. 편안히 내려앉아요"]];
    for (const [thr, key, text] of hints) if (p >= thr && !F.hinted[key]) { F.hinted[key] = true; say(F, text, 3.6); }
  }

  // 줄 옮기기: 위·아래로 한 줄씩. 회오리 안에서는 반대로 움직인다.
  const flip = F.rev > 0 ? -1 : 1;
  for (const m of F.moves.splice(0)) {
    if (inZone) { if (m > 0 && F.jumpT <= 0 && F.walkK > 0.8) { F.jumpT = WALK_JUMP_T; fx.jump?.(); } }   // 하늘길에서는 ↑ = 폴짝
    else F.lane = clamp(F.lane + m * flip, 0, 2);
  }

  if (F.mode === "count") {
    F.cd -= dt;
    const tk = Math.ceil(F.cd);
    if (F.cd > 0 && tk !== F.lastTick) { F.lastTick = tk; fx.tick?.(); }
    if (F.lift >= 1) F.y += (LANE_Y[F.lane] - F.y) * (1 - Math.exp(-dt / LANE_TAU));   // 섬 위에 서 있는 동안은 땅에 붙어 있다
    if (F.cd <= 0) { F.mode = "fly"; F.takeX = F.x; if (F.lift < 1) fx.takeoff?.(); }
    return;
  }
  if (F.mode === "done") {
    // 착륙 뒤: 잔디 위를 조금 미끄러지다 멈추며 똑바로 선다
    F.doneT -= dt;
    F.land = Math.min(1, F.land + dt * 4);
    F.x += F.landV * dt; F.landV *= Math.exp(-dt * 5);
    if (F.doneT <= 0) F.finished = true;
    return;
  }

  // 비: 내리는 동안 날개가 젖어 줄을 옮기는 것이 느려진다(우산이 있으면 괜찮다). 가끔 천둥이 번쩍인다.
  const raining = F.lv.rain.some(([a, b]) => p >= a && p < b);
  F.rainK += ((raining ? 1 : 0) - F.rainK) * (1 - Math.exp(-dt / 0.8));
  if (raining && F.hintsOn && !F.hinted.r) { F.hinted.r = true; say(F, "비가 내려요! 날개가 젖어 줄 옮기기가 느려져요", 3.4); }
  if (raining && Math.random() < dt * 0.25) F.flash = 0.3;

  // 높이: 착륙 구간(76% 이후)은 자동으로 내려앉고, 그 전에는 고른 줄로 부드럽게 옮겨 간다.
  // 이륙: 처음 20%는 섬 위를 달리고(도움닫기), 그다음 고른 줄까지 부드럽게 솟아오른다
  const lifting = F.lift < 1;
  if (lifting) F.lift = Math.min(1, F.lift + dt / TAKEOFF);
  const auto = p >= 0.76;
  if (inZone) { F.lane = 1; F.jumpT = Math.max(0, F.jumpT - dt); } else F.jumpT = 0;
  F.walkK += ((inZone && Math.abs(F.y - WALK_Y) < 16 ? 1 : 0) - F.walkK) * (1 - Math.exp(-dt / 0.12));
  const walking = inZone && F.walkK > 0.8;
  const ju = 1 - F.jumpT / WALK_JUMP_T, jh = F.jumpT > 0 ? WALK_JUMP * 4 * ju * (1 - ju) : 0;
  const target = inZone ? WALK_Y : auto ? guide(p) : LANE_Y[F.lane];
  const tau = inZone ? 0.16 : auto ? 0.35 : LANE_TAU * (1 + 0.8 * F.rainK * (F.umbrella > 0 ? 0 : 1));
  const rise = clamp((F.lift - 0.2) / 0.8, 0, 1);
  F.land = clamp((p - 0.92) / 0.03, 0, 1);                                   // 착륙 직전부터 다리를 내려 발이 먼저 닿게 한다
  const ny = lifting ? GROUND_Y + (target - GROUND_Y) * (1 - (1 - rise) ** 3) : walking ? WALK_Y + jh : F.y + (target - F.y) * (1 - Math.exp(-dt / tau));
  F.vy = (ny - F.y) / dt; F.y = ny;
  F.thrust = clamp(Math.abs(F.vy) / 500 + 0.3, 0, 1);              // 날개 퍼덕임 세기

  // 바닷바람: 예고(0.7초) → 부는 동안 전진 속도가 줄어든다(멈추거나 뒤로 밀리지 않는다). 언제 불지는 매번 다르다. 순풍 리본이 있으면 영향이 없다.
  const ws = f.windStrength;
  if (p >= 0.1 && p < 0.84 && !F.practice && !inZone && !calm) {
    F.windT -= dt;
    if (F.windState === "none" && F.windT <= 0) {
      F.windState = "warn"; F.windT = 0.7;
      if (!F.hinted.w) { F.hinted.w = true; say(F, "비바람이 몰려와요! Enter를 연달아 눌러 버텨요", 3.2); }
    } else if (F.windState === "warn" && F.windT <= 0) {
      F.windState = "blow"; F.windT = 1.4 + 0.4 * ws + Math.random() * 1.0;
    } else if (F.windState === "blow" && F.windT <= 0) {
      F.windState = "none"; F.windT = 4 + Math.random() * (8 - ws);
    }
  } else F.windState = "none";
  const slow = 0;                                          // 바람은 속도를 늦추지 않는다. 대신 Enter를 연타해 버텨야 한다(아래 버티기)
  F.windPush += (slow - F.windPush) * (1 - Math.exp(-dt / 0.25));
  const base = F.practice ? VX_PRACTICE : speedAt(p);                                           // 진행할수록 빨라진다(연습은 일정)
  const vx = base * (F.ribbon > 0 ? 1.3 : 1) * (0.3 + 0.7 * F.lift) * (inZone ? 0.8 : 1);   // 이륙하며 속도가 붙는다
  F.vx = vx;
  F.x = clamp(F.x + vx * dt, 0, LEN);

  // 착륙: 섬에 가까워지면 자동으로 부드럽게 내려앉는다
  if (F.x >= LAND_P * LEN) {
    F.y = LAND_Y; F.vy = 0; F.mode = "done"; F.doneT = 1.2; F.landV = vx * 0.6;
    fx.land?.();
    return;
  }

  // 충돌: 깃털 방패가 있으면 한 번 막아 주고, 아니면 하트가 하나 줄어든다
  const hit = () => {
    if (F.inv > 0 || calm) return false;
    if (F.guard > 0) { F.guard--; F.inv = 1.0; F.pop = { kind: "guard", t: 0.5 }; fx.shield?.(); if (F.practice) say(F, "방패가 막아 줬어요! 하트는 그대로예요", 2.2); return false; }
    F.hits++; F.totalHits++; F.inv = INV; F.shake = 0.3; F.x = Math.max(0, F.x - 40); F.combo = 0;
    fx.thud?.();
    if (F.practice) { F.hitMark = 1.1; F.hits = Math.min(F.hits, 3); }
    if (F.hits >= MAX_HITS) { fail(F, "편지가 흔들렸다 — 체크포인트에서 다시"); return true; }
    return false;
  };

  // 사고를 무사히 지나치면 콤보가 오른다. COMBO_SHIELD번 연속이면 깃털 방패를 하나 준다.
  const dodged = () => {
    F.combo++; F.bestCombo = Math.max(F.bestCombo, F.combo); F.comboT = 1.2;
    if (F.combo >= 2) fx.combo?.(F.combo);
    if (F.combo % COMBO_SHIELD === 0 && !F.practice) {
      F.guard = Math.min(2, F.guard + 1); F.guardT = GUARD_T; F.pop = { kind: "guard", t: 0.5 }; fx.shield?.();
      say(F, `${F.combo}연속 회피! 깃털 방패를 얻었어요`, 1.8);
    }
  };

  // 도착 2초 전: 아직 시작하지 않은 사고는 모두 거둔다
  if (calm && !F.calmDone) {
    F.calmDone = true; F.rev = 0;
    for (const ev of F.lv.events) if (ev.state === "idle") ev.state = "done";
    for (const b of F.lv.bolts) if (b.state === "idle") b.state = "done";
    for (const v of F.lv.vortices) v.inside = true;
  }

  // 비바람 버티기: 바람이 불거나 비가 내리는 동안 게이지가 줄어든다. Enter를 연달아 눌러 채우고, 다 닳으면 하트가 하나 줄어든다.
  // 속도는 줄지 않는다. 순풍 리본이 있으면 바람을 무시한다. 우산이 있으면 비에서 덜 줄어든다.
  const taps = F.braceTaps; F.braceTaps = 0;
  const storm = !calm && !inZone && F.ribbon <= 0 && (F.windState === "blow" || raining);
  if (storm) {
    const B = F.brace;
    if (!B.on) { B.on = true; B.g = 0.6; if (!F.hinted.brace) { F.hinted.brace = true; say(F, "Enter를 연달아 눌러 게이지를 채워요! 화면 버튼도 돼요", 3.2); } }
    B.g = clamp(B.g + taps * 0.11 - dt * (0.26 + 0.03 * ws) * (F.umbrella > 0 && raining ? 0.7 : 1), 0, 1);
    if (B.g <= 0) { B.g = 0.5; say(F, "바람에 밀렸어요! 더 빨리 눌러요", 1.6); if (hit()) return; }
  } else F.brace.on = false;

  // 하늘길의 장애물: 구름 덩어리는 뛰어 넘고, 구멍은 뛰어 건넌다
  if (inZone && F.walkK > 0.5) {
    if (!F.hinted.walk) { F.hinted.walk = true; say(F, "하늘길이에요! ↑ 로 폴짝 뛰어 구름과 구멍을 넘어요", 3.6); }
    for (const o of wk.obs) {
      const dx = Math.abs(F.x - o.x), dy = F.y - WALK_Y;
      const bad = o.kind === "puff" ? dx < o.w / 2 + R * 0.6 && dy < o.h - 4 : dx < o.w / 2 - 14 && dy < 14;
      if (bad && hit()) return;
      if (!o.passed && F.x - o.x > o.w / 2 + R) { o.passed = true; if (F.inv <= 0) dodged(); }
    }
  }

  // 갑자기 일어나는 사건: 경고(tele) → 발생(act). 경고 동안 줄을 옮겨 피한다.
  // 날아오는 것은 ev.x 자리에서 우체부와 마주치도록, 지금 속도와 화면 폭으로 경고 시작 시점을 거꾸로 계산한다.
  const span = (F.viewW || 800) - SX + 60;                                    // 화면 오른쪽 바깥에서 우체부까지의 거리
  for (const ev of F.lv.events) {
    const breach = ev.kind === "shark" || ev.kind === "whale";
    const ve = ev.kind === "plane" ? 820 : 560;
    const d = ev.x - F.x;
    if (ev.state === "idle") {
      const lead = breach ? vx * (ev.warn + 0.85) : vx * ev.warn + (vx * span) / (vx + ve);
      if (d <= lead && d > -60) {
        ev.state = "tele"; ev.t = ev.warn; fx.warn?.();
        if (!breach) ev.y = LANE_Y[ev.lane];                                   // 새·비행기는 경고된 줄로 온다(검은 새 떼는 도중에 꺾는다)
        if (F.hintsOn && !F.hinted.ev) { F.hinted.ev = true; say(F, breach ? "바다가 일렁여요! 다른 줄로 피하세요" : "빨간 띠가 뜬 줄을 피하세요!", 3.2); }
      }
    } else if (ev.state === "tele") {
      ev.t -= dt;
      if (ev.t <= 0) {
        ev.state = "act";
        if (breach) { ev.t = 0; fx.splash?.(); }
        else { fx.whoosh?.(); ev.px = F.x + span; ev.ly = ev.cy = ev.y; }
      }
    } else if (ev.state === "act") {
      if (breach) {
        // 둥근 호: ev.x + JUMP_SPAN에서 물을 박차고 나와, ev.x에서 정점(peak)을 찍고, 왼쪽으로 넘어가 다시 잠긴다.
        // 몸통 중심(bx, by)과 진행 방향(vx, vy)을 구해 두고, 그 방향으로 기운 타원으로 부딪힘을 잰다.
        ev.t += dt;
        const u = ev.t / JUMP_T, top = ev.peak + 30;
        ev.bx = ev.x + JUMP_SPAN * (1 - 2 * u);
        ev.by = top * 4 * u * (1 - u) - 30;                                     // 물속 30px에서 나와 물속으로 들어간다
        ev.vx = -2 * JUMP_SPAN; ev.vy = top * 4 * (1 - 2 * u);
        if (u >= 1) { ev.state = "done"; fx.splash?.(); }
        else {
          const [L, T] = ev.kind === "whale" ? [124, 44] : [100, 34];
          const n = Math.hypot(ev.vx, ev.vy), ax = ev.vx / n, ay = ev.vy / n;
          const dx = F.x - ev.bx, dy = F.y - ev.by;
          const along = dx * ax + dy * ay, perp = dy * ax - dx * ay;
          if ((along / (L / 2 + R * 0.6)) ** 2 + (perp / (T / 2 + R * 0.6)) ** 2 < 1 && hit()) return;
          if (!ev.passed && F.x - ev.bx > L / 2 + R) { ev.passed = true; if (F.inv <= 0) dodged(); }
        }
      } else {
        ev.px -= ve * dt;
        // 검은 새 떼: 우체부와 거리가 좁혀지면 옆 줄로 급강하/급상승한다
        if (ev.dive != null && !ev.dived && ev.px - F.x < 420) {
          ev.dived = true; ev.lane0 = ev.lane; ev.lane = ev.dive; ev.y = LANE_Y[ev.dive];
          if (F.hintsOn && !F.hinted.dv) { F.hinted.dv = true; say(F, "검은 새 떼는 도중에 줄을 바꿔요!", 2.6); }
        }
        ev.ly += (ev.y - ev.ly) * (1 - Math.exp(-dt / 0.12));                 // 줄을 바꿀 때 부드럽게 꺾는다
        ev.cy = ev.ly + Math.sin(F.t * 3 + ev.seed) * (ev.kind === "plane" ? 4 : 8);
        const w = ev.kind === "plane" ? 80 : 74, h = ev.kind === "plane" ? 24 : 50;
        if (Math.abs(F.x - ev.px) < w / 2 + R * 0.7 && Math.abs(F.y - ev.cy) < h / 2 + R * 0.8 && hit()) return;
        if (!ev.passed && F.x - ev.px > w / 2 + R) { ev.passed = true; if (F.inv <= 0) dodged(); }
        if (ev.px < F.x - 300) ev.state = "done";
      }
    }
  }
  for (const c of F.lv.clouds) {
    if (c.drift) c.y = c.drift.a + (c.drift.b - c.drift.a) * (0.5 + 0.5 * Math.sin(F.t * c.drift.w + c.drift.ph));   // 두 줄 사이를 오르내린다
    if (Math.hypot(F.x - c.x, F.y - c.y) < c.r + R && hit()) return;
  }
  // 번개: 예고 → 내리침(0.5초). 내리치는 순간 우체부가 그 자리를 지나도록 지금 속도로 예고 시점을 맞춘다.
  for (const b of F.lv.bolts) {
    const d = b.x - F.x;
    if (b.state === "idle" && d < vx * (b.warn + 0.12) && d > 0) {
      b.state = "warn"; b.t = b.warn;
      if (F.hintsOn && !F.hinted.bolt) { F.hinted.bolt = true; say(F, "번개가 쳐요! 표시된 줄을 피하세요", 3.6); }
    } else if (b.state === "warn") {
      b.t -= dt;
      if (b.t <= 0) { b.state = "strike"; b.t = 0.5; F.flash = 0.35; fx.thud?.(); }
    } else if (b.state === "strike") {
      b.t -= dt;
      if (b.t <= 0) b.state = "done";
      else if (Math.abs(F.x - b.x) < 40 && Math.abs(F.y - LANE_Y[b.lane]) < 90 && hit()) return;
    } else if (b.state === "done" && d > 420) b.state = "idle";
  }
  for (const v of F.lv.vortices) {
    const inside = Math.hypot(F.x - v.x, F.y - v.y) < v.r;
    if (inside && !v.inside) { F.rev = 2; say(F, "회오리! 위아래가 반대로 돼요", 1.4); }
    v.inside = inside;
  }

  // 아이템 얻기
  for (const it of F.lv.items) {
    if (it.taken || Math.abs(F.x - it.x) > 32 || Math.abs(F.y - (it.y ?? LANE_Y[it.lane])) > 48) continue;
    it.taken = true;
    F.pop = { kind: it.kind, t: 0.6 };
    if (it.kind === "orb") fx.chime?.(1040 + Math.random() * 120);
    else fx.chime?.(780);
    if (it.kind === "shield") { F.guard = Math.min(2, F.guard + 1); F.guardT = GUARD_T; if (F.hintsOn && !F.hinted.i1) { F.hinted.i1 = true; say(F, "깃털 방패! 다음 충돌을 한 번 막아 줘요 (12초 뒤 사라져요)", 3); } }
    else if (it.kind === "heart") { F.hits = Math.max(0, F.hits - 1); if (F.hintsOn && !F.hinted.i2) { F.hinted.i2 = true; say(F, "심장! 하트가 하나 돌아와요", 3); } }
    else if (it.kind === "ribbon") { F.ribbon = 3; if (F.hintsOn && !F.hinted.i3) { F.hinted.i3 = true; say(F, "순풍 리본! 3초 동안 바람을 무시하고 빨라져요", 3); } }
    else if (it.kind === "umbrella") { F.umbrella = UMBRELLA_T; if (F.hintsOn && !F.hinted.i4) { F.hinted.i4 = true; say(F, "우산! 10초 동안 비에 젖지 않아요", 3); } }
    else if (F.hintsOn && !F.hinted.i0) { F.hinted.i0 = true; say(F, "기억 구슬! 모으면 도착했을 때 추억이 한 줄 더 떠올라요", 3.2); }
  }
}
