// 수동 백업: npm run backup  (DATA_DIR, BACKUP_DIR, BACKUP_KEEP 환경변수는 서버와 같다)
// 복원: 서버를 멈추고 백업 파일을 DATA_DIR/naru.db 로 복사한 뒤(naru.db-wal, naru.db-shm 파일은 지운다) 다시 시작한다.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR || path.join(here, "data");
const db = openDb(DATA);
const dest = await db.backupTo(process.env.BACKUP_DIR || path.join(DATA, "backups"), Number(process.env.BACKUP_KEEP) || 14);
console.log("백업을 만들었습니다:", dest);
db.close();
