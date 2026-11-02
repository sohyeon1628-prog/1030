import React, { useState } from "react";
import { changeNick } from "../auth.js";

// 소셜 로그인으로 처음 들어온 사람이 닉네임을 직접 정한다(구글·카카오 같은 외부 이름은 쓰지 않는다).
export default function ChooseNick({ user, onDone }) {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const ok = nick.trim().length >= 2;
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr("");
    try { onDone((await changeNick(nick.trim())).user); }
    catch (e) { setErr(e.message === "nick_taken" ? "이미 쓰고 있는 닉네임이에요." : e.message === "bad_nick" ? "닉네임은 2~12자로 써 주세요." : "잠시 뒤에 다시 해 주세요."); setBusy(false); }
  };
  return (
    <main className="screen center">
      <div className="form nick">
        <h2>닉네임을 정해 주세요</h2>
        <p className="sub">게임에서 해무가 부르는 이름이고, 편지를 보낼 때 보내는 사람으로 쓰여요. 나중에 '내 계정'에서 바꿀 수 있어요.</p>
        <input value={nick} maxLength={12} placeholder="닉네임 (예: 소라)" autoFocus autoComplete="nickname" onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
        {err && <p className="sub warn" role="alert">{err}</p>}
        <div className="row"><button className="btn" disabled={!ok || busy} onClick={go}>{busy ? "잠시만요…" : "이 닉네임으로 시작"}</button></div>
        <p className="acct-help">로그인한 계정: {user.email || "소셜 계정"}</p>
      </div>
    </main>
  );
}
