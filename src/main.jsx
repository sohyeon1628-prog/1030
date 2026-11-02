import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { getToken } from "./auth.js";
import "./styles.css";

const ReceiveScreen = lazy(() => import("./components/ReceiveScreen.jsx"));
const PrivacyScreen = lazy(() => import("./components/PrivacyScreen.jsx"));
const SplashScene = lazy(() => import("./components/SplashScene.jsx"));

// 이미 들어온 적이 있는지(로그인했거나 닉네임이 있는지): 첫 화면 버튼이 "시작하기"가 될지 "로그인하기"가 될지 정한다
const knownUser = () => { try { return !!getToken() || !!JSON.parse(localStorage.getItem("last-postal-wing:v1") || "{}").nickname; } catch { return false; } };

// 게임에 들어오면 누구에게나, 접속할 때마다 3D 첫 화면(해무와 내가 마음의 섬 위를 날아다닌다)을 먼저 보여 준다.
// 첫 화면이 나오는 동안 무거운 3D 화면을 미리 내려받아 두어, 버튼을 누르면 기다리지 않고 바로 이어진다.
// 버튼을 누르면 아래에 게임(로그인 → 닉네임 → 오프닝)이 뜨고 첫 화면은 서서히 사라진다.
function Game() {
  const [phase, setPhase] = useState("splash");                 // splash(첫 화면) → fade(첫 화면이 사라지며 게임이 아래에 뜸) → app
  const [label] = useState(() => (knownUser() ? "시작하기" : "로그인하기"));
  useEffect(() => { import("./components/World3D.jsx"); import("./components/Intro3D.jsx"); }, []);
  return (
    <>
      {phase !== "splash" && <App />}
      {phase !== "app" && (
        <Suspense fallback={<div className="splash3d"><div className="splash3d-veil" /><header className="splash3d-title"><h1>나루 우체국</h1></header></div>}>
          <SplashScene label={label} onLeave={() => setPhase("fade")} onDone={() => setPhase("app")} />
        </Suspense>
      )}
    </>
  );
}

// 링크(/l/:id)로 들어오면 받는 사람 화면, /privacy는 개인정보 안내, 그 밖에는 게임
const m = location.pathname.match(/^\/l\/([A-Za-z0-9_-]{12})\/?$/);
const page = m ? <ReceiveScreen id={m[1]} /> : /^\/privacy\/?$/.test(location.pathname) ? <PrivacyScreen /> : <Game />;
createRoot(document.getElementById("root")).render(<Suspense fallback={<div className="boot" aria-busy="true">불러오는 중…</div>}>{page}</Suspense>);
