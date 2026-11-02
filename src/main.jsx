import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ReceiveScreen from "./components/ReceiveScreen.jsx";
import "./styles.css";

// 테스트용 초기화: 주소 끝에 ?reset 을 붙여 열면 저장된 진행(이야기·편지함·녹음)을 지우고 처음 상태로 시작한다.
if (new URLSearchParams(location.search).has("reset")) {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("last-postal-wing") || k.startsWith("wing-voice:") || k === "naru-token").forEach((k) => localStorage.removeItem(k));
  } catch { /* 저장소 사용 불가 */ }
  history.replaceState(null, "", location.pathname);
}

// 링크(/l/:id)로 들어오면 받는 사람 화면, 그 밖에는 게임
const m = location.pathname.match(/^\/l\/([A-Za-z0-9_-]{12})\/?$/);
createRoot(document.getElementById("root")).render(m ? <ReceiveScreen id={m[1]} /> : <App />);
