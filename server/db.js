// 나루 우체국 저장소: SQLite 파일 하나(naru.db)에 편지·녹음·계정·진행 기록을 모두 담는다. Node 내장(node:sqlite)이라 외부 패키지가 필요 없다.
// 파일 하나라서 복사만 하면 백업이 되고, WAL 모드라서 쓰는 도중에 서버가 꺼져도 깨지지 않는다.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

export function openDb(DATA) {
  fs.mkdirSync(DATA, { recursive: true });
  const file = path.join(DATA, "naru.db");
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS letters (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS letters_exp ON letters (expires_at);
    CREATE TABLE IF NOT EXISTS voices (id TEXT PRIMARY KEY, meta TEXT NOT NULL, bin BLOB NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, nick TEXT NOT NULL UNIQUE COLLATE NOCASE, pass TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
    CREATE TABLE IF NOT EXISTS states (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS identities (provider TEXT NOT NULL, sub TEXT NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (provider, sub));
    CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id INTEGER, data TEXT, expires_at INTEGER NOT NULL);
  `);
  // 예전 DB에 없는 열을 더한다(이메일은 선택, 인증된 것만 서로 겹치지 못한다)
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes("email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  if (!cols.includes("nick_set")) db.exec("ALTER TABLE users ADD COLUMN nick_set INTEGER NOT NULL DEFAULT 1");   // 0이면 소셜로 막 가입해서 아직 닉네임을 정하지 않은 계정
  if (!cols.includes("email_verified")) db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_verified ON users (email COLLATE NOCASE) WHERE email_verified = 1");
  const q = (sql) => db.prepare(sql);
  const st = {
    getLetter: q("SELECT data FROM letters WHERE id = ?"), putLetter: q("INSERT INTO letters (id, data, expires_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at"),
    delLetter: q("DELETE FROM letters WHERE id = ?"), allLetters: q("SELECT data FROM letters"), expLetters: q("DELETE FROM letters WHERE expires_at < ?"),
    getVoice: q("SELECT meta FROM voices WHERE id = ?"), getVoiceBin: q("SELECT bin FROM voices WHERE id = ?"),
    putVoice: q("INSERT INTO voices (id, meta, bin, expires_at) VALUES (?, ?, ?, ?)"), putVoiceMeta: q("UPDATE voices SET meta = ? WHERE id = ?"),
    delVoice: q("DELETE FROM voices WHERE id = ?"), allVoices: q("SELECT meta FROM voices"),
    kvGet: q("SELECT v FROM kv WHERE k = ?"), kvSet: q("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v"),
    userByNick: q("SELECT * FROM users WHERE nick = ?"), userById: q("SELECT id, nick, nick_set, email, email_verified, (pass <> '') AS has_pass, created_at FROM users WHERE id = ?"),
    userByEmail: q("SELECT * FROM users WHERE email = ? COLLATE NOCASE AND email_verified = 1"), setEmail: q("UPDATE users SET email = ?, email_verified = ? WHERE id = ?"), setNick: q("UPDATE users SET nick = ?, nick_set = 1 WHERE id = ?"), addUserTemp: q("INSERT INTO users (nick, pass, salt, created_at, nick_set) VALUES (?, '', '', ?, 0)"), setPass: q("UPDATE users SET pass = ?, salt = ? WHERE id = ?"), userRow: q("SELECT * FROM users WHERE id = ?"),
    identity: q("SELECT user_id FROM identities WHERE provider = ? AND sub = ?"), addIdentity: q("INSERT OR IGNORE INTO identities (provider, sub, user_id) VALUES (?, ?, ?)"), identitiesOf: q("SELECT provider FROM identities WHERE user_id = ?"), delIdentities: q("DELETE FROM identities WHERE user_id = ?"), delIdentity: q("DELETE FROM identities WHERE provider = ? AND user_id = ?"),
    addToken: q("INSERT INTO tokens (hash, kind, user_id, data, expires_at) VALUES (?, ?, ?, ?, ?)"), getToken: q("SELECT * FROM tokens WHERE hash = ? AND kind = ?"), delToken: q("DELETE FROM tokens WHERE hash = ?"), delUserTokens: q("DELETE FROM tokens WHERE user_id = ? AND kind = ?"), expTokens: q("DELETE FROM tokens WHERE expires_at < ?"),
    delOtherSessions: q("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?"),
    addUser: q("INSERT INTO users (nick, pass, salt, created_at) VALUES (?, ?, ?, ?)"), delUser: q("DELETE FROM users WHERE id = ?"),
    addSession: q("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"), getSession: q("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?"),
    delSession: q("DELETE FROM sessions WHERE token_hash = ?"), delUserSessions: q("DELETE FROM sessions WHERE user_id = ?"), expSessions: q("DELETE FROM sessions WHERE expires_at < ?"),
    getState: q("SELECT data, updated_at FROM states WHERE user_id = ?"),
    putState: q("INSERT INTO states (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"),
    delState: q("DELETE FROM states WHERE user_id = ?"), count: q("SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM letters) AS letters, (SELECT COUNT(*) FROM voices) AS voices"),
  };
  const parse = (row, key) => (row ? JSON.parse(row[key]) : null);
  const tx = (fn) => { db.exec("BEGIN IMMEDIATE"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };
  return {
    file, raw: db, tx,
    getLetter: (id) => parse(st.getLetter.get(id), "data"), putLetter: (l) => st.putLetter.run(l.id, JSON.stringify(l), l.expiresAt), delLetter: (id) => st.delLetter.run(id),
    allLetters: () => st.allLetters.all().map((r) => JSON.parse(r.data)), purgeLetters: (now) => st.expLetters.run(now),
    getVoiceMeta: (id) => parse(st.getVoice.get(id), "meta"), getVoiceBin: (id) => { const r = st.getVoiceBin.get(id); return r ? Buffer.from(r.bin) : null; },
    putVoice: (meta, buf) => st.putVoice.run(meta.id, JSON.stringify(meta), buf, meta.expiresAt), putVoiceMeta: (meta) => st.putVoiceMeta.run(JSON.stringify(meta), meta.id),
    delVoice: (id) => st.delVoice.run(id), allVoiceMeta: () => st.allVoices.all().map((r) => JSON.parse(r.meta)),
    kvGet: (k) => { const r = st.kvGet.get(k); return r ? r.v : null; }, kvSet: (k, v) => st.kvSet.run(k, v),
    userByNick: (n) => st.userByNick.get(n) || null, userById: (id) => st.userById.get(id) || null,
    addUser: (nick, pass, salt) => Number(st.addUser.run(nick, pass, salt, Date.now()).lastInsertRowid),
    deleteUser: (id) => tx(() => { st.delUserSessions.run(id); st.delState.run(id); st.delIdentities.run(id); ["reset", "verify"].forEach((k) => st.delUserTokens.run(id, k)); st.delUser.run(id); }),
    addTempUser: (nick) => Number(st.addUserTemp.run(nick, Date.now()).lastInsertRowid),
    userByEmail: (e) => st.userByEmail.get(e) || null, setEmail: (id, email, verified) => st.setEmail.run(email, verified ? 1 : 0, id), setNick: (id, nick) => st.setNick.run(nick, id), setPass: (id, pass, salt) => st.setPass.run(pass, salt, id), userRow: (id) => st.userRow.get(id) || null,
    unlinkIdentity: (p, uid) => st.delIdentity.run(p, uid),
    identity: (p, sub) => st.identity.get(p, sub)?.user_id ?? null, addIdentity: (p, sub, uid) => st.addIdentity.run(p, sub, uid), identitiesOf: (uid) => st.identitiesOf.all(uid).map((r) => r.provider),
    addToken: (hash, kind, uid, data, exp) => st.addToken.run(hash, kind, uid ?? null, data ? JSON.stringify(data) : null, exp),
    takeToken: (hash, kind) => { const t = st.getToken.get(hash, kind); if (!t) return null; st.delToken.run(hash); return t.expires_at < Date.now() ? null : { userId: t.user_id, data: t.data ? JSON.parse(t.data) : null }; },
    dropUserTokens: (uid, kind) => st.delUserTokens.run(uid, kind), purgeTokens: (now) => st.expTokens.run(now), deleteUserSessions: (uid) => st.delUserSessions.run(uid), delOtherSessions: (uid, keepHash) => st.delOtherSessions.run(uid, keepHash),
    addSession: (hash, uid, exp) => st.addSession.run(hash, uid, exp), getSession: (hash) => st.getSession.get(hash) || null,
    delSession: (hash) => st.delSession.run(hash), purgeSessions: (now) => st.expSessions.run(now),
    getState: (uid) => { const r = st.getState.get(uid); return r ? { data: JSON.parse(r.data), updatedAt: r.updated_at } : null; },
    putState: (uid, data) => st.putState.run(uid, JSON.stringify(data), Date.now()),
    counts: () => st.count.get(),
    // 백업: 쓰는 도중에도 일관된 사본을 만든다(SQLite 백업 API). 오래된 백업은 keep개만 남기고 지운다.
    backupTo: async (dir, keep = 14) => {
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
      const dest = path.join(dir, `naru-${stamp}.db`);
      await backup(db, dest);
      const all = fs.readdirSync(dir).filter((f) => /^naru-.*\.db$/.test(f)).sort();
      for (const f of all.slice(0, Math.max(0, all.length - keep))) fs.unlinkSync(path.join(dir, f));
      return dest;
    },
    close: () => { try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); db.close(); } catch { /* 이미 닫힘 */ } },
  };
}
