import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startServer, fakeMail, fakeGoogle, tmpDir, wait } from "./helpers.js";

// 계정: 가입·로그인·진행 동기화, 이메일 인증, 비밀번호 찾기, 닉네임·이메일·비밀번호 변경, 계정 삭제, 구글 로그인(연결·해제), 계정 단위 차단
let S, mail, goog, dir;
before(async () => {
  mail = await fakeMail(); goog = await fakeGoogle(); dir = tmpDir("acct");
  S = await startServer({ TRUST_PROXY: "1", RESEND_API_KEY: "key123", MAIL_FROM: "나루 <no@x.com>", MAIL_API_URL: mail.url, ...goog.env }, dir);
});
after(async () => { await S.stop(); mail.close(); goog.close(); });
let ipN = 0;                                                                                              // 가입은 같은 주소에서 한 시간에 10번까지라서, 시험에서는 주소를 바꿔 가며 가입한다
const reg = (nick, extra = {}) => S.call("POST", "/api/auth/register", { nick, password: "secret12", ...extra }, null, { "X-Forwarded-For": `10.9.${++ipN}.1` });
const login = (nick, password = "secret12") => S.call("POST", "/api/auth/login", { nick, password });
const tokenOf = (cb) => cb.location.split("=")[1];
async function googleLogin() {
  const st = await S.call("GET", "/api/auth/oauth/google/start");
  const state = new URL(st.location).searchParams.get("state");
  return { st, cb: await S.call("GET", `/api/auth/oauth/google/callback?code=abc&state=${state}`) };
}
const GOOGLE_DEFAULT = { sub: "g-1", name: "구글사람", email: "g@example.com", email_verified: true };

test("가입 규칙: 짧은 비밀번호·닉네임·중복 거부, 로그인 실패, 토큰 필요", async () => {
  assert.equal((await reg("가")).status, 400);
  assert.equal((await S.call("POST", "/api/auth/register", { nick: "하나", password: "123" })).status, 400);
  assert.equal((await reg("하나")).status, 201);
  assert.equal((await reg("하나")).status, 409);
  assert.equal((await login("하나", "wrongpass")).status, 401);
  assert.equal((await login("없는사람")).status, 401);
  assert.equal((await S.call("GET", "/api/me")).status, 401);
});
test("진행·편지함이 다른 기기에서 로그인해도 따라온다", async () => {
  const r = await reg("둘이"); const state = { grade: { l1: "safe" }, mine: [{ id: "m1", share: { id: "abcdefghijkl", secret: "s3cret" } }] };
  assert.equal((await S.call("PUT", "/api/me/state", { state }, r.json.token)).status, 200);
  const other = await login("둘이"); assert.notEqual(other.json.token, r.json.token);
  assert.equal(other.json.state.mine[0].share.secret, "s3cret");
  assert.equal((await S.call("PUT", "/api/me/state", { state: [1] }, r.json.token)).status, 400);
  assert.equal((await S.call("PUT", "/api/me/state", { state: { x: "a".repeat(300 * 1024) } }, r.json.token)).status, 413);
  assert.equal((await S.call("POST", "/api/auth/logout", null, r.json.token)).status, 200);
  assert.equal((await S.call("GET", "/api/me", null, r.json.token)).status, 401);
});
test("이메일 인증과 비밀번호 찾기", async () => {
  const r = await reg("메일이", { email: "mail@example.com" });
  assert.equal(r.json.user.emailVerified, false);
  const vm = await mail.last("mail@example.com");
  assert.equal(vm.auth, "Bearer key123"); assert.match(vm.text, /verify-email\?token=/);
  mail.mails.length = 0;
  await S.call("POST", "/api/auth/forgot", { email: "mail@example.com" });                          // 인증 전에는 메일이 가지 않는다
  await wait(300); assert.equal(mail.mails.length, 0);
  const link = vm.text.match(/\/api\/auth\/verify-email\?token=[\w-]+/)[0];
  assert.equal((await S.call("GET", link)).location, "/?emailverified=1");
  assert.equal((await S.call("GET", link)).location, "/?emailverified=0");                          // 한 번만
  await S.call("POST", "/api/auth/forgot", { email: "MAIL@example.com" });
  const rm = await mail.last("mail@example.com"); const t = rm.text.match(/pwreset=([\w-]+)/)[1];
  assert.equal((await S.call("POST", "/api/auth/reset", { token: t, password: "123" })).status, 400);
  assert.equal((await S.call("POST", "/api/auth/reset", { token: t, password: "brandnew12" })).status, 200);
  assert.equal((await S.call("POST", "/api/auth/reset", { token: t, password: "again1234" })).status, 400);
  assert.equal((await S.call("GET", "/api/me", null, r.json.token)).status, 401);                    // 이전 기기는 로그아웃
  assert.equal((await login("메일이", "secret12")).status, 401);
  assert.equal((await login("메일이", "brandnew12")).status, 200);
  assert.equal((await S.call("POST", "/api/auth/forgot", { email: "ghost@example.com" })).status, 200);   // 없는 이메일도 같은 응답
});
test("닉네임·이메일·비밀번호 변경은 확인과 중복 검사를 거친다", async () => {
  const a = (await reg("변경이")).json.token; await reg("다른이");
  assert.equal((await S.call("POST", "/api/me/nick", { nick: "다른이" }, a)).status, 409);
  assert.equal((await S.call("POST", "/api/me/nick", { nick: "새변경" }, a)).json.user.nick, "새변경");
  assert.equal((await S.call("POST", "/api/me/email", { email: "n@example.com", password: "wrong" }, a)).status, 403);
  const em = await S.call("POST", "/api/me/email", { email: "n@example.com", password: "secret12" }, a);
  assert.equal(em.json.user.emailVerified, false); assert.ok(await mail.last("n@example.com"));
  const other = (await login("새변경")).json.token;
  assert.equal((await S.call("POST", "/api/me/password", { current: "bad", next: "third1234" }, a)).status, 403);
  assert.equal((await S.call("POST", "/api/me/password", { current: "secret12", next: "third1234" }, a)).status, 200);
  assert.equal((await S.call("GET", "/api/me", null, a)).status, 200);                              // 바꾼 기기는 유지
  assert.equal((await S.call("GET", "/api/me", null, other)).status, 401);                           // 다른 기기는 로그아웃
});
test("구글 로그인: 구글 이름 대신 임시 닉네임으로 가입하고, 직접 닉네임을 정한다", async () => {
  goog.g.profile = { ...GOOGLE_DEFAULT };
  assert.deepEqual((await S.call("GET", "/api/auth/providers")).json, { providers: ["google"], mail: true });
  const { st, cb } = await googleLogin();
  assert.ok(st.location.startsWith(goog.env.GOOGLE_AUTH_URL)); assert.match(cb.location, /^\/#social=[\w-]{20,}$/);
  const tok = tokenOf(cb), me = (await S.call("GET", "/api/me", null, tok)).json.user;
  assert.ok(me.nick.startsWith("여행자")); assert.equal(me.needsNick, true); assert.equal(me.hasPassword, false); assert.equal(me.email, "g@example.com");
  assert.equal((await login(me.nick, "anything1")).status, 401);                                      // 비밀번호 없는 계정
  assert.equal((await S.call("POST", "/api/me/nick", { nick: "구글닉" }, tok)).json.user.needsNick, false);
  const again = await googleLogin();                                                                   // 같은 구글 → 같은 계정
  assert.equal((await S.call("GET", "/api/me", null, tokenOf(again.cb))).json.user.id, me.id);
  assert.equal((await S.call("GET", "/api/auth/oauth/google/callback?code=abc&state=zzz")).location, "/?socialerror=1");
  assert.equal((await S.call("GET", "/api/auth/oauth/kakao/start")).status, 404);
});
test("소셜 로그인 연결과 해제(비밀번호가 있어야 해제)", async () => {
  goog.g.profile = { sub: "g-77", name: "연결", email: "", email_verified: false };
  const a = (await reg("연결이")).json.token;
  const link = await S.call("POST", "/api/me/link/google", null, a);
  assert.ok(link.json.url.startsWith(goog.env.GOOGLE_AUTH_URL));
  assert.equal((await S.call("GET", `/api/auth/oauth/google/callback?code=abc&state=${new URL(link.json.url).searchParams.get("state")}`)).location, "/?linked=1");
  assert.deepEqual((await S.call("GET", "/api/me", null, a)).json.user.providers, ["google"]);
  assert.equal((await S.call("POST", "/api/me/link/google", null, a)).status, 409);                    // 이미 연결됨
  const b = (await reg("연결둘")).json.token;                                                           // 같은 구글을 다른 계정에 연결하려 하면 막힌다
  const l2 = await S.call("POST", "/api/me/link/google", null, b);
  assert.equal((await S.call("GET", `/api/auth/oauth/google/callback?code=abc&state=${new URL(l2.json.url).searchParams.get("state")}`)).location, "/?linked=0");
  assert.equal((await S.call("DELETE", "/api/me/identities/google", null, a)).json.user.providers.length, 0);
  goog.g.profile = { sub: "g-88", name: "전용", email: "", email_verified: false };                      // 비밀번호 없는 소셜 전용 계정은 해제할 수 없다
  const only = tokenOf((await googleLogin()).cb);
  assert.equal((await S.call("DELETE", "/api/me/identities/google", null, only)).status, 400);
  goog.g.profile = { ...GOOGLE_DEFAULT };
});
test("인증된 같은 이메일의 기존 계정에는 구글이 이어 붙는다", async () => {
  const a = (await reg("이어짐")).json.token;
  await S.call("POST", "/api/me/email", { email: "same@example.com", password: "secret12" }, a);
  await S.call("GET", (await mail.last("same@example.com")).text.match(/\/api\/auth\/verify-email\?token=[\w-]+/)[0]);
  goog.g.profile = { sub: "g-99", name: "다른이름", email: "same@example.com", email_verified: true };
  const u = (await S.call("GET", "/api/me", null, tokenOf((await googleLogin()).cb))).json.user;
  assert.equal(u.nick, "이어짐"); assert.ok(u.providers.includes("google"));
  goog.g.profile = { ...GOOGLE_DEFAULT };
});
test("계정 삭제: 확인이 필요하고, 올린 편지와 녹음도 함께 지워진다", async () => {
  const a = (await reg("삭제이")).json.token;
  const V = await S.call("POST", "/api/voices", { data: "data:audio/webm;base64," + Buffer.from("zz").toString("base64") });
  const L = await S.call("POST", "/api/letters", { from: "삭제이", to: "엄마", body: "안녕", voice: V.json.id }, a);
  assert.equal((await S.call("DELETE", "/api/me", { password: "bad" }, a)).status, 403);
  assert.equal((await S.call("DELETE", "/api/me", { password: "secret12" }, a)).status, 200);
  assert.equal((await S.call("GET", `/api/letters/${L.json.id}`)).status, 404);
  assert.equal((await fetch(`${S.base}/api/voices/${V.json.id}`)).status, 404);
  assert.equal((await login("삭제이")).status, 401);
});
test("발신자 차단은 계정에 걸린다(접속 주소를 바꿔도 막히고, 다른 계정은 그대로 쓴다)", async () => {
  const ip = (n) => ({ "X-Forwarded-For": `10.0.0.${n}` });
  const bad = (await reg("나쁜계정")).json.token, good = (await reg("착한계정")).json.token;
  const L = await S.call("POST", "/api/letters", { from: "나쁜", to: "누구", body: "이상한 편지" }, bad, ip(1));
  const adm = { "X-Admin-Token": fs.readFileSync(path.join(dir, ".admin-token"), "utf8").trim() };
  assert.equal((await S.call("POST", `/api/admin/letters/${L.json.id}/block-sender`, null, null, adm)).status, 200);
  assert.equal((await S.call("GET", `/api/letters/${L.json.id}`)).status, 404);                         // 편지는 지워진다
  const again = await S.call("POST", "/api/letters", { from: "나쁜", to: "누구", body: "또" }, bad, ip(2));   // 다른 주소에서도 같은 계정이면 막힌다
  assert.equal(again.status, 403); assert.equal(again.json.error, "blocked_sender");
  assert.equal((await S.call("POST", "/api/letters", { from: "착한", to: "누구", body: "안녕" }, good, ip(2))).status, 201);   // 다른 계정은 새 주소에서 문제없다
});
