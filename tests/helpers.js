// 테스트 도우미: 서버를 임시 폴더·빈 포트로 띄우고, 가짜 메일 서버와 가짜 구글(소셜 제공자)을 만든다.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
export const tmpDir = (name) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `naru-${name}-`)); return d; };
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startServer(env = {}, dir = tmpDir("srv")) {
  const port = await freePort();
  let out = "";
  const proc = spawn(process.execPath, ["server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: dir, PUBLIC_URL: `http://127.0.0.1:${port}`, ...env } });
  proc.stdout.on("data", (d) => (out += d)); proc.stderr.on("data", (d) => (out += d));
  await new Promise((res, rej) => { const t0 = Date.now(), i = setInterval(() => { if (/우편 서버/.test(out)) { clearInterval(i); res(); } else if (Date.now() - t0 > 15000) { clearInterval(i); rej(new Error("서버가 시작되지 않았어요: " + out)); } }, 50); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, p, body, token, extra = {}) => {
    const r = await fetch(base + p, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch { /* 본문 없음 */ }
    return { status: r.status, json, location: r.headers.get("location") };
  };
  const stop = () => new Promise((r) => { proc.once("exit", r); proc.kill("SIGTERM"); setTimeout(r, 3000); });
  return { base, port, dir, call, stop, output: () => out, restart: async () => { await stop(); return startServer(env, dir); } };
}

// 가짜 메일 API(받은 메일을 모아 둔다)
export async function fakeMail() {
  const mails = [];
  const srv = http.createServer((q, r) => { let b = ""; q.on("data", (c) => (b += c)); q.on("end", () => { mails.push({ auth: q.headers.authorization, ...JSON.parse(b) }); r.writeHead(200, { "Content-Type": "application/json" }); r.end("{}"); }); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  return { mails, url: `http://127.0.0.1:${port}/emails`, close: () => srv.close(), last: async (to) => { for (let i = 0; i < 40; i++) { const m = [...mails].reverse().find((x) => x.to?.[0] === to); if (m) return m; await wait(50); } return null; } };
}

// 가짜 구글: 토큰과 사용자 정보를 돌려준다. profile을 바꾸면 다음 로그인부터 다른 사람이 된다.
export async function fakeGoogle() {
  const g = { profile: { sub: "g-1", name: "구글사람", email: "g@example.com", email_verified: true } };
  const srv = http.createServer((q, r) => {
    const j = (o) => { r.writeHead(200, { "Content-Type": "application/json" }); r.end(JSON.stringify(o)); };
    if (q.url.startsWith("/token")) return j({ access_token: "AT" });
    if (q.url.startsWith("/info")) return j(q.headers.authorization === "Bearer AT" ? g.profile : {});
    r.writeHead(404); r.end();
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const p = srv.address().port;
  return { g, env: { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "sec", GOOGLE_AUTH_URL: `http://127.0.0.1:${p}/auth`, GOOGLE_TOKEN_URL: `http://127.0.0.1:${p}/token`, GOOGLE_USERINFO_URL: `http://127.0.0.1:${p}/info` }, close: () => srv.close() };
}
