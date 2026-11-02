import React, { useEffect, useState } from "react";
import { GRADE_NAME } from "../data/letters.js";
import { PAPERS } from "../data/story.js";
import { getStatus, deleteLetter, letterUrl } from "../api.js";
import Icon from "./Icon.jsx";
import { copyText } from "../clipboard.js";
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
const REACTION = { clap: ["👏", "박수"], fireworks: ["🎆", "폭죽"], heart: ["💗", "하트"] };   // 받는 사람이 돌려보낸 반응
const isGone = (e) => e.status === 404 || e.status === 410;

// 기억 구슬: 숫자만 있으면 무엇에 쓰는지 알 수 없어서, 역할과 다음 보상까지의 진행을 함께 보여 준다.
// 구슬은 쓰고 사라지지 않는다. 모은 수가 기준을 넘으면 편지지가 열린다(WriteScreen). 이야기 편지는 한 번에 3개·7개 이상 모으면 도착 장면에 기억이 한 줄씩 더 떠오른다.
function OrbCard({ total }) {
  const tiers = PAPERS.filter((p) => p.need > 0);
  const next = tiers.find((p) => p.need > total);
  const prevNeed = [...tiers].reverse().find((p) => p.need <= total)?.need || 0;
  const pct = next ? Math.round(((total - prevNeed) / (next.need - prevNeed)) * 100) : 100;
  return (
    <section className="orb-card" aria-label="기억 구슬">
      <div className="orb-head"><span className="orb-dot" aria-hidden="true" /><b>{total}</b><span>기억 구슬</span></div>
      <p>비행 중 반짝이는 구슬을 지나가며 모으는 수집품이에요. 쓰고 사라지지 않고, 모을수록 보상이 열려요. 같은 편지를 다시 날면 가장 많이 모은 개수만 쌓여요.</p>
      <div className="orb-bar" role="progressbar" aria-valuenow={total} aria-valuemin={0} aria-valuemax={tiers[tiers.length - 1].need}><i style={{ width: `${pct}%` }} /></div>
      <small>{next ? `다음 보상 '${next.label} 편지지'까지 ${next.need - total}개` : "모든 편지지를 열었어요"}</small>
      <ul className="orb-rewards">
        {tiers.map((p) => (
          <li key={p.id} className={total >= p.need ? "on" : ""}>
            <i className="sw" style={{ background: p.color }} />{p.label} 편지지<em>{p.note} · 구슬 {p.need}개 · {total >= p.need ? "열림" : "잠김"}</em>
          </li>
        ))}
        <li><i className="sw memo" />이야기 편지 도착 장면의 기억<em>한 번에 3개 이상: 한 줄 · 7개 이상: 두 줄</em></li>
      </ul>
    </section>
  );
}

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
        .then((r) => alive && setSt((s) => ({ ...s, [m.id]: { opened: r.opened, reaction: r.reaction } })))
        .catch((e) => { if (alive && isGone(e)) setSt((s) => ({ ...s, [m.id]: { gone: true } })); });
    });
    return () => { alive = false; };
  }, [mine.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (m) => {
    const url = letterUrl(m.share.id);
    if (!(await copyText(url))) window.prompt("링크를 복사하세요", url);
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
        <article className={`paper paper-${opened.paper}`} style={{ backgroundColor: color }}>
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
          {Object.keys(stamps).map((g) => (
            <div key={g} className={`stamp ${g}`}><b>{stamps[g]}</b><span>{GRADE_NAME[g]} 우표</span></div>
          ))}
        </div>
        <OrbCard total={orbsTotal} />
        {mine.length === 0 && <p className="sub">아직 부친 편지가 없습니다. 지도의 편지섬에서 편지를 써 보세요.</p>}
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
                      {st[m.id]?.reaction && <span className="reaction-got" role="img" aria-label={`받는 사람이 ${REACTION[st[m.id].reaction]?.[1]}을 보냈어요`} title={`받는 사람이 ${REACTION[st[m.id].reaction]?.[1]}을 보냈어요`}>{REACTION[st[m.id].reaction]?.[0]}</span>}
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
