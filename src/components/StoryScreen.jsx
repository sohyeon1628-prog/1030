import React, { useState } from "react";

// 한 줄씩 넘겨 읽는 서사 화면 (프롤로그/에필로그)
export default function StoryScreen({ lines, doneLabel, onDone }) {
  const [i, setI] = useState(0);
  const last = i === lines.length - 1;
  return (
    <main className="screen center" onClick={() => !last && setI(i + 1)}>
      <article className="paper story">
        <p key={i} className="fade">{lines[i]}</p>
      </article>
      <div className="dots">{lines.map((_, k) => <span key={k} className={k <= i ? "on" : ""} />)}</div>
      {last
        ? <button className="btn" onClick={onDone}>{doneLabel}</button>
        : <p className="sub">화면을 눌러 계속</p>}
    </main>
  );
}
