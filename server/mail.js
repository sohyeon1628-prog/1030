// 메일 보내기(비밀번호 찾기, 이메일 인증). 외부 패키지 없이 HTTP 메일 API(기본 Resend)로 보낸다.
//   RESEND_API_KEY, MAIL_FROM(예: "나루 우체국 <noreply@내도메인>") 이 있으면 실제로 보낸다. MAIL_API_URL로 다른 호환 서비스·테스트 서버를 쓸 수 있다.
//   없으면 개발 모드: 보내지 않고 콘솔과 DATA_DIR/outbox.log에 내용(링크)을 남긴다. 운영에서는 반드시 설정해야 한다.
import fs from "node:fs";
import path from "node:path";

export function makeMailer(DATA) {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM, url = process.env.MAIL_API_URL || "https://api.resend.com/emails";
  const live = !!(key && from);
  async function send({ to, subject, text }) {
    if (!live) {
      const line = `[${new Date().toISOString()}] to=${to} subject=${subject}\n${text}\n\n`;
      console.log("(개발 모드: 메일을 보내지 않고 기록만 합니다)\n" + line);
      try { fs.appendFileSync(path.join(DATA, "outbox.log"), line); } catch { /* 기록 실패는 무시 */ }
      return { sent: false };
    }
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ from, to: [to], subject, text }) });
    if (!r.ok) throw new Error("mail_failed:" + r.status);
    return { sent: true };
  }
  return { live, send };
}
