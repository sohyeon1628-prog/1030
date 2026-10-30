// 나루 우체국 — 링크로 편지 보내기 서버. 외부 패키지 없이 Node만으로 동작한다.
//   POST   /api/letters              편지를 올리고 링크용 id와 회수용 secret을 받는다
//   POST   /api/letters/batch        같은 편지를 여러 사람에게: { letters: [편지…] } (최대 10통, 호출 제한은 한 번으로 센다)
//   GET    /api/letters/:id          받는 사람이 편지를 연다(처음 열면 '읽음'으로 기록)
//   GET    /api/letters/:id/status   보낸 사람이 읽혔는지 확인(secret 필요)
//   DELETE /api/letters/:id          보낸 사람이 회수(secret 필요)
//   POST   /api/letters/:id/report   신고(3번 쌓이면 숨김)
// 저장: DATA_DIR(기본 server/data)에 편지당 JSON 파일 하나. secret은 해시만 저장한다.
// 실행: npm run server  (PORT, DATA_DIR, ALLOW_ORIGIN, TRUST_PROXY 환경변수)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const DATA = process.env.DATA_DIR || path.join(here, "data");
const DIST = path.join(here, "..", "dist");
const ORIGINS = (process.env.ALLOW_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);   // 앱(다른 출처)에서 호출할 때
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
fs.mkdirSync(DATA, { recursive: true });

const PAPERS = new Set(["cream", "mint", "coral", "star", "gold"]);
const GRADES = new Set(["perfect", "safe", "rough"]);
const DAY = 86400 * 1000;
const MAX_BODY = 800, MAX_NAME = 20, MAX_BATCH = 10;

// ── 유틸 ──
const file = (id) => path.join(DATA, `${id}.json`);
const validId = (id) => /^[A-Za-z0-9_-]{12}$/.test(id);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newId = () => crypto.randomBytes(9).toString("base64url");           // 12자, 추측할 수 없다(72비트)
const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "");
const load = (id) => { try { return JSON.parse(fs.readFileSync(file(id), "utf8")); } catch { return null; } };
const save = (l) => { const tmp = file(l.id) + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(l)); fs.renameSync(tmp, file(l.id)); };   // 쓰다 끊겨도 깨지지 않게
const remove = (id) => { try { fs.unlinkSync(file(id)); } catch { /* 이미 없음 */ } };

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
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
const ipOf = (req) => (TRUST_PROXY && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : req.socket.remoteAddress) || "?";

// ── 호출 제한: 같은 IP가 한 시간에 8통까지만 올릴 수 있다 ──
const hits = new Map();
function limited(ip, max = 8, windowMs = 3600 * 1000) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); return false;
}

// 만료된 편지 정리(시작할 때와 한 시간마다)
function purge() {
  const now = Date.now();
  for (const f of fs.readdirSync(DATA)) {
    if (!f.endsWith(".json")) continue;
    const l = load(f.slice(0, -5));
    if (!l || l.expiresAt < now) remove(f.slice(0, -5));
  }
}
purge(); setInterval(purge, 3600 * 1000).unref();

const authed = (l, secret) => {
  if (!l || typeof secret !== "string" || !secret) return false;
  const a = Buffer.from(sha(secret)), b = Buffer.from(l.secretHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// 요청 본문 → 저장할 편지와 회수용 secret. 비어 있으면 null
function makeLetter(b) {
  const body = clean(b?.body, MAX_BODY), to = clean(b?.to, MAX_NAME), from = clean(b?.from, MAX_NAME) || "누군가";
  if (!body || !to) return null;
  const days = Math.min(90, Math.max(1, Math.round(Number(b.expireDays) || 30)));
  const secret = crypto.randomBytes(16).toString("hex");
  const l = {
    id: newId(), secretHash: sha(secret), from, to, body,
    paper: PAPERS.has(b.paper) ? b.paper : "cream", grade: GRADES.has(b.grade) ? b.grade : "safe",
    gap: [1, 2, 3].includes(b.gap) ? b.gap : 1,
    createdAt: Date.now(), expiresAt: Date.now() + days * DAY, openedAt: null, opens: 0, reports: 0,
  };
  return { l, secret };
}

// ── API ──
async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);          // ["api","letters",id?,sub?]
  if (parts[1] !== "letters") return send(res, 404, { error: "not_found" });
  const id = parts[2], sub = parts[3];

  if (req.method === "POST" && !id) {                              // 올리기
    if (limited(ipOf(req))) return send(res, 429, { error: "too_many" });
    const made = makeLetter(await readJson(req));
    if (!made) return send(res, 400, { error: "empty" });
    save(made.l);
    return send(res, 201, { id: made.l.id, secret: made.secret, expiresAt: made.l.expiresAt });
  }
  if (req.method === "POST" && id === "batch" && !sub) {          // 여러 사람에게 한 번에 올리기: 하나라도 비어 있으면 하나도 올리지 않는다
    if (limited(ipOf(req))) return send(res, 429, { error: "too_many" });
    const b = await readJson(req, 64 * 1024);
    const list = Array.isArray(b.letters) ? b.letters : [];
    if (!list.length || list.length > MAX_BATCH) return send(res, 400, { error: "count" });
    const made = list.map(makeLetter);
    if (made.some((m) => !m)) return send(res, 400, { error: "empty" });
    made.forEach((m) => save(m.l));
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
    return send(res, 200, { from: l.from, to: l.to, body: l.body, paper: l.paper, grade: l.grade, gap: l.gap, createdAt: l.createdAt, expiresAt: l.expiresAt });
  }
  if (req.method === "GET" && sub === "status") {                  // 보낸 사람이 확인
    if (!authed(l, url.searchParams.get("secret"))) return send(res, 403, { error: "forbidden" });
    return send(res, 200, { opened: !!l.openedAt, openedAt: l.openedAt, opens: l.opens, expiresAt: l.expiresAt });
  }
  if (req.method === "DELETE" && !sub) {                           // 회수
    if (!authed(l, url.searchParams.get("secret"))) return send(res, 403, { error: "forbidden" });
    remove(id); return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && sub === "report") {                 // 신고
    if (limited(ipOf(req) + ":report", 20)) return send(res, 429, { error: "too_many" });
    l.reports++; save(l); return send(res, 200, { ok: true });
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

http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    send(res, e.status || 500, { error: e.status ? e.message : "server_error" });
    if (!e.status) console.error(e);
  }
}).listen(PORT, () => console.log(`우편 서버: http://127.0.0.1:${PORT}  (저장: ${DATA})`));
