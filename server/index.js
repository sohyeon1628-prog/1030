// 나루 우체국 — 링크로 편지 보내기 서버. 외부 패키지 없이 Node만으로 동작한다.
//   POST   /api/letters              편지를 올리고 링크용 id와 회수용 secret을 받는다
//   POST   /api/letters/batch        같은 편지를 여러 사람에게: { letters: [편지…] } (최대 10통, 호출 제한은 한 번으로 센다)
//   GET    /api/letters/:id          받는 사람이 편지를 연다(처음 열면 '읽음'으로 기록)
//   GET    /api/letters/:id/status   보낸 사람이 읽혔는지 확인(secret 필요)
//   DELETE /api/letters/:id          보낸 사람이 회수(secret 필요)
//   POST   /api/letters/:id/report   신고(3번 쌓이면 숨김)
//   POST   /api/letters/:id/react    받는 사람이 반응(박수·폭죽·하트) 하나를 돌려보낸다. 보낸 사람은 status로 본다
//   POST   /api/voices               보낸 사람의 녹음(data URL, 최대 450KB)을 올리고 id를 받는다. 같은 녹음을 여러 편지가 함께 쓴다
//   GET    /api/voices/:id           받는 사람이 도착 영상에서 재생할 녹음(그 녹음을 쓰는 편지가 살아 있을 때만)
// 편지에는 도착 장면(scene: island·sea·sky)과 녹음 id(voice)가 붙는다. 받는 사람이 링크를 열면 그 장면에서 해무가 편지를 배달하는 영상이 나온다.
//   POST   /api/moderate             보내기 전에 글(to, body)을 검사한다 → { ok } (보낼 때 서버가 다시 검사한다)
// 신고: 같은 사람(IP)이 여러 번 눌러도 1건으로 센다. 3명이 신고하면 편지가 숨겨지고, 녹음이 있는 편지는 첫 신고에 녹음 재생만 먼저 막는다.
// 글 검사: blocklist.json의 단어로 막거나(block), 보내되 검토 대상으로 표시한다(review). 신고·검토 대상은 관리자 화면(/admin)에서 삭제·무시·발신자 차단.
// 계정: 닉네임 + 비밀번호로 가입·로그인하면 진행과 편지함이 서버에 보관되어 기기를 바꿔도 이어진다(accounts.js). /api/auth/*, /api/me
// 저장: DATA_DIR(기본 server/data)의 SQLite 파일 naru.db 하나에 편지·녹음·계정·진행·차단 목록을 모두 담는다(db.js). secret과 IP는 해시만 저장한다.
// 백업: 시작할 때와 BACKUP_EVERY_HOURS(기본 24)시간마다 DATA_DIR/backups(BACKUP_DIR)에 naru-날짜.db를 만들고 BACKUP_KEEP(기본 14)개만 남긴다. 수동: npm run backup
// 관리자: ADMIN_TOKEN 환경변수, 없으면 처음 시작할 때 무작위 토큰을 만들어 DATA_DIR/.admin-token에 저장하고 콘솔에 한 번 알려 준다.
// 메일: 비밀번호 찾기·이메일 인증은 RESEND_API_KEY + MAIL_FROM이 있으면 실제로 보내고, 없으면 개발 모드(콘솔과 outbox.log에 링크만 기록). 소셜 로그인은 GOOGLE_CLIENT_ID·CLIENT_SECRET, 공개 주소는 PUBLIC_URL(accounts.js 참고)
// 실행: npm run server  (PORT, DATA_DIR, BACKUP_DIR, BACKUP_KEEP, BACKUP_EVERY_HOURS, ALLOW_ORIGIN, TRUST_PROXY, ADMIN_TOKEN, HASH_SALT 환경변수)
//   GET    /api/health               살아 있는지와 저장 상태(배포 환경의 상태 확인용)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { screenText } from "./moderation.js";
import { openDb } from "./db.js";
import { makeAccounts } from "./accounts.js";
import { makeMailer } from "./mail.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const DATA = process.env.DATA_DIR || path.join(here, "data");
const DIST = path.join(here, "..", "dist");
const ORIGINS = (process.env.ALLOW_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);   // 앱(다른 출처)에서 호출할 때
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
fs.mkdirSync(DATA, { recursive: true });
const db = openDb(DATA);
// 관리자 토큰: 환경변수가 없으면 처음 한 번 만들어 파일에 보관한다(그래서 기본으로 관리자 화면이 켜져 있다)
const TOKEN_FILE = path.join(DATA, ".admin-token");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || (() => {
  try { return fs.readFileSync(TOKEN_FILE, "utf8").trim(); } catch { /* 처음 */ }
  const t = crypto.randomBytes(18).toString("base64url");
  fs.writeFileSync(TOKEN_FILE, t, { mode: 0o600 });
  console.log(`관리자 토큰을 새로 만들었습니다: ${t}  (파일: ${TOKEN_FILE}) — /admin 에서 입력하세요. 다시 보려면 이 파일을 열면 됩니다.`);
  return t;
})();

const PAPERS = new Set(["cream", "mint", "coral", "star", "gold"]);
const GRADES = new Set(["perfect", "safe", "rough"]);
const DAY = 86400 * 1000;
const MAX_BODY = 800, MAX_NAME = 20, MAX_BATCH = 10;
const SCENES = new Set(["island", "sea", "sky"]);
const REACTIONS = new Set(["clap", "fireworks", "heart"]);
const MAX_VOICE = 450 * 1024;                                     // 녹음 한 개의 최대 크기(30초 녹음은 보통 120KB 안팎)

// ── 유틸 ──
const validId = (id) => /^[A-Za-z0-9_-]{12}$/.test(id);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newId = () => crypto.randomBytes(9).toString("base64url");           // 12자, 추측할 수 없다(72비트)
const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "");
const load = (id) => db.getLetter(id);
const save = (l) => db.putLetter(l);
// 편지를 지우면, 그 편지만 쓰던 녹음도 바로 지운다(다른 살아 있는 편지가 쓰는 녹음은 남긴다)
function remove(id) {
  const l = db.getLetter(id);
  db.delLetter(id);
  if (l?.voice) { const m = db.getVoiceMeta(l.voice); if (m && !m.letters.some((x) => x !== id && liveLetter(x))) db.delVoice(l.voice); }
}
const removeLettersOf = (uid) => { for (const l of db.allLetters()) if (l.uid === uid) remove(l.id); };      // 계정을 지우면 올린 편지와 녹음도 함께 지운다
const loadVoiceMeta = (id) => db.getVoiceMeta(id);
const liveLetter = (id) => { const l = load(id); return !!l && l.expiresAt > Date.now() && l.reports < 3; };
const voiceLive = (id) => { const l = load(id); return liveLetter(id) && !l.voiceBlocked; };      // 신고가 들어온 편지의 녹음은 검토가 끝날 때까지 재생하지 않는다

function send(res, status, body, headers = {}) {
  const data = body == null ? "" : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(data);
}
function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINS.includes(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
}
function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers["content-length"] || 0) > limit) { req.resume(); return reject(Object.assign(new Error("too large"), { status: 413 })); }
    let size = 0, over = false; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { over = true; chunks.length = 0; } else if (!over) chunks.push(c); });   // 넘치면 버리되 연결은 끊지 않는다
    req.on("end", () => {
      if (over) return reject(Object.assign(new Error("too large"), { status: 413 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(Object.assign(new Error("bad json"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
// IP는 해시로만 다룬다(신고 중복 확인, 발신자 차단). 소금은 환경변수 HASH_SALT, 없으면 데이터 폴더에 한 번 만들어 둔다.
const SALT = process.env.HASH_SALT || (() => { let v = db.kvGet("salt"); if (!v) { v = crypto.randomBytes(16).toString("hex"); db.kvSet("salt", v); } return v; })();
const readBlocked = () => { try { return JSON.parse(db.kvGet("blocked") || "[]"); } catch { return []; } };
const writeBlocked = (list) => db.kvSet("blocked", JSON.stringify(list));
const ipHash = (req) => sha(SALT + ":" + ipOf(req));
// 차단은 두 가지로 한다: 로그인한 사용자는 계정 단위("u:번호"), 로그인하지 않은 경우는 접속 주소의 해시
const uidOf = (req) => accounts.userOf(req)?.id || null;
const senderBlocked = (req) => { const b = readBlocked(), u = uidOf(req); return b.includes(ipHash(req)) || (u != null && b.includes("u:" + u)); };
const ipOf = (req) => (TRUST_PROXY && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : req.socket.remoteAddress) || "?";

// ── 호출 제한: 같은 IP가 한 시간에 8통까지만 올릴 수 있다 ──
const hits = new Map();
function limited(ip, max = 8, windowMs = 3600 * 1000) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); return false;
}

// 만료된 편지·세션과 쓰지 않는 녹음 정리(시작할 때와 한 시간마다)
function purge() {
  const now = Date.now();
  db.purgeLetters(now); db.purgeSessions(now); db.purgeTokens(now);
  // 녹음: 만료됐거나, 올린 지 한 시간이 지났는데 살아 있는 편지가 하나도 쓰지 않으면 지운다
  for (const meta of db.allVoiceMeta()) {
    if (meta.expiresAt < now || (now - meta.createdAt > 3600 * 1000 && !meta.letters.some(liveLetter))) db.delVoice(meta.id);
  }
}
purge(); setInterval(purge, 3600 * 1000).unref();

const authed = (l, secret) => {
  if (!l || typeof secret !== "string" || !secret) return false;
  const a = Buffer.from(sha(secret)), b = Buffer.from(l.secretHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// 요청 본문 → 저장할 편지와 회수용 secret. 비어 있으면 null
function makeLetter(b, sh = null, uid = null) {
  const body = clean(b?.body, MAX_BODY), to = clean(b?.to, MAX_NAME), from = clean(b?.from, MAX_NAME) || "누군가";
  if (!body || !to) return null;
  const sc = screenText(body, to, from);                            // block이면 호출한 쪽에서 막고, review면 표시만 한다
  if (sc.level === "block") return { blocked: true };
  const days = Math.min(90, Math.max(1, Math.round(Number(b.expireDays) || 30)));
  const secret = crypto.randomBytes(16).toString("hex");
  const l = {
    id: newId(), secretHash: sha(secret), from, to, body,
    paper: PAPERS.has(b.paper) ? b.paper : "cream", grade: GRADES.has(b.grade) ? b.grade : "safe",
    gap: [1, 2, 3].includes(b.gap) ? b.gap : 1,
    scene: SCENES.has(b.scene) ? b.scene : "island",
    voice: typeof b.voice === "string" && validId(b.voice) && loadVoiceMeta(b.voice) ? b.voice : null,   // 올려 둔 녹음의 id
    createdAt: Date.now(), expiresAt: Date.now() + days * DAY, openedAt: null, opens: 0, reports: 0, reporters: [],
    sh, uid, flagged: sc.level === "review", flagWord: sc.word,
  };
  return { l, secret };
}

// 편지를 저장하고, 쓰는 녹음에 이 편지를 연결한다(녹음은 그 편지가 살아 있는 동안만 재생된다)
function saveLetter(l) {
  save(l);
  if (!l.voice) return;
  const meta = loadVoiceMeta(l.voice);
  if (meta) { meta.letters.push(l.id); db.putVoiceMeta(meta); }
}

// ── 녹음 ──
async function voices(req, res, parts) {
  const id = parts[2];
  if (req.method === "POST" && !id) {
    if (senderBlocked(req)) return send(res, 403, { error: "blocked_sender" });
    if (limited(ipOf(req) + ":voice", 12)) return send(res, 429, { error: "too_many" });
    const b = await readJson(req, 700 * 1024);
    const m = /^data:(audio\/(?:webm|mp4|ogg|mpeg|aac|x-m4a))(?:;[^,;]*)*;base64,([A-Za-z0-9+/=]+)$/.exec(typeof b.data === "string" ? b.data : "");
    if (!m) return send(res, 400, { error: "bad_voice" });
    const buf = Buffer.from(m[2], "base64");
    if (!buf.length || buf.length > MAX_VOICE) return send(res, 413, { error: "too_large" });
    const vid = newId();
    db.putVoice({ id: vid, mime: m[1], createdAt: Date.now(), expiresAt: Date.now() + 90 * DAY, letters: [] }, buf);
    return send(res, 201, { id: vid });
  }
  if (req.method === "GET" && id && validId(id)) {
    const meta = loadVoiceMeta(id);
    if (!meta || !meta.letters.some(voiceLive)) return send(res, 404, { error: "not_found" });
    const buf = db.getVoiceBin(id); if (!buf) return send(res, 404, { error: "not_found" });
    res.writeHead(200, { "Content-Type": meta.mime, "Content-Length": buf.length, "Cache-Control": "private, max-age=3600" });
    return res.end(buf);
  }
  return send(res, 404, { error: "not_found" });
}

// ── 관리자(ADMIN_TOKEN이 있을 때만) ──
// 신고가 들어왔거나 검토 대상으로 표시된 편지를 보고, 삭제·무시(신고 초기화)·발신자 차단을 한다. 토큰은 X-Admin-Token 헤더로 받는다.
async function admin(req, res, parts) {
  if (limited(ipOf(req) + ":admin", 60)) return send(res, 429, { error: "too_many" });
  const a = Buffer.from(sha(String(req.headers["x-admin-token"] || ""))), b = Buffer.from(sha(ADMIN_TOKEN));
  if (!crypto.timingSafeEqual(a, b)) return send(res, 403, { error: "forbidden" });
  if (req.method === "GET" && parts[2] === "queue") {
    const out = [];
    for (const l of db.allLetters()) {
      if (l.expiresAt > Date.now() && (l.reports > 0 || l.flagged)) out.push({ id: l.id, from: l.from, to: l.to, body: l.body, scene: l.scene, voice: !!l.voice, voiceBlocked: !!l.voiceBlocked, reports: l.reports, flagged: !!l.flagged, flagWord: l.flagWord, createdAt: l.createdAt, hidden: l.reports >= 3, senderBlocked: !!l.sh && readBlocked().includes(l.sh) });
    }
    return send(res, 200, { items: out.sort((x, y) => y.reports - x.reports || y.createdAt - x.createdAt) });
  }
  const id = parts[3], l = id && validId(id) ? load(id) : null;
  if (parts[2] !== "letters" || !l) return send(res, 404, { error: "not_found" });
  if (req.method === "DELETE") { remove(id); return send(res, 200, { ok: true }); }
  if (req.method === "POST" && parts[4] === "dismiss") { l.reports = 0; l.reporters = []; l.flagged = false; l.voiceBlocked = false; save(l); return send(res, 200, { ok: true }); }
  if (req.method === "POST" && parts[4] === "block-sender") {
    if (!l.sh && l.uid == null) return send(res, 400, { error: "no_sender_hash" });
    const list = readBlocked();
    for (const k of [l.uid != null ? "u:" + l.uid : null, l.sh]) if (k && !list.includes(k)) list.push(k);       // 계정이 있으면 계정을, 접속 주소도 함께 막는다
    writeBlocked(list);
    remove(id); return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "method" });
}
const ADMIN_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>나루 우체국 관리</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#1f3a4d}input{padding:8px;width:240px}button{padding:6px 12px;margin:2px;cursor:pointer}
.it{border:1px solid #cde;border-radius:12px;padding:12px 14px;margin:12px 0;background:#fafcfe}.it.hide{background:#fff1ee}.meta{color:#678;font-size:13px}pre{white-space:pre-wrap;margin:8px 0;font:inherit}</style>
<h2>나루 우체국 관리</h2><p class="meta">신고가 들어왔거나 검토 대상으로 표시된 편지입니다. 삭제하면 되돌릴 수 없습니다.</p>
<p><input id="t" type="password" placeholder="관리자 토큰"> <button id="go">불러오기</button> <span id="msg" class="meta"></span></p><div id="list"></div>
<script>
const $=(s)=>document.querySelector(s);let tok=sessionStorage.getItem("naru-admin")||"";$("#t").value=tok;
const api=async(m,p)=>{const r=await fetch("/api/admin/"+p,{method:m,headers:{"X-Admin-Token":tok}});if(!r.ok)throw new Error(r.status);return r.json()};
async function load(){tok=$("#t").value;sessionStorage.setItem("naru-admin",tok);$("#msg").textContent="";const box=$("#list");box.textContent="";
 try{const{items}=await api("GET","queue");$("#msg").textContent=items.length+"건";
  for(const it of items){const d=document.createElement("div");d.className="it"+(it.hidden?" hide":"");
   const m=document.createElement("div");m.className="meta";m.textContent=it.from+" → "+it.to+" · 신고 "+it.reports+"건"+(it.flagged?" · 검토 표시("+it.flagWord+")":"")+(it.voice?" · 녹음"+(it.voiceBlocked?"(재생 막힘)":""):"")+(it.hidden?" · 숨김":"")+" · "+new Date(it.createdAt).toLocaleString("ko-KR");
   const p=document.createElement("pre");p.textContent=it.body;d.append(m,p);
   for(const[label,method,path,ok]of[["삭제","DELETE","letters/"+it.id],["신고 무시","POST","letters/"+it.id+"/dismiss"],["발신자 차단+삭제","POST","letters/"+it.id+"/block-sender"]]){const b=document.createElement("button");b.textContent=label;
    b.onclick=async()=>{if(label!=="신고 무시"&&!confirm(label+"할까요?"))return;try{await api(method,path);load()}catch(e){$("#msg").textContent="실패: "+e.message}};d.append(b)}
   box.append(d)}}catch(e){$("#msg").textContent=e.message==="403"?"토큰이 맞지 않습니다":e.message==="404"?"관리자 기능을 쓸 수 없습니다":"오류: "+e.message}}
$("#go").onclick=load;if(tok)load();
</script>`;

// ── API ──
const accounts = makeAccounts({ db, send, readJson, limited, ipOf, mailer: makeMailer(DATA), onUserDeleted: removeLettersOf });
async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);          // ["api","letters",id?,sub?]
  if (parts[1] === "health") return send(res, 200, { ok: true, ...db.counts(), backup: db.kvGet("last_backup") || null });
  if (parts[1] === "auth" || parts[1] === "me") return accounts(req, res, parts, url);
  if (parts[1] === "voices") return voices(req, res, parts);
  if (parts[1] === "admin") return admin(req, res, parts);
  if (parts[1] === "moderate" && req.method === "POST") {           // 보내기 전에 글을 미리 검사한다(막힌 글은 비행 전에 고칠 수 있다)
    if (limited(ipOf(req) + ":moderate", 120)) return send(res, 429, { error: "too_many" });
    const b = await readJson(req);
    return send(res, 200, { ok: screenText(clean(b.body, MAX_BODY), clean(b.to, MAX_NAME)).level !== "block" });
  }
  if (parts[1] !== "letters") return send(res, 404, { error: "not_found" });
  const id = parts[2], sub = parts[3];

  if (req.method === "POST" && !id) {                              // 올리기
    if (senderBlocked(req)) return send(res, 403, { error: "blocked_sender" });
    if (limited(ipOf(req))) return send(res, 429, { error: "too_many" });
    const made = makeLetter(await readJson(req), ipHash(req), uidOf(req));
    if (!made) return send(res, 400, { error: "empty" });
    if (made.blocked) return send(res, 400, { error: "blocked" });
    saveLetter(made.l);
    return send(res, 201, { id: made.l.id, secret: made.secret, expiresAt: made.l.expiresAt });
  }
  if (req.method === "POST" && id === "batch" && !sub) {          // 여러 사람에게 한 번에 올리기: 하나라도 비어 있으면 하나도 올리지 않는다
    if (limited(ipOf(req))) return send(res, 429, { error: "too_many" });
    const b = await readJson(req, 64 * 1024);
    const list = Array.isArray(b.letters) ? b.letters : [];
    if (!list.length || list.length > MAX_BATCH) return send(res, 400, { error: "count" });
    if (senderBlocked(req)) return send(res, 403, { error: "blocked_sender" });
    const sh = ipHash(req), uid = uidOf(req), made = list.map((x) => makeLetter(x, sh, uid));
    if (made.some((m) => !m)) return send(res, 400, { error: "empty" });
    if (made.some((m) => m.blocked)) return send(res, 400, { error: "blocked" });
    made.forEach((m) => saveLetter(m.l));
    return send(res, 201, { letters: made.map((m) => ({ id: m.l.id, secret: m.secret, expiresAt: m.l.expiresAt })) });
  }

  if (!id || !validId(id)) return send(res, 404, { error: "not_found" });
  const l = load(id);
  if (!l) return send(res, 404, { error: "not_found" });
  if (l.expiresAt < Date.now()) { remove(id); return send(res, 410, { error: "expired" }); }

  if (req.method === "GET" && !sub) {                              // 받는 사람이 열기
    if (l.reports >= 3) return send(res, 410, { error: "hidden" });
    if (!l.openedAt) l.openedAt = Date.now();
    l.opens++; save(l);
    return send(res, 200, { from: l.from, to: l.to, body: l.body, paper: l.paper, grade: l.grade, gap: l.gap, scene: l.scene || "island", voice: l.voiceBlocked ? null : l.voice || null, createdAt: l.createdAt, expiresAt: l.expiresAt });
  }
  if (req.method === "GET" && sub === "status") {                  // 보낸 사람이 확인
    if (!authed(l, url.searchParams.get("secret"))) return send(res, 403, { error: "forbidden" });
    return send(res, 200, { opened: !!l.openedAt, openedAt: l.openedAt, opens: l.opens, reaction: l.reaction || null, expiresAt: l.expiresAt });
  }
  if (req.method === "DELETE" && !sub) {                           // 회수
    if (!authed(l, url.searchParams.get("secret"))) return send(res, 403, { error: "forbidden" });
    remove(id); return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && sub === "react") {                  // 받는 사람이 반응을 돌려보낸다(하나만, 바꿀 수 있다)
    if (limited(ipOf(req) + ":react", 30)) return send(res, 429, { error: "too_many" });
    const b = await readJson(req);
    if (!REACTIONS.has(b.kind) || l.reports >= 3) return send(res, 400, { error: "bad_reaction" });
    l.reaction = b.kind; l.reactedAt = Date.now(); save(l);
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && sub === "report") {                 // 신고: 같은 사람은 몇 번을 눌러도 1건. 3명이면 편지가 숨겨지고, 녹음은 첫 신고에 재생부터 막는다
    if (limited(ipOf(req) + ":report", 20)) return send(res, 429, { error: "too_many" });
    const h = ipHash(req);
    l.reporters ||= [];
    if (!l.reporters.includes(h)) l.reporters.push(h);
    l.reports = l.reporters.length;
    if (l.voice) l.voiceBlocked = true;
    save(l); return send(res, 200, { ok: true });
  }
  return send(res, 405, { error: "method" });
}

// ── 정적 파일(빌드한 웹): 서버 하나로 웹까지 함께 낸다. /l/:id 같은 주소는 index.html로 보낸다 ──
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };
function serveStatic(req, res, url) {
  if (!fs.existsSync(DIST)) return send(res, 404, { error: "no_build" });
  let p = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!p.startsWith(DIST)) return send(res, 403, { error: "forbidden" });                      // 경로 탈출 방지
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": p.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" });
  fs.createReadStream(p).pipe(res);
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/admin") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); return res.end(ADMIN_PAGE); }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    send(res, e.status || 500, { error: e.status ? e.message : "server_error" });
    if (!e.status) console.error(e);
  }
});
server.listen(PORT, () => console.log(`우편 서버: http://127.0.0.1:${PORT}  (저장: ${db.file})`));

// ── 예전 파일 저장(편지당 JSON)을 쓰던 데이터가 있으면 한 번 DB로 옮기고 legacy/ 폴더로 치운다 ──
(function migrateLegacy() {
  const files = fs.readdirSync(DATA);
  const letters = files.filter((f) => /^[A-Za-z0-9_-]{12}\.json$/.test(f)), metas = files.filter((f) => /^voice-[A-Za-z0-9_-]{12}\.json$/.test(f));
  if (!letters.length && !metas.length && !files.includes("blocked.json")) return;
  const dir = path.join(DATA, "legacy"); fs.mkdirSync(dir, { recursive: true });
  const mv = (f) => { try { fs.renameSync(path.join(DATA, f), path.join(dir, f)); } catch { /* 이미 옮김 */ } };
  db.tx(() => {
    for (const f of letters) { try { const l = JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")); if (!db.getLetter(l.id)) db.putLetter(l); } catch { /* 깨진 파일은 건너뜀 */ } }
    for (const f of metas) { try { const m = JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")); const bin = fs.readFileSync(path.join(DATA, f.replace(/\.json$/, ".bin"))); if (!db.getVoiceMeta(m.id)) db.putVoice(m, bin); } catch { /* 건너뜀 */ } }
    if (files.includes("blocked.json")) { try { const old = JSON.parse(fs.readFileSync(path.join(DATA, "blocked.json"), "utf8")); writeBlocked([...new Set([...readBlocked(), ...old])]); } catch { /* 건너뜀 */ } }
  });
  files.filter((f) => letters.includes(f) || metas.includes(f) || /^voice-.*\.bin$/.test(f) || f === "blocked.json").forEach(mv);
  console.log(`예전 파일 데이터를 DB로 옮겼습니다(편지 ${letters.length}통, 녹음 ${metas.length}개). 원본은 ${dir} 에 있습니다.`);
})();

// ── 백업: 시작할 때 한 번, 그다음 주기마다. 영구 디스크가 아닌 곳이라면 BACKUP_DIR을 다른 디스크나 클라우드 마운트로 두는 것이 안전하다 ──
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA, "backups");
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP) || 14;
async function runBackup() {
  try { const f = await db.backupTo(BACKUP_DIR, BACKUP_KEEP); db.kvSet("last_backup", new Date().toISOString()); console.log(`백업을 만들었습니다: ${f}`); }
  catch (e) { console.error("백업 실패:", e.message); }
}
runBackup();
setInterval(runBackup, (Number(process.env.BACKUP_EVERY_HOURS) || 24) * 3600 * 1000).unref();

// 재시작·종료 신호를 받으면 쓰던 요청을 마치고 DB를 깨끗하게 닫는다(배포·재시작에서 데이터가 깨지지 않게)
function shutdown() { server.close(); db.close(); process.exit(0); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
