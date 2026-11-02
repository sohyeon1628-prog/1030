import { test } from "node:test";
import assert from "node:assert/strict";
import { createFlight, stepFlight, computeGrade } from "../src/game/engine.js";
import { buildLevel, buildPracticeLevel } from "../src/game/level.js";
import { LEN, LAND_P, CALM_DIST } from "../src/game/constants.js";
import { mergeStates } from "../src/mergeStates.js";

// 코스와 바람은 난수로 정해지므로, 시험이 매번 같은 결과가 나오게 난수를 고정한다(이 파일 안에서만).
let seed0 = 12345;
Math.random = () => (seed0 = (seed0 * 1664525 + 1013904223) >>> 0) / 4294967296;

// 비행 엔진과 코스 만들기, 이 기기와 서버의 기록 합치기
const FL = { 1: { windStrength: 1, corridorWidth: 220 }, 2: { windStrength: 2, corridorWidth: 140 }, 3: { windStrength: 3, corridorWidth: 100 } };
const letter = (ws, skyWalk, id = "t") => ({ id, flight: { ...FL[ws], checkpoints: [0, 0.5, 0.75], skyWalk } });

function fly(ws, skyWalk, bot, seed) {
  const F = createFlight(letter(ws, skyWalk, "s" + seed), true, false); F.viewW = 800; F.moveCool = 0;
  let t = 0, calmHits = 0, calmEvents = 0, tap = 0;
  while (!F.finished && t < 240) {
    if (F.mode === "fly" && bot === "smart") {
      const wk = F.lv.walk;
      if (!(wk && F.x >= wk.a && F.x < wk.b)) {                                                  // 날 때: 앞쪽에서 막힌 줄을 피해 비어 있는 가장 가까운 줄로 옮긴다
        const blockedLane = (l) => F.lv.blocks.some((k) => k.lane === l && k.b > F.x - 30 && k.a < F.x + 420);
        if (blockedLane(F.lane)) { const free = [0, 1, 2].filter((l) => !blockedLane(l)).sort((p, q) => Math.abs(p - F.lane) - Math.abs(q - F.lane))[0]; if (free !== undefined && F.moveCool <= 0) { F.moves.push(Math.sign(free - F.lane)); F.moveCool = 8; } }
        F.moveCool = (F.moveCool || 0) - 1;
      }
      if (wk && F.x >= wk.a && F.x < wk.b && F.jumpT <= 0 && F.walkK > 0.8 && wk.obs.find((o) => o.x > F.x && o.x - F.x < 190)) F.moves.push(1);
      if (F.brace.on) { tap += 4 / 60; while (tap >= 1) { F.braceTaps++; tap--; } }
    }
    const before = F.totalHits; stepFlight(F, 1 / 60, {}); t += 1 / 60;
    if (F.calm && F.totalHits > before) calmHits++;
    if (F.calm) for (const e of F.lv.events) if (e.state === "tele" || e.state === "act") calmEvents++;
  }
  return { F, t, calmHits, calmEvents };
}

test("연습 비행은 가만히 있어도 끝까지 도착한다(실패 없음)", () => {
  const F = createFlight(letter(1, false), true, true); F.viewW = 800;
  let t = 0; while (!F.finished && t < 240) { stepFlight(F, 1 / 60, {}); t += 1 / 60; }
  assert.ok(F.finished); assert.equal(F.fails, 0); assert.ok(buildPracticeLevel().coach.length > 5);
});
test("조작하는 봇은 모든 장에서 끝까지 도착한다", () => {
  for (const [ws, sw] of [[1, false], [2, false], [2, true], [3, true]]) {
    const r = fly(ws, sw, "smart", ws * 7 + (sw ? 1 : 0));
    assert.ok(r.F.finished, `바람 ${ws} 하늘길 ${sw}: 도착하지 못했다`);
    assert.equal(r.F.fails, 0, `실패가 있었다(${r.F.fails})`);
  }
});
test("아무것도 누르지 않으면 도착하지 못한다(버티기와 피하기가 필요하다)", () => {
  const r = fly(3, true, "idle", 5);
  assert.ok(!r.F.finished && r.F.fails > 0);
});
test("도착 2초 전부터는 사고와 부딪힘이 없다(여러 코스)", () => {
  for (let s = 0; s < 40; s++) { const r = fly(1 + (s % 3), s % 2 === 0, "idle", s); assert.equal(r.calmHits + r.calmEvents, 0, `코스 ${s}`); }
  assert.ok(LAND_P * LEN - CALM_DIST > 0.8 * LEN);
});
test("코스의 마지막 사고는 착륙 직전보다 훨씬 앞에서 끝난다", () => {
  for (let s = 0; s < 40; s++) {
    const lv = buildLevel(letter(1 + (s % 3), s % 2 === 0), `seed${s}`);
    const last = Math.max(0, ...lv.events.map((e) => e.x), ...lv.bolts.map((b) => b.x), ...lv.vortices.map((v) => v.x), ...lv.clouds.map((c) => c.x));
    assert.ok(last < 0.8 * LEN, `사고가 너무 늦다: ${(last / LEN).toFixed(3)}`);
    assert.ok(lv.rain.every(([, b]) => b <= 0.86), "비는 도착 2초 전에 그친다");
  }
});
test("같은 시드는 같은 코스, 다른 시드는 다른 코스", () => {
  const a = buildLevel(letter(2, false), "x"), b = buildLevel(letter(2, false), "x"), c = buildLevel(letter(2, false), "y");
  assert.deepEqual(a.events.map((e) => e.x), b.events.map((e) => e.x));
  assert.notDeepEqual(a.events.map((e) => e.x), c.events.map((e) => e.x));
});
test("어느 곳에서도 세 줄이 동시에 막히지 않는다", () => {
  for (let s = 0; s < 30; s++) {
    const { blocks } = buildLevel(letter(3, true), "b" + s);
    for (const x of blocks.flatMap((k) => [k.a, k.b])) assert.ok([0, 1, 2].some((l) => !blocks.some((k) => k.lane === l && k.a <= x && x <= k.b)), `x=${x}`);
  }
});
test("등급: 부딪힘과 실패 횟수로 정해진다", () => {
  assert.equal(computeGrade(0, 1), "perfect"); assert.equal(computeGrade(1, 2), "safe"); assert.equal(computeGrade(3, 3), "rough");
});

test("기록 합치기: 더 나아간 쪽과 합집합을 남긴다", () => {
  const a = { delivered: { l1: true }, grade: { l1: "safe" }, orbs: { l1: 3 }, orbExtra: 2, mine: [{ id: "m1", createdAt: 1 }], storySeen: true, muted: true };
  const b = { delivered: { l1: true, l2: true }, grade: { l1: "perfect", l2: "rough" }, orbs: { l1: 5 }, orbExtra: 1, mine: [{ id: "m2", createdAt: 2 }, { id: "m1", createdAt: 1, share: { id: "x" } }], howtoSeen: true };
  const m = mergeStates(a, b);
  assert.deepEqual(m.grade, { l1: "perfect", l2: "rough" }); assert.equal(m.orbs.l1, 5); assert.equal(m.orbExtra, 2);
  assert.deepEqual(m.mine.map((x) => x.id), ["m2", "m1"]); assert.deepEqual(m.mine[1].share, { id: "x" });
  assert.ok(m.storySeen && m.howtoSeen && m.muted);
  assert.equal(mergeStates(a, null), a);
});

// 하늘길 점프: 해적과 구멍 앞에서 알맞게 누르면 넘고, 공중에서 걷는 자세가 풀리지 않는다
function jumpAt(kind, d, seed) {
  const F = createFlight(letter(2, true, "jp" + seed), true, false); F.viewW = 800;
  const wk = F.lv.walk, o = wk.obs.find((x) => x.kind === kind); if (!o) return null;
  wk.obs = [o]; F.lv.rain.length = 0; F.windT = 1e9; for (const k of ["events", "clouds", "bolts", "vortices", "items"]) F.lv[k].length = 0;
  let t = 0, pressed = false, minWalk = 1;
  while (!F.finished && t < 120 && F.x < o.x + 200) {
    if (F.mode === "fly" && !pressed && F.walkK > 0.8 && o.x - F.x <= d) { F.moves.push(1); pressed = true; }
    stepFlight(F, 1 / 60, {}); t += 1 / 60;
    if (F.jumpT > 0.05) minWalk = Math.min(minWalk, F.walkK);
  }
  return { hits: F.totalHits, minWalk };
}
test("하늘길: 알맞은 때(해적 앞 100~280px, 구멍 앞 100~180px)에 누르면 해적과 구멍을 모두 넘는다", () => {
  for (const [kind, ds] of [["pirate", [100, 200, 280]], ["gap", [100, 140, 180]]]) for (const d of ds) for (let s = 0; s < 8; s++) {
    const r = jumpAt(kind, d, s); if (!r) continue;
    assert.equal(r.hits, 0, `${kind} ${d}px 시드${s}에서 부딪혔다`);
  }
});
test("하늘길: 뛰지 않으면 해적과 구멍에 부딪힌다", () => {
  for (const kind of ["pirate", "gap"]) { const r = jumpAt(kind, -9999, 1); if (r) assert.ok(r.hits > 0, kind); }
});
test("하늘길: 공중에 있는 동안에도 걷는 자세(walkK)가 유지된다", () => {
  const r = jumpAt("pirate", 140, 2); assert.ok(r.minWalk > 0.8, `minWalk ${r.minWalk}`);
});

test("하늘길: 해적에게 그냥 걸어 들어가면 부딪힌다", () => {
  const F = createFlight(letter(2, true, "bk0"), true, false); F.viewW = 800;
  const wk = F.lv.walk, o = wk.obs.find((x) => x.kind === "pirate"); wk.obs = [o];
  F.lv.rain.length = 0; F.windT = 1e9; for (const k of ["events", "clouds", "bolts", "vortices", "items"]) F.lv[k].length = 0;
  let t = 0; while (F.x < o.x && t < 120) { stepFlight(F, 1 / 60, {}); t += 1 / 60; }
  assert.ok(F.totalHits > 0 && F.wy < o.h);
});

test("비바람 구간: 앞·안·뒤에 장애물이 없고, 천천히 나아간다", () => {
  for (let sd = 0; sd < 40; sd++) {
    const lv = buildLevel(letter(1 + (sd % 3), sd % 2 === 0), `st${sd}`);
    const xs = [...lv.events.map((e) => e.x), ...lv.bolts.map((b) => b.x), ...lv.vortices.map((v) => v.x), ...lv.clouds.map((c) => c.x)];
    for (const [a, b] of lv.rain) for (const x of xs) assert.ok(!(x > a * LEN - 150 && x < b * LEN + 650), `코스 ${sd}: 비바람 구간(${a.toFixed(2)}~${b.toFixed(2)}) 근처에 장애물 ${Math.round(x)}`);
    assert.ok(lv.rain.length >= 1 && lv.rain.every(([a, b]) => b > a && b <= 0.84));
  }
});
test("비바람 구간: 연타하면 버티고, 연타하지 않으면 날개에 힘이 빠져 떨어진다(하트가 줄어든다)", () => {
  const run = (tapping) => {
    const F = createFlight(letter(1, false, "storm1"), true, false); F.viewW = 800; let t = 0, tap = 0, minY = 1e9, maxPush = 0, inStormEvents = 0, hits0 = null, stormHits = 0;
    const [a, b] = F.lv.rain[0];
    while (!F.finished && t < 200 && F.x < b * LEN + 100) {
      if (F.mode === "fly" && F.brace.on && tapping) { tap += 4 / 60; while (tap >= 1) { F.braceTaps++; tap--; } }
      if (hits0 === null && F.x > a * LEN) hits0 = F.totalHits;
      stepFlight(F, 1 / 60, {}); t += 1 / 60;
      if (hits0 !== null) stormHits = F.totalHits - hits0;
      if (F.x > a * LEN && F.x < b * LEN) { minY = Math.min(minY, F.y); maxPush = Math.max(maxPush, F.windPush); for (const e of F.lv.events) if (e.state === "tele" || e.state === "act") inStormEvents++; }
    }
    return { hits: stormHits, minY, maxPush, inStormEvents };
  };
  const good = run(true), idle = run(false);
  assert.equal(good.inStormEvents, 0); assert.ok(good.maxPush > 0.5, "비바람 구간에서 느려진다");
  assert.ok(good.minY > 200, `연타하면 줄 높이를 유지한다(${good.minY})`);
  assert.ok(idle.minY < 150 && idle.hits > good.hits, `연타하지 않으면 아래로 떨어진다(${idle.minY}, 하트 ${idle.hits})`);
});

test("비바람 버티기: 동그라미(게이지)를 가득 채우면 비바람이 걷히고 버티기가 끝난다", () => {
  const F = createFlight(letter(1, false, "storm1"), true, false); F.viewW = 800; let t = 0, tap = 0, done = false;
  const [a, b] = F.lv.rain[0];
  while (!F.finished && t < 200 && F.x < b * LEN) {
    if (F.mode === "fly" && F.brace.on) { tap += 8 / 60; while (tap >= 1) { F.braceTaps++; tap--; } }
    stepFlight(F, 1 / 60, {}); t += 1 / 60;
    if (F.stormDone[0]) { done = true; assert.equal(F.brace.on, false); assert.ok(F.x < b * LEN); break; }
  }
  assert.ok(done && F.x > a * LEN, "게이지를 채워도 버티기가 끝나지 않았다");
});
