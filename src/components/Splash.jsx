import React, { useEffect, useState } from "react";

// 맨 처음 화면: 짧은 인트로(제목과 날아가는 편지). 2.6초 뒤 자동으로, 누르면 바로 로그인 화면으로 넘어간다.
export default function Splash({ onLeave, onDone }) {
  const [leaving, setLeaving] = useState(false);
  const go = () => { if (leaving) return; setLeaving(true); onLeave?.(); setTimeout(onDone, 450); };   // 사라지기 시작할 때 아래에 게임을 먼저 띄워 자연스럽게 이어 준다
  useEffect(() => { const t = setTimeout(go, 2600); return () => clearTimeout(t); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`splash ${leaving ? "leave" : ""}`} onPointerDown={go} role="presentation">
      <div className="splash-sky" aria-hidden="true">
        <i className="sp-cloud c1" /><i className="sp-cloud c2" /><i className="sp-cloud c3" />
        <svg className="sp-letter" width="64" height="44" viewBox="0 0 64 44"><rect x="2" y="4" width="60" height="38" rx="5" fill="#fff8e6" stroke="#e8553a" strokeWidth="3" /><path d="M4 8l28 20L60 8" fill="none" stroke="#e8553a" strokeWidth="3" strokeLinejoin="round" /><circle cx="32" cy="27" r="5" fill="#d9452c" /></svg>
        <div className="sp-wave" />
      </div>
      <div className="splash-title">
        <h1>나루 우체국</h1>
        <p>편지가 오가는 동안에만 열리는 바람길</p>
      </div>
      <span className="splash-hint">화면을 누르면 시작해요</span>
    </div>
  );
}
