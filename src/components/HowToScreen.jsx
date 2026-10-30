import React, { useState } from "react";
import { HOWTO } from "../data/story.js";

// 처음 온 사람을 위한 안내. 첫 방문 때 자동으로 뜨고, 지도의 "도움말"로 언제든 다시 볼 수 있다.
export default function HowToScreen({ onClose }) {
  const [i, setI] = useState(0);
  const step = HOWTO[i];
  const last = i === HOWTO.length - 1;
  return (
    <div className="overlay howto" role="dialog" aria-modal="true" aria-label="게임 방법">
      <div className="panel howto-card">
        <div className="howto-icon" aria-hidden="true">{step.icon}</div>
        <h2 key={i} className="fade">{step.title}</h2>
        <p key={`p${i}`} className="fade">{step.body}</p>
        <div className="dots">{HOWTO.map((_, k) => <span key={k} className={k <= i ? "on" : ""} />)}</div>
        <div className="row">
          {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>이전</button>}
          {last
            ? <button className="btn" onClick={onClose}>시작하기</button>
            : <button className="btn" onClick={() => setI(i + 1)}>다음</button>}
          {!last && <button className="btn ghost" onClick={onClose}>건너뛰기</button>}
        </div>
      </div>
    </div>
  );
}
