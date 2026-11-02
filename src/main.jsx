import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
const ReceiveScreen = lazy(() => import("./components/ReceiveScreen.jsx"));
const PrivacyScreen = lazy(() => import("./components/PrivacyScreen.jsx"));
import "./styles.css";

// 링크(/l/:id)로 들어오면 받는 사람 화면, 그 밖에는 게임
const m = location.pathname.match(/^\/l\/([A-Za-z0-9_-]{12})\/?$/);
createRoot(document.getElementById("root")).render(<Suspense fallback={<div className="boot" aria-busy="true">불러오는 중…</div>}>{m ? <ReceiveScreen id={m[1]} /> : /^\/privacy\/?$/.test(location.pathname) ? <PrivacyScreen /> : <App />}</Suspense>);
