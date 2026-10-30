import React, { useEffect, useState } from "react";
import { GRADE_NAME } from "../data/letters.js";
import { PAPERS } from "../data/story.js";
import { getStatus, deleteLetter, letterUrl } from "../api.js";
import Icon from "./Icon.jsx";
import PartyScene from "./PartyScene.jsx";
import { loadVoice } from "../party/audio.js";

function remain(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.ceil(s / 60)}분`;
  if (s < 86400) return `${Math.ceil(s / 3600)}시간`;
  return `${Math.ceil(s / 86400)}일`;
}
const fmt = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
const isGone = (e) => e.status === 404 || e.status === 410;

// 편지함: 날아가는 중인 편지, 도착한 편지, 링크로 보낸 편지(읽음 확인·복사·회수), 모은 우표와 구슬
export default function MailboxScreen({ orbsTotal = 0, mine, grades, focusId = null, onBack, onRetry, onPatch, onDeleteVoice }) {
  const [now, setNow] = useState(Date.now());
  const [openId, setOpenId] = useState(null);
  const [partyId, setPartyId] = useState(focusId);   // 파티 장면을 먼저 보여 줄 편지
  const [replay, setReplay] = useState(false);       // 편지를 읽은 뒤 파티를 다시 볼 때
  const [st, setSt] = useState({});            // 링크 편지 id → { opened } | { gone }
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // 링크로 보낸 편지가 읽혔는지 확인한다
  useEffect(() => {
    let alive = true;
    mine.filter((m) => m.share && !m.share.revoked).forEach((m) => {
      getStatus(m.share.id, m.share.secret)
        .then((r) => alive && setSt((s) => ({ ...s, [m.id]: { opened: r.opened } })))
        .catch((e) => { if (alive && isGone(e)) setSt((s) => ({ ...s, [m.id]: { gone: true } })); });
    });
    return () => { alive = false; };
  }, [mine.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (m) => {
    const url = letterUrl(m.share.id);
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("링크를 복사하세요", url); }
    setCopied(m.id); setTimeout(() => setCopied(null), 1600);
  };
  const revoke = async (m) => {
    if (!window.confirm("이 편지를 거두어 올까요? 링크를 받은 사람은 더 이상 열 수 없어요.")) return;
    try { await deleteLetter(m.share.id, m.share.secret); onPatch(m.id, { share: { ...m.share, revoked: true } }); }
    catch (e) { if (isGone(e)) onPatch(m.id, { share: { ...m.share, revoked: true } }); else window.alert("서버에 닿지 못했어요. 잠시 뒤에 다시 시도해 주세요."); }
  };
  const retry = async (m) => { setBusy(m.id); await onRetry(m); setBusy(null); };

  // 우표: 모든 배달(서사 + 내 편지)의 등급을 센다
  const stamps = { perfect: 0, safe: 0, rough: 0 };
  Object.values(grades).forEach((g) => stamps[g]++);
  mine.forEach((m) => stamps[m.grade]++);
  const opened = mine.find((m) => m.id === openId);
  const partyM = mine.find((m) => m.id === partyId);
  const entry = (m) => { if (m.mode === "party") setPartyId(m.id); else setOpenId(m.id); };

  if (partyM) {
    return (
      <PartyScene party={partyM.party} voiceUrl={partyM.hasVoice ? loadVoice(partyM.id) : null} from={partyM.fromName || "내가"}
        preview={replay} onClose={() => { setPartyId(null); setReplay(false); }}
        onDone={() => { setPartyId(null); if (!replay) setOpenId(partyM.id); }} />
    );
  }

  if (opened) {
    const color = PAPERS.find((p) => p.id === opened.paper)?.color;
    return (
      <main className="screen center">
        <article className="paper" style={{ background: color }}>
          <h2>{opened.to}에게</h2>
          <div className="route">{fmt(opened.createdAt)}에 부친 편지 · {GRADE_NAME[opened.grade]}</div>
          {opened.body.split("\n").map((l, i) => <p key={i}>{l}</p>)}
        </article>
        {opened.mode === "future" && <article className="paper reply"><p>{opened.reply}</p></article>}
        {opened.mode === "party" && <button className="btn ghost" onClick={() => { setReplay(true); setPartyId(opened.id); }}><Icon name="party" size={18} />파티 다시 보기</button>}
        {opened.mode === "party" && opened.hasVoice && <button className="btn ghost" onClick={() => { if (window.confirm("녹음한 목소리를 지울까요? 이후에는 기본 노래가 나와요.")) onDeleteVoice(opened); }}><Icon name="trash" size={18} />내 목소리 지우기</button>}
        <button className="btn ghost" onClick={() => setOpenId(null)}>편지함으로</button>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="form">
        <h2>편지함</h2>
        <div className="stamps">
          <div className="stamp orb"><b>{orbsTotal}</b><span>기억 구슬</span></div>
          {Object.keys(stamps).map((g) => (
            <div key={g} className={`stamp ${g}`}><b>{stamps[g]}</b><span>{GRADE_NAME[g]} 우표</span></div>
          ))}
        </div>
        {mine.length === 0 && <p className="sub">아직 부친 편지가 없습니다. 지도에서 "편지 쓰기"를 눌러 보세요.</p>}
        {mine.map((m) => {
          const link = m.mode === "link";
          const ready = link || now >= m.openAt;
          const dead = m.share?.revoked || st[m.id]?.gone;
          return (
            <div key={m.id} className="mail-item">
              <button className="card" disabled={!ready} onClick={() => entry(m)}>
                <span><b>{m.to}에게</b><small>{fmt(m.createdAt)} · {GRADE_NAME[m.grade]}</small></span>
                <span className={`tag ${ready ? "ready" : ""}`}>
                  {m.mode === "party" && !ready ? `${remain(m.openAt - now)} 뒤 파티` : m.mode === "party" ? "파티가 열렸어요" : link ? (dead ? "거두어짐" : m.share ? "링크로 보냄" : "아직 못 올림") : ready ? "도착함 · 열어보기" : `${remain(m.openAt - now)} 뒤 도착`}
                </span>
              </button>
              {link && (
                <div className="share-row">
                  {m.share && !dead ? (
                    <>
                      <button className="icon-act" onClick={() => copy(m)} aria-label="링크 복사" title="링크 복사"><Icon name={copied === m.id ? "check" : "copy"} size={18} /></button>
                      <span className={`seen ${st[m.id]?.opened ? "on" : ""}`} role="img" aria-label={st[m.id]?.opened ? "받는 사람이 읽었어요" : "아직 읽지 않았어요"} title={st[m.id]?.opened ? "읽었어요" : "아직 안 읽었어요"}><Icon name="eye" size={18} /></span>
                      <button className="icon-act danger" onClick={() => revoke(m)} aria-label="편지 거두기" title="거두기"><Icon name="trash" size={18} /></button>
                    </>
                  ) : !m.share ? (
                    <button className="icon-act" disabled={busy === m.id} onClick={() => retry(m)} aria-label="다시 올리기" title="다시 올리기"><Icon name="send" size={18} /></button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
        <button className="btn ghost" onClick={onBack}>지도로</button>
      </div>
    </main>
  );
}
