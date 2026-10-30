import React, { useEffect, useRef, useState } from "react";

// 닉네임 정하기: 로그인이 생기기 전까지 이 기기에서 쓰는 이름이다. 이름은 편지의 보내는 사람과 해무가 부르는 이름이 된다.
export default function NicknameScreen({ initial = "", onSubmit, onBack, onReset }) {
  const [name, setName] = useState(initial);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const ok = name.trim().length > 0;
  const go = () => { if (ok) onSubmit(name.trim()); };
  return (
    <main className="screen center">
      <div className="form nick">
        <h2>나루 우체국</h2>
        <p className="sub">우체국에서 불릴 닉네임을 정해 주세요. 편지를 보낼 때 이름으로 쓰여요. 나중에는 로그인으로 바뀔 예정이에요.</p>
        <input ref={ref} value={name} maxLength={12} placeholder="닉네임 (예: 소라)" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
        <div className="row">
          <button className="btn" disabled={!ok} onClick={go}>{onBack ? "바꾸기" : "시작하기"}</button>
          {onBack && <button className="btn ghost" onClick={onBack}>돌아가기</button>}
        </div>
        {onReset && <button className="linkbtn" onClick={onReset}>저장된 진행 모두 지우고 처음부터</button>}
      </div>
    </main>
  );
}
