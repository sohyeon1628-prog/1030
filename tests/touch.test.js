import { test } from "node:test";
import assert from "node:assert/strict";
import { touchAction } from "../src/touchControl.js";

// 비행 터치 조작: 위쪽 40% 위로, 아래쪽 40% 아래로, 가운데 20% 반응 없음, 쓸기는 방향대로, 버티기 중에는 누르면 버티기
test("위쪽 40%를 누르면 위로, 아래쪽 40%를 누르면 아래로", () => {
  assert.deepEqual(touchAction(0, 0.05, false), { type: "move", dir: 1 });
  assert.deepEqual(touchAction(0, 0.39, false), { type: "move", dir: 1 });
  assert.deepEqual(touchAction(0, 0.61, false), { type: "move", dir: -1 });
  assert.deepEqual(touchAction(0, 0.95, false), { type: "move", dir: -1 });
});
test("가운데 20%는 아무 일도 없다", () => {
  for (const f of [0.4, 0.5, 0.6]) assert.deepEqual(touchAction(0, f, false), { type: "none" });
});
test("쓸어 넘기면 쓴 방향으로 한 줄(위치와 상관없이)", () => {
  assert.deepEqual(touchAction(-80, 0.9, false), { type: "move", dir: 1 });
  assert.deepEqual(touchAction(80, 0.1, false), { type: "move", dir: -1 });
  assert.deepEqual(touchAction(41, 0.5, false), { type: "move", dir: -1 });
  assert.deepEqual(touchAction(40, 0.5, false), { type: "none" });               // 40px 이하는 누르기
});
test("비바람 버티기 중에는 가볍게 누르는 것이 버티기, 쓸기는 줄 옮기기", () => {
  for (const f of [0.1, 0.5, 0.9]) assert.deepEqual(touchAction(3, f, true), { type: "brace" });
  assert.deepEqual(touchAction(-70, 0.5, true), { type: "move", dir: 1 });
});
