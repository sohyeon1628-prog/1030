// 비행 화면의 터치 판정(화면 위치와 움직임으로 무엇을 할지 정한다).
//   - 위·아래로 SWIPE_PX 넘게 쓸면: 그 방향으로 한 줄
//   - 가볍게 누르면: 비바람 버티기 중에는 버티기 한 번, 아니면 화면 위쪽 40%는 위로, 아래쪽 40%는 아래로, 가운데 20%는 아무 일도 없다
export const SWIPE_PX = 40, ZONE = 0.4;
// dy: 누른 곳에서 뗀 곳까지의 세로 이동(화면 아래가 +), frac: 뗀 곳의 화면 세로 위치(0 맨 위 ~ 1 맨 아래), bracing: 버티기 중인가
// 반환: { type: "move", dir: +1(위)|-1(아래) } | { type: "brace" } | { type: "none" }
export function touchAction(dy, frac, bracing) {
  if (Math.abs(dy) > SWIPE_PX) return { type: "move", dir: dy < 0 ? 1 : -1 };
  if (bracing) return { type: "brace" };
  if (frac < ZONE) return { type: "move", dir: 1 };
  if (frac > 1 - ZONE) return { type: "move", dir: -1 };
  return { type: "none" };
}
