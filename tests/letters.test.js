import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { startServer, tmpDir } from "./helpers.js";

// 링크 편지: 올리기·열기·읽음·반응·회수·녹음·신고·관리자·재시작 뒤 유지·예전 파일 데이터 이전·백업
let S, dir;
before(async () => {
  dir = tmpDir("letters");
  const now = Date.now();                                                    // 예전 방식(편지당 JSON 파일)을 미리 두어 이전도 시험한다
  fs.writeFileSync(path.join(dir, "oldLetter001.json"), JSON.stringify({ id: "oldLetter001", secretHash: "x", from: "옛", to: "편지", body: "옛 파일 편지", paper: "cream", grade: "safe", gap: 1, scene: "island", voice: null, createdAt: now, expiresAt: now + 86400000, openedAt: null, opens: 0, reports: 0, reporters: [], sh: null }));
  S = await startServer({}, dir);
});
after(() => S.stop());
const mk = (extra = {}) => S.call("POST", "/api/letters", { from: "민수", to: "엄마", body: "요즘 잘 지내세요?", paper: "cream", grade: "safe", gap: 1, expireDays: 7, ...extra });
const b64 = (s) => "data:audio/webm;base64," + Buffer.from(s).toString("base64");

test("예전 파일 편지를 DB로 옮기고 원본은 legacy로 치운다", async () => {
  assert.equal((await S.call("GET", "/api/letters/oldLetter001")).json.body, "옛 파일 편지");
  assert.ok(fs.existsSync(path.join(dir, "legacy", "oldLetter001.json")));
  assert.ok(fs.existsSync(path.join(dir, "naru.db")));
});
test("health가 저장 상태를 알려 준다", async () => { const r = await S.call("GET", "/api/health"); assert.equal(r.json.ok, true); assert.ok(r.json.backup); });
test("올리기 → 열기 → 읽음 확인 → 반응 → 회수", async () => {
  const L = await mk(); assert.equal(L.status, 201);
  assert.equal((await S.call("GET", `/api/letters/${L.json.id}`)).json.body, "요즘 잘 지내세요?");
  assert.equal((await S.call("GET", `/api/letters/${L.json.id}/status?secret=${L.json.secret}`)).json.opened, true);
  assert.equal((await S.call("GET", `/api/letters/${L.json.id}/status?secret=틀림`)).status, 403);
  assert.equal((await S.call("POST", `/api/letters/${L.json.id}/react`, { kind: "heart" })).status, 200);
  assert.equal((await S.call("DELETE", `/api/letters/${L.json.id}?secret=${L.json.secret}`)).status, 200);
  assert.equal((await S.call("GET", `/api/letters/${L.json.id}`)).status, 404);
});
test("빈 편지는 거부하고, 글 검사는 통과하는 글에 ok를 준다", async () => {
  assert.equal((await mk({ body: "" })).status, 400);
  assert.equal((await S.call("POST", "/api/moderate", { to: "엄마", body: "안녕" })).json.ok, true);
});
test("여러 사람에게 한 번에 보내기(하나라도 비면 하나도 올리지 않는다)", async () => {
  const r = await S.call("POST", "/api/letters/batch", { letters: [{ to: "가", body: "하나" }, { to: "나", body: "둘" }] });
  assert.equal(r.status, 201); assert.equal(r.json.letters.length, 2);
  assert.equal((await S.call("POST", "/api/letters/batch", { letters: [{ to: "가", body: "하나" }, { to: "", body: "" }] })).status, 400);
});
test("녹음: 올리기 → 재생, 편지를 거두면 녹음도 바로 지워진다", async () => {
  const V = await S.call("POST", "/api/voices", { data: b64("fakeaudio") });
  const L = await mk({ voice: V.json.id });
  const r = await fetch(`${S.base}/api/voices/${V.json.id}`);
  assert.equal(r.status, 200); assert.equal(Buffer.from(await r.arrayBuffer()).toString(), "fakeaudio");
  await S.call("DELETE", `/api/letters/${L.json.id}?secret=${L.json.secret}`);
  assert.equal((await fetch(`${S.base}/api/voices/${V.json.id}`)).status, 404);
  const db = new DatabaseSync(path.join(dir, "naru.db"), { readOnly: true });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM voices WHERE id = ?").get(V.json.id).n, 0);       // 파일까지 지워졌다
  db.close();
});
test("신고하면 녹음 재생이 먼저 막히고, 관리자가 보고 지울 수 있다", async () => {
  const V = await S.call("POST", "/api/voices", { data: b64("aud") });
  const L = await mk({ voice: V.json.id });
  assert.equal((await S.call("POST", `/api/letters/${L.json.id}/report`)).status, 200);
  assert.equal((await fetch(`${S.base}/api/voices/${V.json.id}`)).status, 404);
  const token = fs.readFileSync(path.join(dir, ".admin-token"), "utf8").trim();
  assert.equal((await S.call("GET", "/api/admin/queue")).status, 403);
  const q = await S.call("GET", "/api/admin/queue", null, null, { "X-Admin-Token": token });
  assert.ok(q.json.items.some((i) => i.id === L.json.id));
  assert.equal((await S.call("DELETE", `/api/admin/letters/${L.json.id}`, null, null, { "X-Admin-Token": token })).status, 200);
});
test("백업이 만들어지고, 서버를 다시 켜도 데이터와 관리자 토큰이 남는다", async () => {
  const L = await mk({ body: "재시작 전" });
  assert.ok(fs.readdirSync(path.join(dir, "backups")).some((f) => /^naru-.*\.db$/.test(f)));
  const token = fs.readFileSync(path.join(dir, ".admin-token"), "utf8").trim();
  S = await S.restart();
  assert.equal((await S.call("GET", `/api/letters/${L.json.id}`)).json.body, "재시작 전");
  assert.equal(fs.readFileSync(path.join(dir, ".admin-token"), "utf8").trim(), token);
});
