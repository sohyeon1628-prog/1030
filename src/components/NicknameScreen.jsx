import React, { useEffect, useRef, useState } from "react";
import { register, login, forgotPassword, getProviders, socialUrl } from "../auth.js";

const ERR = {
  bad_nick: "닉네임은 2~12자로 써 주세요.", bad_password: "비밀번호는 6자 이상이어야 해요.", nick_taken: "이미 쓰고 있는 닉네임이에요.", bad_email: "이메일 형식이 맞지 않아요.",
  wrong_login: "닉네임이나 비밀번호가 맞지 않아요.", too_many: "잠시 뒤에 다시 해 주세요.", network: "서버에 닿지 못했어요. '이 기기에서만'으로 시작할 수 있어요.",
};
const SOCIAL = { google: "Google" };
const HINT = {
  guest: "닉네임만 정하고 이 기기에서만 해요. 기기를 바꾸면 진행이 따라오지 않아요.",
  register: "닉네임과 비밀번호를 정하면 진행과 편지함이 보관돼서, 어느 기기에서나 이어서 할 수 있어요.",
  login: "가입한 닉네임과 비밀번호로 들어와요.",
  forgot: "가입할 때 적고 인증한 이메일을 입력하면, 비밀번호를 다시 정하는 링크를 보내 드려요.",
};

// 시작 화면: 로그인 / 가입 / 이 기기에서만 쓰기(손님) / 비밀번호 찾기. 로그인하면 진행과 편지함이 서버에 보관되어 기기를 바꿔도 이어진다.
export default function NicknameScreen({ initial = "", onGuest, onAuth, onBack, onReset }) {
  const [mode, setMode] = useState("login");              // login | register | guest | forgot
  const [nick, setNick] = useState(initial);
  const [pw, setPw] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [prov, setProv] = useState({ providers: [], mail: false });
  const ref = useRef(null);
  useEffect(() => { getProviders().then(setProv); }, []);
  useEffect(() => { ref.current?.focus(); setErr(""); setSent(false); }, [mode]);
  const acct = mode === "login" || mode === "register";
  const ok = mode === "forgot" ? /^\S+@\S+\.\S{2,}$/.test(email) : nick.trim().length >= 2 && (!acct || pw.length >= 6);

  const go = async () => {
    if (!ok || busy) return;
    if (mode === "guest") return onGuest(nick.trim());
    setBusy(true); setErr("");
    try {
      if (mode === "forgot") { await forgotPassword(email.trim()); setSent(true); }
      else onAuth(await (mode === "register" ? register(nick.trim(), pw, email.trim()) : login(nick.trim(), pw)));
    } catch (e) { setErr(ERR[e.message] || "잠시 뒤에 다시 해 주세요."); }
    setBusy(false);
  };
  const enter = (e, next) => { if (e.key === "Enter") { e.preventDefault(); next ? document.getElementById(next)?.focus() : go(); } };

  const TITLE = { login: "로그인", register: "계정 만들기", guest: "이 기기에서 시작", forgot: "비밀번호 찾기" };
  const primary = busy ? "잠시만요…" : mode === "login" ? "로그인" : mode === "register" ? "만들기" : mode === "forgot" ? "메일 보내기" : onBack ? "바꾸기" : "시작";
  return (
    <main className="screen center">
      <div className="auth-card">
        <div className="auth-brand">나루 우체국</div>
        <h1>{TITLE[mode]}</h1>
        <p className="auth-sub">{HINT[mode]}</p>

        {mode === "forgot" ? (
          sent
            ? <p className="auth-ok" role="status">{prov.mail ? "메일을 보냈어요. 편지함에서 링크를 눌러 주세요(30분 안). 인증한 이메일이 아니면 메일이 가지 않아요." : "메일 발송이 아직 설정되지 않은 서버예요. 관리자에게 문의해 주세요."}</p>
            : <label className="auth-field"><input ref={ref} type="email" value={email} maxLength={120} placeholder=" " autoComplete="email" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => enter(e)} /><span>이메일</span></label>
        ) : (
          <>
            <label className="auth-field"><input ref={ref} value={nick} maxLength={12} placeholder=" " autoComplete="username" onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => enter(e, acct ? "naru-pw" : null)} /><span>닉네임</span></label>
            {acct && <label className="auth-field"><input id="naru-pw" type="password" value={pw} maxLength={64} placeholder=" " autoComplete={mode === "register" ? "new-password" : "current-password"} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => enter(e, mode === "register" ? "naru-email" : null)} /><span>비밀번호 (6자 이상)</span></label>}
            {mode === "register" && <label className="auth-field"><input id="naru-email" type="email" value={email} maxLength={120} placeholder=" " autoComplete="email" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => enter(e)} /><span>이메일 (선택)</span></label>}
            {mode === "login" && <button className="auth-link" onClick={() => setMode("forgot")}>비밀번호를 잊으셨나요?</button>}
          </>
        )}
        {err && <p className="auth-err" role="alert">{err}</p>}

        <div className="auth-actions">
          {mode === "login" && <button className="auth-link" onClick={() => setMode("register")}>계정 만들기</button>}
          {mode === "register" && <button className="auth-link" onClick={() => setMode("login")}>이미 계정이 있어요</button>}
          {mode === "guest" && <button className="auth-link" onClick={() => setMode("login")}>로그인하기</button>}
          {mode === "forgot" && <button className="auth-link" onClick={() => setMode("login")}>로그인으로</button>}
          <button className="auth-btn" disabled={!ok || busy || sent} onClick={go}>{primary}</button>
        </div>

        {acct && prov.providers.length > 0 && (
          <>
            <div className="auth-or"><span>또는</span></div>
            {prov.providers.map((p) => <a key={p} className="auth-google" href={socialUrl(p)}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>{SOCIAL[p] || p}로 계속하기</a>)}
          </>
        )}
        <div className="auth-foot">
          {mode !== "guest" && mode !== "forgot" && <button className="auth-link" onClick={() => setMode("guest")}>계정 없이 이 기기에서만 시작</button>}
          {onBack && <button className="auth-link" onClick={onBack}>돌아가기</button>}
          {onReset && <button className="auth-link faint" onClick={onReset}>저장된 진행 지우고 처음부터</button>}
        </div>
      </div>
    </main>
  );
}
