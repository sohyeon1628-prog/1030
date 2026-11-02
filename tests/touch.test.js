import { test } from "node:test";
import assert from "node:assert/strict";
import { touchAction } from "../src/touchControl.js";

// 비행 터치 조작: 화면 위쪽 절반은 위로, 아래쪽 절반은 아래로, 쓸기는 방향대로
test("위쪽 절반을 누르면 위로, 아래쪽 절반을 누르면 아래로(반응 없는 영역이 없다)", () => {
  for (const f of [0, 0.2, 0.49]) assert.deepEqual(touchAction(0, f), { type: "move", dir: 1 });
  for (const f of [0.5, 0.7, 1]) assert.deepEqual(touchAction(0, f), { type: "move", dir: -1 });
});
test("쓸어 넘기면 쓴 방향으로 한 줄(위치와 상관없이)", () => {
  assert.deepEqual(touchAction(-80, 0.9), { type: "move", dir: 1 });
  assert.deepEqual(touchAction(80, 0.1), { type: "move", dir: -1 });
  assert.deepEqual(touchAction(41, 0.1), { type: "move", dir: -1 });
  assert.deepEqual(touchAction(40, 0.1), { type: "move", dir: 1 });               // 40px 이하는 누르기
});
