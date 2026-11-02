import React, { useEffect, useState } from "react";
import { changeNick, changeEmail, changePassword, deleteAccount, getProviders, linkSocial, unlinkSocial } from "../auth.js";

const ERR = {
  bad_nick: "닉네임은 2~12자로 써 주세요.", nick_taken: "이미 쓰고 있는 닉네임이에요.", bad_email: "이메일 형식이 맞지 않아요.", bad_password: "비밀번호는 6자 이상이어야 해요.",
  need_password: "비밀번호를 먼저 만들어 주세요. 로그인할 방법이 없어지면 안 돼요.", already_linked: "이미 연결되어 있어요.", wrong_login: "비밀번호가 맞지 않아요.", too_many: "잠시 뒤에 다시 해 주세요.", mail_failed: "인증 메일을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.", network: "서버에 닿지 못했어요.",
};
const SOCIAL = { google: "Google" };

const Field = ({ label, ...p }) => <label className="auth-field"><input placeholder=" " {...p} /><span>{label}</span></label>;

// 내 계정: 로그인 화면과 같은 단순한 흰 카드. 닉네임, 이메일(비밀번호 찾기용), 비밀번호, 로그아웃, 계정 삭제를 구역으로 나눠 보여 준다.
export default function AccountScreen({ user, sync, onUser, onBack, onLogout, onDeleted }) {
  const [open, setOpen] = useState("");         // 펼친 구역: nick | email | pw | del
  const [nick, setNick] = useState(user.nick);
  const [email, setEmail] = useState(user.email || "");
  const [curPw, setCurPw] = useState("");       // 이메일 변경·계정 삭제 확인용 현재 비밀번호
  const [pw, setPw] = useState({ cur: "", next: "", again: "" });
  const [del, setDel] = useState("");
  const [msg, setMsg] = useState({});           // 구역별 안내: [종류, 글]
  const [busy, setBusy] = useState("");
  const say = (k, kind, text) => setMsg((m) => ({ ...m, [k]: [kind, text] }));
  const run = async (k, fn) => { setBusy(k); try { await fn(); } catch (e) { say(k, "err", ERR[e.message] || "잠시 뒤에 다시 해 주세요."); } setBusy(""); };
  const [avail, setAvail] = useState([]);   // 서버에서 켜 둔 소셜 로그인
  useEffect(() => { getProviders().then((r) => r && setAvail(r.providers)); }, []);
  const toggle = (k) => setOpen((o) => (o === k ? "" : k));

  const saveNick = () => run("nick", async () => { const r = await changeNick(nick.trim()); onUser(r.user); say("nick", "ok", "닉네임을 바꿨어요."); setOpen(""); });
  const saveEmail = (clear = false) => run("email", async () => {
    const r = await changeEmail(clear ? "" : email.trim(), curPw); onUser(r.user); setCurPw("");
    if (clear) { setEmail(""); say("email", "ok", "이메일을 지웠어요."); }
    else say("email", "ok", "인증 메일을 보냈어요. 메일의 링크를 누르면 비밀번호 찾기에 쓸 수 있어요.");
    setOpen("");
  });
  const savePw = () => run("pw", async () => {
    if (pw.next !== pw.again) return say("pw", "err", "새 비밀번호가 서로 달라요.");
    await changePassword(pw.cur, pw.next); onUser({ ...user, hasPassword: true }); setPw({ cur: "", next: "", again: "" }); say("pw", "ok", "비밀번호를 바꿨어요. 다른 기기는 로그아웃돼요."); setOpen("");
  });
  const link = (p) => run("social", async () => { const r = await linkSocial(p); window.location.href = r.url; });         // 구글 화면으로 갔다가 돌아오면 연결이 끝난다
  const unlink = (p) => run("social", async () => {
    if (!window.confirm(`${SOCIAL[p] || p} 로그인 연결을 해제할까요? 닉네임과 비밀번호로는 계속 들어올 수 있어요.`)) return;
    const r = await unlinkSocial(p); onUser(r.user); say("social", "ok", "연결을 해제했어요.");
  });
  const remove = () => run("del", async () => {
    if (!window.confirm("정말 계정을 지울까요? 서버에 보관된 진행과 편지함이 모두 사라지고 되돌릴 수 없어요.")) return;
    await deleteAccount(user.hasPassword ? { password: curPw } : { confirm: del.trim() }); onDeleted();
  });
  const emailChanged = email.trim() !== (user.email || "");
  const emailState = user.email ? (user.emailVerified ? "인증됨" : "인증 대기 중") : "등록 안 됨";

  const row = (k, title, value, children) => (
    <section className="acct-row2">
      <button className="acct-head" onClick={() => toggle(k)} aria-expanded={open === k}>
        <span className="acct-title">{title}</span><span className="acct-value">{value}</span><span className="acct-chev" aria-hidden="true">{open === k ? "˄" : "˅"}</span>
      </button>
      {msg[k] && <p className={msg[k][0] === "ok" ? "auth-ok" : "auth-err"} role="status">{msg[k][1]}</p>}
      {open === k && <div className="acct-body">{children}</div>}
    </section>
  );

  return (
    <main className="screen center">
      <div className="auth-card acct2">
        <div className="auth-brand">나루 우체국</div>
        <h1>내 계정</h1>
        <p className="auth-sub">{sync === "offline" ? "서버에 닿지 못했어요. 이 기기에는 저장되어 있어요." : sync === "saving" ? "진행을 서버에 보관하는 중…" : "진행과 편지함이 이 계정에 보관되어 있어요."}{user.providers.length > 0 && ` · 연결된 로그인: ${user.providers.map((p) => SOCIAL[p] || p).join(", ")}`}</p>

        {row("nick", "닉네임", user.nick, <>
          <Field label="닉네임" value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} />
          <div className="auth-actions end"><button className="auth-btn" disabled={busy === "nick" || nick.trim().length < 2 || nick.trim() === user.nick} onClick={saveNick}>바꾸기</button></div>
        </>)}

        {row("email", "이메일", `${user.email || "-"} · ${emailState}`, <>
          <p className="acct-help">비밀번호를 잊었을 때 재설정 링크를 받는 곳이에요. 인증한 이메일만 쓸 수 있어요.</p>
          <Field label="이메일" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
          {user.hasPassword && <Field label="현재 비밀번호" type="password" value={curPw} maxLength={64} autoComplete="current-password" onChange={(e) => setCurPw(e.target.value)} />}
          <div className="auth-actions">
            {user.email ? <button className="auth-link danger" disabled={busy === "email" || (user.hasPassword && !curPw)} onClick={() => saveEmail(true)}>이메일 지우기</button> : <span />}
            <button className="auth-btn" disabled={busy === "email" || !email.trim() || (!emailChanged && user.emailVerified) || (user.hasPassword && !curPw)} onClick={() => saveEmail(false)}>{emailChanged || !user.email ? "인증 메일 보내기" : "다시 보내기"}</button>
          </div>
        </>)}

        {row("pw", "비밀번호", user.hasPassword ? "••••••••" : "없음 (소셜 로그인 전용)", <>
          {user.hasPassword && <Field label="현재 비밀번호" type="password" value={pw.cur} maxLength={64} autoComplete="current-password" onChange={(e) => setPw({ ...pw, cur: e.target.value })} />}
          <Field label="새 비밀번호 (6자 이상)" type="password" value={pw.next} maxLength={64} autoComplete="new-password" onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <Field label="새 비밀번호 한 번 더" type="password" value={pw.again} maxLength={64} autoComplete="new-password" onChange={(e) => setPw({ ...pw, again: e.target.value })} />
          <div className="auth-actions end"><button className="auth-btn" disabled={busy === "pw" || pw.next.length < 6 || (user.hasPassword && !pw.cur)} onClick={savePw}>{user.hasPassword ? "바꾸기" : "만들기"}</button></div>
        </>)}

        {(avail.length > 0 || user.providers.length > 0) && row("social", "연결된 로그인", user.providers.length ? user.providers.map((p) => SOCIAL[p] || p).join(", ") : "없음", <>
          {[...new Set([...avail, ...user.providers])].map((p) => (
            <div className="auth-actions" key={p}>
              <span>{SOCIAL[p] || p} {user.providers.includes(p) ? "연결됨" : "연결 안 됨"}</span>
              {user.providers.includes(p)
                ? <button className="auth-link danger" disabled={busy === "social"} onClick={() => unlink(p)}>연결 해제</button>
                : <button className="auth-btn" disabled={busy === "social"} onClick={() => link(p)}>{SOCIAL[p] || p}로 연결</button>}
            </div>
          ))}
          {!user.hasPassword && user.providers.length > 0 && <p className="acct-help">비밀번호가 없어서 해제할 수 없어요. 위의 '비밀번호'에서 먼저 만들어 주세요.</p>}
        </>)}

        {row("del", "계정 삭제", "", <>
          <p className="acct-help">서버에 보관된 진행과 편지함이 모두 사라져요. 이미 보낸 링크 편지는 편지함에서 먼저 거두어야 해요. 이 기기의 기록도 지워져요.</p>
          {user.hasPassword
            ? <Field label="현재 비밀번호" type="password" value={curPw} maxLength={64} autoComplete="current-password" onChange={(e) => setCurPw(e.target.value)} />
            : <Field label={`확인을 위해 닉네임(${user.nick})을 입력`} value={del} maxLength={12} onChange={(e) => setDel(e.target.value)} />}
          <div className="auth-actions end"><button className="auth-btn danger" disabled={busy === "del" || (user.hasPassword ? !curPw : del.trim() !== user.nick)} onClick={remove}>계정 지우기</button></div>
        </>)}

        <div className="auth-actions">
          <button className="auth-link" onClick={onLogout}>로그아웃</button>
          <button className="auth-btn" onClick={onBack}>돌아가기</button>
        </div>
      </div>
    </main>
  );
}
