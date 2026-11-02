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

  return (
    <main className="screen center">
      <div className="form nick">
        <h2>나루 우체국</h2>
        {mode !== "forgot" && (
          <div className="auth-tabs" role="tablist">
            {[["login", "로그인"], ["register", "가입"], ["guest", "이 기기에서만"]].map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
          </div>
        )}
        <p className="sub">{HINT[mode]}</p>
        {mode === "forgot" ? (
          sent
            ? <p className="sub ok" role="status">{prov.mail ? "메일을 보냈어요. 편지함에서 링크를 눌러 주세요(30분 안). 인증한 이메일이 아니면 메일이 가지 않아요." : "메일 발송이 아직 설정되지 않은 서버예요. 관리자에게 문의해 주세요."}</p>
            : <input ref={ref} type="email" value={email} maxLength={120} placeholder="이메일" autoComplete="email" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => enter(e)} />
        ) : (
          <>
            <input ref={ref} value={nick} maxLength={12} placeholder="닉네임 (예: 소라)" autoComplete="username" onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => enter(e, acct ? "naru-pw" : null)} />
            {acct && <input id="naru-pw" type="password" value={pw} maxLength={64} placeholder="비밀번호 (6자 이상)" autoComplete={mode === "register" ? "new-password" : "current-password"} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => enter(e, mode === "register" ? "naru-email" : null)} />}
            {mode === "register" && <input id="naru-email" type="email" value={email} maxLength={120} placeholder="이메일 (선택 · 비밀번호를 잊었을 때 필요해요)" autoComplete="email" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => enter(e)} />}
          </>
        )}
        {err && <p className="sub warn" role="alert">{err}</p>}
        <div className="row">
          <button className="btn" disabled={!ok || busy || sent} onClick={go}>{busy ? "잠시만요…" : mode === "login" ? "로그인" : mode === "register" ? "가입하고 시작" : mode === "forgot" ? "재설정 메일 보내기" : onBack ? "바꾸기" : "시작하기"}</button>
          {(onBack || mode === "forgot") && <button className="btn ghost" onClick={mode === "forgot" ? () => setMode("login") : onBack}>{mode === "forgot" ? "로그인으로" : "돌아가기"}</button>}
        </div>
        {mode === "login" && <button className="linkbtn" onClick={() => setMode("forgot")}>비밀번호를 잊었어요</button>}
        {acct && prov.providers.length > 0 && (
          <div className="social" aria-label="소셜 계정으로 계속하기">
            <span>또는</span>
            {prov.providers.map((p) => <a key={p} className={`social-btn ${p}`} href={socialUrl(p)}>{SOCIAL[p] || p}로 계속하기</a>)}
          </div>
        )}
        {onReset && <button className="linkbtn" onClick={onReset}>저장된 진행 모두 지우고 처음부터</button>}
      </div>
    </main>
  );
}
