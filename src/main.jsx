import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Splash from "./components/Splash.jsx";
import "./styles.css";

const ReceiveScreen = lazy(() => import("./components/ReceiveScreen.jsx"));
const PrivacyScreen = lazy(() => import("./components/PrivacyScreen.jsx"));

// 게임에 들어오면 누구에게나, 접속할 때마다 짧은 인트로(제목과 날아가는 편지)를 먼저 보여 준다.
// 인트로가 나오는 동안 무거운 3D 화면을 미리 내려받아 두어, 끝나면 기다리지 않고 바로 이어진다.
function Game() {
  const [phase, setPhase] = useState("splash");                 // splash(인트로) → fade(인트로가 사라지며 게임이 아래에 뜸) → app
  useEffect(() => { import("./components/World3D.jsx"); import("./components/Intro3D.jsx"); }, []);
  return <>{phase !== "splash" && <App />}{phase !== "app" && <Splash onLeave={() => setPhase("fade")} onDone={() => setPhase("app")} />}</>;
}

// 링크(/l/:id)로 들어오면 받는 사람 화면, /privacy는 개인정보 안내, 그 밖에는 게임
const m = location.pathname.match(/^\/l\/([A-Za-z0-9_-]{12})\/?$/);
const page = m ? <ReceiveScreen id={m[1]} /> : /^\/privacy\/?$/.test(location.pathname) ? <PrivacyScreen /> : <Game />;
createRoot(document.getElementById("root")).render(<Suspense fallback={<div className="boot" aria-busy="true">불러오는 중…</div>}>{page}</Suspense>);
