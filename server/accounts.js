// 계정과 진행 기록 동기화. 로그인은 닉네임 + 비밀번호(또는 소셜)이고, 비밀번호는 scrypt로 해시해 저장한다(원문은 저장하지 않는다).
// 로그인하면 세션 토큰(무작위 32바이트)을 받고, 서버에는 그 해시만 둔다. 클라이언트는 Authorization: Bearer 토큰으로 호출한다.
//   POST   /api/auth/register       { nick, password, email? }  → { token, user }   (이메일은 선택: 비밀번호 찾기용, 인증 메일을 보낸다)
//   POST   /api/auth/login          { nick, password }          → { token, user, state }
//   POST   /api/auth/logout                                     → { ok }
//   GET    /api/auth/providers                                  → { providers: ["google", ...], mail }   (켜져 있는 소셜 로그인)
//   POST   /api/auth/forgot         { email }                   → { ok }   (인증된 이메일이면 재설정 링크를 보낸다. 있는지 없는지는 알려 주지 않는다)
//   POST   /api/auth/reset          { token, password }         → { ok }   (새 비밀번호. 모든 기기에서 로그아웃된다)
//   GET    /api/auth/verify-email?token=…                       → 이메일 인증 뒤 /?emailverified=1 로 이동
//   GET    /api/auth/oauth/:provider/start, /callback           소셜 로그인(google): 끝나면 /#social=토큰 으로 돌아온다
//   GET    /api/me                                              → { user, state, updatedAt }   user: { id, nick, email, emailVerified, hasPassword, providers }
//   PUT    /api/me/state            { state }                   → { ok, updatedAt }   (기기를 바꿔도 이어서 하도록 진행·편지함을 서버에 보관)
//   POST   /api/me/nick             { nick }                    → { user }   (소셜로 처음 가입하면 임시 닉네임이라 user.needsNick이 true. 여기서 정하면 false)
//   POST   /api/me/email            { email, password? }        → { user }   (인증 메일을 보낸다. 빈 값이면 이메일을 지운다)
//   POST   /api/me/password         { current?, next }          → { ok }   (다른 기기는 로그아웃된다)
//   DELETE /api/me                  { password? | confirm? }    → { ok }   (계정과 기록을 모두 지운다. 소셜 전용 계정은 닉네임을 입력해 확인)
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 60;
const MAX_STATE = 256 * 1024;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const rand = (n = 32) => crypto.randomBytes(n).toString("base64url");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,200}\.[^\s@<>]{2,24}$/;

// 소셜 로그인 설정: 환경변수 <이름>_CLIENT_ID, <이름>_CLIENT_SECRET이 있으면 켜진다. 주소는 테스트를 위해 환경변수로 바꿀 수 있다.
const OAUTH = {
  google: { auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", info: "https://openidconnect.googleapis.com/v1/userinfo", scope: "openid email profile",
    norm: (j) => ({ sub: String(j.sub || ""), name: j.name || "", email: j.email || "", verified: j.email_verified === true || j.email_verified === "true" }) },
};
const cfg = (p) => {
  const U = p.toUpperCase(), d = OAUTH[p]; if (!d) return null;
  const id = process.env[`${U}_CLIENT_ID`], secret = process.env[`${U}_CLIENT_SECRET`]; if (!id || !secret) return null;
  return { ...d, id, secret, auth: process.env[`${U}_AUTH_URL`] || d.auth, token: process.env[`${U}_TOKEN_URL`] || d.token, info: process.env[`${U}_USERINFO_URL`] || d.info };
};

export function makeAccounts({ db, send, readJson, limited, ipOf, mailer }) {
  const hash = async (pw, salt) => (await scrypt(pw, salt, 64)).toString("hex");
  const validNick = (n) => typeof n === "string" && /^[^\u0000-\u001F\u007F\s][^\u0000-\u001F\u007F]{0,10}[^\u0000-\u001F\u007F\s]$/.test(n) && !/[<>]/.test(n);
  const validPw = (p) => typeof p === "string" && p.length >= 6 && p.length <= 64;
  const tokenOf = (req) => (/^Bearer ([A-Za-z0-9_-]{20,})$/.exec(String(req.headers.authorization || "")) || [])[1] || "";
  const publicUrl = (req) => (process.env.PUBLIC_URL || `${process.env.TRUST_PROXY === "1" && req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]).split(",")[0] : "http"}://${req.headers.host}`).replace(/\/$/, "");
  const redirect = (res, to) => { res.writeHead(302, { Location: to, "Cache-Control": "no-store" }); res.end(); };

  async function issue(uid) {
    const token = rand(32);
    db.addSession(sha(token), uid, Date.now() + SESSION_DAYS * 86400000);
    return token;
  }
  function userOf(req) {
    const t = tokenOf(req); if (!t) return null;
    const s = db.getSession(sha(t));
    if (!s || s.expires_at < Date.now()) return null;
    return db.userById(s.user_id);
  }
  const pub = (u) => { const f = db.userById(u.id); return { id: f.id, nick: f.nick, needsNick: !f.nick_set, email: f.email || "", emailVerified: !!f.email_verified, hasPassword: !!f.has_pass, providers: db.identitiesOf(f.id) }; };

  // 이메일 인증 메일(링크 한 번 쓰면 사라지고 1일 안에 눌러야 한다)
  async function sendVerify(req, uid, email) {
    db.dropUserTokens(uid, "verify");
    const t = rand(24); db.addToken(sha(t), "verify", uid, { email }, Date.now() + 86400000);
    try { await mailer.send({ to: email, subject: "[나루 우체국] 이메일을 확인해 주세요", text: `나루 우체국 이메일 확인 링크예요. 하루 안에 눌러 주세요.\n\n${publicUrl(req)}/api/auth/verify-email?token=${t}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요.` }); return true; }
    catch { return false; }
  }
  async function newNick(base) {
    let b = String(base || "").replace(/[\u0000-\u001F\u007F<>]/g, "").trim().slice(0, 10) || "여행자";
    if (!validNick(b)) b = "여행자";
    for (let i = 0; i < 20; i++) { const n = i ? b.slice(0, 8) + Math.floor(10 + Math.random() * 90) : b; if (!db.userByNick(n)) return n; }
    return "여행자" + rand(3);
  }

  async function oauth(req, res, parts, url) {
    const p = parts[3], c = cfg(p);
    if (!c) return send(res, 404, { error: "not_found" });
    const redirectUri = `${publicUrl(req)}/api/auth/oauth/${p}/callback`;
    if (parts[4] === "start") {
      if (limited(ipOf(req) + ":oauth", 60, 600000)) return send(res, 429, { error: "too_many" });
      const state = rand(18); db.addToken(sha(state), "oauth", null, { p }, Date.now() + 600000);
      const q = new URLSearchParams({ response_type: "code", client_id: c.id, redirect_uri: redirectUri, state });
      if (c.scope) q.set("scope", c.scope);
      return redirect(res, `${c.auth}?${q}`);
    }
    if (parts[4] === "callback") {
      try {
        const code = url.searchParams.get("code"), st = db.takeToken(sha(url.searchParams.get("state") || ""), "oauth");
        if (!code || !st || st.data?.p !== p) throw new Error("state");
        const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: c.id, client_secret: c.secret, redirect_uri: redirectUri, state: url.searchParams.get("state") });
        const tr = await fetch(c.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
        const tj = await tr.json(); if (!tr.ok || !tj.access_token) throw new Error("token");
        const ir = await fetch(c.info, { headers: { Authorization: `Bearer ${tj.access_token}` } });
        const prof = c.norm(await ir.json()); if (!ir.ok || !prof.sub) throw new Error("profile");
        let uid = db.identity(p, prof.sub);
        if (!uid && prof.verified && prof.email && EMAIL.test(prof.email)) { const same = db.userByEmail(prof.email); if (same) { uid = same.id; db.addIdentity(p, prof.sub, uid); } }   // 같은 인증된 이메일의 계정이면 이어 준다
        if (!uid) {
          uid = db.addTempUser(await newNick("여행자"));              // 구글 이름은 쓰지 않는다. 임시 닉네임으로 만들고, 처음 들어올 때 직접 정하게 한다
          if (prof.verified && prof.email && EMAIL.test(prof.email) && !db.userByEmail(prof.email)) db.setEmail(uid, prof.email, true);
          db.addIdentity(p, prof.sub, uid);
        }
        return redirect(res, `/#social=${await issue(uid)}`);
      } catch { return redirect(res, "/?socialerror=1"); }
    }
    return send(res, 404, { error: "not_found" });
  }

  return async function handle(req, res, parts, url) {
    const ip = ipOf(req);
    if (parts[1] === "auth") {
      const act = parts[2];
      if (act === "providers" && req.method === "GET") return send(res, 200, { providers: Object.keys(OAUTH).filter((p) => cfg(p)), mail: mailer.live });
      if (act === "oauth" && req.method === "GET") return oauth(req, res, parts, url);
      if (act === "verify-email" && req.method === "GET") {
        const t = db.takeToken(sha(url.searchParams.get("token") || ""), "verify");
        const u = t && db.userRow(t.userId);
        if (u && u.email && u.email.toLowerCase() === String(t.data?.email).toLowerCase() && !db.userByEmail(u.email)) { db.setEmail(u.id, u.email, true); return redirect(res, "/?emailverified=1"); }
        return redirect(res, "/?emailverified=0");
      }
      if (act === "logout" && req.method === "POST") { const t = tokenOf(req); if (t) db.delSession(sha(t)); return send(res, 200, { ok: true }); }
      if (act === "forgot" && req.method === "POST") {
        const b = await readJson(req, 2048), email = typeof b.email === "string" ? b.email.trim() : "";
        if (!EMAIL.test(email)) return send(res, 400, { error: "bad_email" });
        if (limited(ip + ":forgot", 8, 3600000) || limited("mail:" + email.toLowerCase(), 3, 3600000)) return send(res, 429, { error: "too_many" });
        const u = db.userByEmail(email);                                   // 인증된 이메일만 받을 수 있다
        if (u) {
          db.dropUserTokens(u.id, "reset");
          const t = rand(24); db.addToken(sha(t), "reset", u.id, null, Date.now() + 30 * 60000);
          try { await mailer.send({ to: u.email, subject: "[나루 우체국] 비밀번호 다시 정하기", text: `비밀번호를 다시 정하는 링크예요. 30분 안에 한 번만 쓸 수 있어요.\n\n${publicUrl(req)}/?pwreset=${t}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않아요.` }); } catch { /* 메일 오류도 있는지 없는지는 알리지 않는다 */ }
        }
        return send(res, 200, { ok: true });
      }
      if (act === "reset" && req.method === "POST") {
        const b = await readJson(req, 2048);
        if (!validPw(b.password)) return send(res, 400, { error: "bad_password" });
        if (limited(ip + ":reset", 20, 3600000)) return send(res, 429, { error: "too_many" });
        const t = db.takeToken(sha(String(b.token || "")), "reset");
        if (!t) return send(res, 400, { error: "bad_token" });
        const salt = crypto.randomBytes(16).toString("hex");
        db.setPass(t.userId, await hash(b.password, salt), salt); db.deleteUserSessions(t.userId);                  // 모든 기기에서 로그아웃
        return send(res, 200, { ok: true });
      }
      if ((act === "register" || act === "login") && req.method === "POST") {
        const b = await readJson(req, 2048);
        const nick = typeof b.nick === "string" ? b.nick.trim() : "";
        if (!validNick(nick)) return send(res, 400, { error: "bad_nick" });
        if (!validPw(b.password)) return send(res, 400, { error: "bad_password" });
        if (act === "register") {
          if (limited(ip + ":register", 10)) return send(res, 429, { error: "too_many" });
          const email = typeof b.email === "string" ? b.email.trim() : "";
          if (email && !EMAIL.test(email)) return send(res, 400, { error: "bad_email" });
          if (db.userByNick(nick)) return send(res, 409, { error: "nick_taken" });
          const salt = crypto.randomBytes(16).toString("hex");
          let uid; try { uid = db.addUser(nick, await hash(b.password, salt), salt); } catch { return send(res, 409, { error: "nick_taken" }); }
          if (email) { db.setEmail(uid, email, false); sendVerify(req, uid, email); }
          return send(res, 201, { token: await issue(uid), user: pub({ id: uid }) });
        }
        if (limited(ip + ":login", 20, 10 * 60 * 1000) || limited("nick:" + nick.toLowerCase(), 10, 10 * 60 * 1000)) return send(res, 429, { error: "too_many" });   // 무작정 대입 방지
        const u = db.userByNick(nick);
        const calc = await hash(b.password, u && u.salt ? u.salt : "0".repeat(32));                // 없는 닉네임도 같은 시간이 걸리게
        if (!u || !u.pass || !safeEq(calc, u.pass)) return send(res, 401, { error: "wrong_login" });   // 소셜 전용 계정(비밀번호 없음)은 비밀번호로 들어올 수 없다
        const st = db.getState(u.id);
        return send(res, 200, { token: await issue(u.id), user: pub(u), state: st?.data || null, updatedAt: st?.updatedAt || 0 });
      }
      return send(res, 404, { error: "not_found" });
    }
    // /api/me …
    const u = userOf(req);
    if (!u) return send(res, 401, { error: "unauthorized" });
    const sub = parts[2];
    if (!sub && req.method === "GET") { const st = db.getState(u.id); return send(res, 200, { user: pub(u), state: st?.data || null, updatedAt: st?.updatedAt || 0 }); }
    if (sub === "state" && req.method === "PUT") {
      if (limited(ip + ":sync:" + u.id, 600, 3600 * 1000)) return send(res, 429, { error: "too_many" });
      const b = await readJson(req, MAX_STATE);
      if (!b.state || typeof b.state !== "object" || Array.isArray(b.state)) return send(res, 400, { error: "bad_state" });
      db.putState(u.id, b.state);
      return send(res, 200, { ok: true, updatedAt: Date.now() });
    }
    const needPassword = async (b) => {                                  // 중요한 변경은 비밀번호를 다시 확인한다(비밀번호가 있는 계정만)
      const row = db.userRow(u.id);
      if (!row.pass) return true;
      return typeof b.password === "string" && safeEq(await hash(b.password, row.salt), row.pass);
    };
    if (sub === "nick" && req.method === "POST") {
      if (limited(ip + ":nick:" + u.id, 10, 3600000)) return send(res, 429, { error: "too_many" });
      const b = await readJson(req, 1024), nick = typeof b.nick === "string" ? b.nick.trim() : "";
      if (!validNick(nick)) return send(res, 400, { error: "bad_nick" });
      const other = db.userByNick(nick);
      if (other && other.id !== u.id) return send(res, 409, { error: "nick_taken" });
      db.setNick(u.id, nick);
      return send(res, 200, { user: pub(u) });
    }
    if (sub === "email" && req.method === "POST") {
      if (limited(ip + ":email:" + u.id, 10, 3600000)) return send(res, 429, { error: "too_many" });
      const b = await readJson(req, 2048), email = typeof b.email === "string" ? b.email.trim() : "";
      if (email && !EMAIL.test(email)) return send(res, 400, { error: "bad_email" });
      if (!(await needPassword(b))) return send(res, 403, { error: "wrong_login" });
      db.dropUserTokens(u.id, "verify");
      if (!email) db.setEmail(u.id, null, false);
      else { db.setEmail(u.id, email, false); if (!(await sendVerify(req, u.id, email)) && mailer.live) return send(res, 502, { error: "mail_failed", user: pub(u) }); }
      return send(res, 200, { user: pub(u) });
    }
    if (sub === "password" && req.method === "POST") {
      const b = await readJson(req, 2048);
      if (!validPw(b.next)) return send(res, 400, { error: "bad_password" });
      const row = db.userRow(u.id);
      if (row.pass && !(typeof b.current === "string" && safeEq(await hash(b.current, row.salt), row.pass))) return send(res, 403, { error: "wrong_login" });
      const salt = crypto.randomBytes(16).toString("hex");
      db.setPass(u.id, await hash(b.next, salt), salt); db.delOtherSessions(u.id, sha(tokenOf(req)));   // 소셜 전용 계정도 여기서 비밀번호를 만들 수 있다
      return send(res, 200, { ok: true });
    }
    if (!sub && req.method === "DELETE") {
      const b = await readJson(req, 2048), row = db.userRow(u.id);
      const ok = row.pass ? typeof b.password === "string" && safeEq(await hash(b.password, row.salt), row.pass) : b.confirm === row.nick;
      if (!ok) return send(res, 403, { error: "wrong_login" });
      db.deleteUser(u.id);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "not_found" });
  };
}
