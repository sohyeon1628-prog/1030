// 비행 화면의 터치 판정.
//   - 위·아래로 SWIPE_PX 넘게 쓸면: 그 방향으로 한 줄
//   - 가볍게 누르면: 화면 위쪽 절반은 위로, 아래쪽 절반은 아래로(반응 없는 영역이 없다)
// 비바람 버티기는 화면 터치와 따로, 왼쪽 아래의 큰 버튼으로 한다(버튼을 누르는 터치는 이 판정에 오지 않는다).
export const SWIPE_PX = 40;
// dy: 누른 곳에서 뗀 곳까지의 세로 이동(화면 아래가 +), frac: 뗀 곳의 화면 세로 위치(0 맨 위 ~ 1 맨 아래)
// 반환: { type: "move", dir: +1(위)|-1(아래) }
export function touchAction(dy, frac) {
  if (Math.abs(dy) > SWIPE_PX) return { type: "move", dir: dy < 0 ? 1 : -1 };
  return { type: "move", dir: frac < 0.5 ? 1 : -1 };
}
