import { createLetter, createLetters, uploadVoice, letterUrl } from "./api.js";
import { loadVoice, deleteVoice } from "./party/audio.js";

// 링크로 보낼 편지(들)를 서버에 올린다. 녹음이 있으면(기기에 저장해 둔 사본) 먼저 올려 id를 받고, 그 id와 도착 장면(scene)을 편지와 함께 올린다.
// 여러 사람이면 한 번에 올리고(같은 녹음을 함께 쓴다), 성공하면 올린 녹음의 기기 안 사본은 지운다. 실패하면 예외를 던지고 사본은 남겨 둔다(편지함에서 다시 올릴 수 있다).
// 반환: { rs: 서버가 준 [{ id, secret, expiresAt }…], links: [{ to, url }…] }
export async function uploadLetters(list) {
  const key = list[0].voiceKey || list[0].id;
  let voice = null;
  if (list[0].hasVoice) { const url = loadVoice(key); if (url) voice = (await uploadVoice(url)).id; }
  const payload = (e) => ({ from: e.fromName, to: e.to, body: e.body, paper: e.paper, grade: e.grade, gap: e.gap, expireDays: e.expireDays, scene: e.scene, voice });
  const rs = list.length === 1 ? [await createLetter(payload(list[0]))] : (await createLetters(list.map(payload))).letters;
  if (voice) deleteVoice(key);
  return { rs, links: list.map((e, i) => ({ to: e.to, url: letterUrl(rs[i].id) })) };
}
