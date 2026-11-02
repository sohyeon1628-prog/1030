import React, { useState } from "react";
import { resetPassword } from "../auth.js";

// 이메일로 받은 링크(?pwreset=토큰)로 들어왔을 때: 새 비밀번호를 정한다. 끝나면 모든 기기에서 로그아웃되고 새 비밀번호로 로그인한다.
export default function ResetScreen({ token, onDone }) {
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false);
  const ok = pw.length >= 6 && pw === pw2;
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr("");
    try { await resetPassword(token, pw); setDone(true); }
    catch (e) { setErr(e.message === "bad_token" ? "링크가 만료됐거나 이미 썼어요. 로그인 화면에서 다시 요청해 주세요." : e.message === "bad_password" ? "비밀번호는 6자 이상이어야 해요." : "잠시 뒤에 다시 해 주세요."); }
    setBusy(false);
  };
  return (
    <main className="screen center">
      <div className="form nick">
        <h2>비밀번호 다시 정하기</h2>
        {done ? (
          <>
            <p className="sub ok" role="status">새 비밀번호로 바꿨어요. 다른 기기에서는 로그아웃되었어요.</p>
            <div className="row"><button className="btn" onClick={onDone}>로그인하러 가기</button></div>
          </>
        ) : (
          <>
            <input type="password" value={pw} maxLength={64} placeholder="새 비밀번호 (6자 이상)" autoComplete="new-password" autoFocus onChange={(e) => setPw(e.target.value)} />
            <input type="password" value={pw2} maxLength={64} placeholder="새 비밀번호 한 번 더" autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
            {pw2 && pw !== pw2 && <p className="sub warn">두 비밀번호가 달라요.</p>}
            {err && <p className="sub warn" role="alert">{err}</p>}
            <div className="row"><button className="btn" disabled={!ok || busy} onClick={go}>{busy ? "잠시만요…" : "비밀번호 바꾸기"}</button></div>
          </>
        )}
      </div>
    </main>
  );
}
