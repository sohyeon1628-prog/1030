import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 편지 글 검사: 단어 목록(blocklist.json)과 비교한다. 외부 서비스는 쓰지 않는다.
// 띄어쓰기·특수문자·대소문자 변형("시 발", "씨.발")을 무시하려고 글자와 숫자만 남겨 비교하고, 정상 단어(allow)는 먼저 지운다("시발점").
// 한계: 목록에 없는 표현과 돌려 말하는 표현은 거르지 못한다. 신고와 관리자 검토(/admin)가 함께 있어야 한다.
const here = path.dirname(fileURLToPath(import.meta.url));
const norm = (t) => String(t ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

let lists = { block: [], review: [], allow: [] };
export function loadBlocklist(file = path.join(here, "blocklist.json")) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    lists = { block: (j.block || []).map(norm).filter(Boolean), review: (j.review || []).map(norm).filter(Boolean), allow: (j.allow || []).map(norm).filter(Boolean) };
  } catch { lists = { block: [], review: [], allow: [] }; }       // 목록이 없거나 깨져도 서버는 계속 동작한다(검사만 못 한다)
}
loadBlocklist();

// 여러 글(받는 사람·본문…)을 각각 검사한다(글 사이에서 단어가 이어져 오탐이 나지 않게). 반환: { level: "ok" | "review" | "block", word }
export function screenText(...texts) {
  let review = null;
  for (const t of texts) {
    let n = norm(t);
    for (const a of lists.allow) n = n.split(a).join("");
    const b = lists.block.find((w) => n.includes(w));
    if (b) return { level: "block", word: b };
    review ||= lists.review.find((w) => n.includes(w)) || null;
  }
  return review ? { level: "review", word: review } : { level: "ok", word: null };
}
