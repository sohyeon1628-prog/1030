import React, { useState } from "react";
import { changeNick, changeEmail, changePassword, deleteAccount } from "../auth.js";

const ERR = {
  bad_nick: "닉네임은 2~12자로 써 주세요.", nick_taken: "이미 쓰고 있는 닉네임이에요.", bad_email: "이메일 형식이 맞지 않아요.", bad_password: "비밀번호는 6자 이상이어야 해요.",
  wrong_login: "비밀번호가 맞지 않아요.", too_many: "잠시 뒤에 다시 해 주세요.", mail_failed: "인증 메일을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.", network: "서버에 닿지 못했어요.",
};
const SOCIAL = { google: "Google" };

// 내 계정: 닉네임 바꾸기, 이메일(비밀번호 찾기용) 등록·인증, 비밀번호 바꾸기, 로그아웃, 계정 삭제
export default function AccountScreen({ user, sync, onUser, onBack, onLogout, onDeleted }) {
  const [nick, setNick] = useState(user.nick);
  const [email, setEmail] = useState(user.email || "");
  const [curPw, setCurPw] = useState("");       // 이메일 변경·계정 삭제 확인용 현재 비밀번호
  const [pw, setPw] = useState({ cur: "", next: "", again: "" });
  const [del, setDel] = useState("");
  const [msg, setMsg] = useState({});           // 구역별 안내: { nick, email, pw, del } = [종류, 글]
  const [busy, setBusy] = useState("");
  const say = (k, kind, text) => setMsg((m) => ({ ...m, [k]: [kind, text] }));
  const run = async (k, fn) => { setBusy(k); try { await fn(); } catch (e) { say(k, "err", ERR[e.message] || "잠시 뒤에 다시 해 주세요."); } setBusy(""); };

  const saveNick = () => run("nick", async () => { const r = await changeNick(nick.trim()); onUser(r.user); say("nick", "ok", "닉네임을 바꿨어요."); });
  const saveEmail = (clear = false) => run("email", async () => {
    const r = await changeEmail(clear ? "" : email.trim(), curPw); onUser(r.user); setCurPw("");
    if (clear) { setEmail(""); say("email", "ok", "이메일을 지웠어요."); }
    else say("email", "ok", "인증 메일을 보냈어요. 메일의 링크를 누르면 비밀번호 찾기에 쓸 수 있어요.");
  });
  const savePw = () => run("pw", async () => {
    if (pw.next !== pw.again) return say("pw", "err", "새 비밀번호가 서로 달라요.");
    await changePassword(pw.cur, pw.next); onUser({ ...user, hasPassword: true }); setPw({ cur: "", next: "", again: "" }); say("pw", "ok", "비밀번호를 바꿨어요. 다른 기기는 로그아웃돼요.");
  });
  const remove = () => run("del", async () => {
    if (!window.confirm("정말 계정을 지울까요? 서버에 보관된 진행과 편지함이 모두 사라지고 되돌릴 수 없어요.")) return;
    await deleteAccount(user.hasPassword ? { password: curPw } : { confirm: del.trim() }); onDeleted();
  });
  const emailChanged = email.trim() !== (user.email || "");

  return (
    <main className="screen">
      <div className="form acct">
        <h2>내 계정</h2>
        <p className="sub">{sync === "offline" ? "서버에 닿지 못했어요. 이 기기에는 저장되어 있어요." : sync === "saving" ? "진행을 서버에 보관하는 중…" : "진행과 편지함이 이 계정에 보관되어 있어요."}{user.providers.length > 0 && ` · 연결된 로그인: ${user.providers.map((p) => SOCIAL[p] || p).join(", ")}`}</p>

        <section className="acct-card">
          <h3>닉네임</h3>
          <div className="acct-row"><input value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} aria-label="닉네임" /><button className="btn ghost" disabled={busy === "nick" || nick.trim().length < 2 || nick.trim() === user.nick} onClick={saveNick}>바꾸기</button></div>
          {msg.nick && <p className={`acct-msg ${msg.nick[0]}`} role="status">{msg.nick[1]}</p>}
        </section>

        <section className="acct-card">
          <h3>이메일 <small>{user.email ? (user.emailVerified ? "인증됨" : "인증 대기") : "없음"}</small></h3>
          <p className="acct-help">비밀번호를 잊었을 때 재설정 링크를 받는 곳이에요. 인증한 이메일만 쓸 수 있어요.</p>
          <input type="email" value={email} maxLength={120} placeholder="이메일" onChange={(e) => setEmail(e.target.value)} aria-label="이메일" />
          {user.hasPassword && emailChanged && <input type="password" value={curPw} maxLength={64} placeholder="현재 비밀번호" autoComplete="current-password" onChange={(e) => setCurPw(e.target.value)} />}
          <div className="acct-row">
            <button className="btn ghost" disabled={busy === "email" || !email.trim() || (!emailChanged && user.emailVerified) || (user.hasPassword && emailChanged && !curPw)} onClick={() => saveEmail(false)}>{emailChanged || !user.email ? "저장하고 인증 메일 보내기" : "인증 메일 다시 보내기"}</button>
            {user.email && <button className="btn ghost" disabled={busy === "email" || (user.hasPassword && !curPw)} onClick={() => saveEmail(true)}>이메일 지우기</button>}
          </div>
          {user.email && user.hasPassword && !emailChanged && <p className="acct-help">지우거나 다시 보내려면 위에 현재 비밀번호가 필요해요.</p>}
          {user.email && user.hasPassword && !emailChanged && <input type="password" value={curPw} maxLength={64} placeholder="현재 비밀번호" autoComplete="current-password" onChange={(e) => setCurPw(e.target.value)} />}
          {msg.email && <p className={`acct-msg ${msg.email[0]}`} role="status">{msg.email[1]}</p>}
        </section>

        <section className="acct-card">
          <h3>비밀번호 {!user.hasPassword && <small>아직 없음(소셜 로그인 전용)</small>}</h3>
          {user.hasPassword && <input type="password" value={pw.cur} maxLength={64} placeholder="현재 비밀번호" autoComplete="current-password" onChange={(e) => setPw({ ...pw, cur: e.target.value })} />}
          <input type="password" value={pw.next} maxLength={64} placeholder="새 비밀번호 (6자 이상)" autoComplete="new-password" onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <input type="password" value={pw.again} maxLength={64} placeholder="새 비밀번호 한 번 더" autoComplete="new-password" onChange={(e) => setPw({ ...pw, again: e.target.value })} />
          <div className="acct-row"><button className="btn ghost" disabled={busy === "pw" || pw.next.length < 6 || (user.hasPassword && !pw.cur)} onClick={savePw}>{user.hasPassword ? "비밀번호 바꾸기" : "비밀번호 만들기"}</button></div>
          {msg.pw && <p className={`acct-msg ${msg.pw[0]}`} role="status">{msg.pw[1]}</p>}
        </section>

        <section className="acct-card danger">
          <h3>계정 삭제</h3>
          <p className="acct-help">서버에 보관된 진행과 편지함이 모두 사라져요. 이미 보낸 링크 편지는 편지함에서 먼저 거두어야 해요. 이 기기의 기록도 지워져요.</p>
          {user.hasPassword
            ? <input type="password" value={curPw} maxLength={64} placeholder="현재 비밀번호" autoComplete="current-password" onChange={(e) => setCurPw(e.target.value)} />
            : <input value={del} maxLength={12} placeholder={`확인을 위해 닉네임(${user.nick})을 입력`} onChange={(e) => setDel(e.target.value)} />}
          <div className="acct-row"><button className="btn danger" disabled={busy === "del" || (user.hasPassword ? !curPw : del.trim() !== user.nick)} onClick={remove}>계정 지우기</button></div>
          {msg.del && <p className={`acct-msg ${msg.del[0]}`} role="status">{msg.del[1]}</p>}
        </section>

        <div className="row"><button className="btn ghost" onClick={onLogout}>로그아웃</button><button className="btn ghost" onClick={onBack}>돌아가기</button></div>
      </div>
    </main>
  );
}
