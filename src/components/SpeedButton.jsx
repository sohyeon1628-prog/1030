import React from "react";
import { speedLabel } from "../playSpeed.js";

// 영상 위쪽 가운데의 속도 버튼. 누를 때마다 느리게 → 보통 → 빠르게 → 아주 빠르게로 바뀐다.
export default function SpeedButton({ speed, onClick }) {
  return <button className="pill intro-speed" onPointerDown={(e) => e.stopPropagation()} onClick={onClick} aria-label={`재생 속도: ${speedLabel(speed)}`} title="재생 속도">⏩ {speedLabel(speed)}</button>;
}
