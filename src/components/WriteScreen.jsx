import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PAPERS } from "../data/story.js";
import Icon from "./Icon.jsx";
import PartyScene from "./PartyScene.jsx";
import { CONCEPTS, MAX_VOICE_SEC, partyOf } from "../party/config.js";
import { startRecording } from "../party/audio.js";
import { checkLetter } from "../api.js";

const MAX = 500;
export const MAX_TOS = 10;                 // 링크로 한 번에 보낼 수 있는 사람 수(서버의 MAX_BATCH와 같다)
export const NAME_TOKEN = "{이름}";        // 본문에 쓰면 받는 사람마다 그 사람 이름으로 바뀐다

// 내 편지 쓰기: 화면 하나. 편지지에 받는 사람과 내용을 쓰고, 도착 장면(섬 위·바닷속·하늘 위)과 내 목소리(선택)를 고른 뒤 링크로 보낸다.
// 받는 사람이 링크를 열면 고른 장면에서 해무가 편지를 배달하는 영상이 나오고, 녹음한 목소리가 노래로 흐르고, 끝나면 편지가 열린다.
// 여러 명은 쉼표로 나눠 적으면 사람마다 링크가 따로 만들어진다. 보내는 사람 이름은 닉네임, 보관 기간(30일)은 기본값이다.
export default function WriteScreen({ myName = "", orbsTotal = 0, onSubmit, onBack }) {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [paper, setPaper] = useState("cream");
  const [scene, setScene] = useState(CONCEPTS[0].id);     // 도착 장면
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);       // 글 검사 중
  const [blockedMsg, setBlockedMsg] = useState("");      // 보낼 수 없는 표현이 있을 때 안내
  const [rec, setRec] = useState(null);                   // 녹음 중이면 { sec }
  const [voice, setVoice] = useState(null);               // 녹음한 목소리 { url, seconds }
  const [micErr, setMicErr] = useState("");
  const stage = useRef(null);
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.cancel(), []);

  const names = [...new Set(to.split(/[,，、]/).map((x) => x.trim()).filter(Boolean))].slice(0, MAX_TOS);
  const ok = names.length > 0 && !!body.trim();
  const color = PAPERS.find((p) => p.id === paper).color;
  const picked = CONCEPTS.find((c) => c.id === scene);

  const record = async () => {
    setMicErr("");
    try {
      ctl.current = await startRecording(MAX_VOICE_SEC, (sec) => setRec({ sec }));
      setRec({ sec: 0 });
      const r = await ctl.current.done;
      setRec(null); ctl.current = null;
      if (r) setVoice(r);
    } catch { setRec(null); setMicErr("마이크를 쓸 수 없어요. 허용했는지 확인해 주세요. 녹음 없이도 기본 노래가 나와요."); }
  };

  const send = async () => {
    setBlockedMsg(""); setChecking(true);
    try {                                              // 서버가 막는 표현이 있는지 먼저 본다. 서버에 닿지 못하면 보낼 때 서버가 다시 검사한다.
      const r = await checkLetter(names.join(", "), body.trim());
      if (!r.ok) { setBlockedMsg("편지에 보낼 수 없는 표현이 들어 있어요. 내용을 고친 뒤 다시 보내 주세요."); return; }
    } catch { /* 검사 서버에 못 닿아도 보내기는 계속한다 */ } finally { setChecking(false); }
    const payload = {
      mode: "link", tos: names, to: names.length > 1 ? `${names[0]} 외 ${names.length - 1}명` : names[0],
      fromName: myName || "누군가", expireDays: 30, paper, body: body.trim(), gap: 2, scene, voice,
    };
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calm) return onSubmit(payload);
    setSending(true);                                  // 봉투가 날아가는 연출을 보여 준 뒤 보낸다
    setTimeout(() => onSubmit(payload), 1300);
  };

  // 마우스를 따라 종이가 살짝 기운다(터치에서는 손가락을 따라간다)
  const tilt = (e) => {
    const r = stage.current?.getBoundingClientRect(); if (!r) return;
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    stage.current.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
    stage.current.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
  };

  return (
    <main className="screen wt">
      <div className="wt-top">
        <button className="wt-back" onClick={onBack} aria-label="지도로 돌아가기">‹</button>
        <h2 className="wt-title">편지 쓰기</h2>
        <span className="wt-back ghost" aria-hidden="true" />
      </div>

      <div className="wt-stage" ref={stage} onPointerMove={tilt}>
        <div className="wt-tilt">
          <article className="paper wt-paper" style={{ backgroundColor: color }}>
            <label className="wt-dear">
              <input value={to} maxLength={60} autoFocus placeholder="누구에게" aria-label="받는 사람 (여러 명은 쉼표로)" onChange={(e) => setTo(e.target.value)} />
              <span>에게</span>
            </label>
            <textarea value={body} maxLength={MAX} placeholder="요즘 안부와 하고 싶은 말을 적어 보세요." aria-label="편지 내용" onChange={(e) => setBody(e.target.value)} />
            <div className="wt-foot"><span>{names.length > 1 ? `${names.length}명에게 · ` : ""}{body.length} / {MAX}</span></div>
          </article>

          <div className="wt-papers" role="radiogroup" aria-label="편지지">
            {PAPERS.map((p) => {
              const locked = p.need > orbsTotal;           // 기억 구슬을 충분히 모아야 열린다
              return (
                <button key={p.id} role="radio" aria-checked={paper === p.id} disabled={locked} className={`wt-swatch ${paper === p.id ? "on" : ""} ${locked ? "locked" : ""}`}
                  style={{ "--c": p.color }} onClick={() => setPaper(p.id)} title={locked ? `${p.label} 편지지 · 기억 구슬 ${p.need}개` : `${p.label} 편지지`} aria-label={`${p.label} 편지지${locked ? `, 기억 구슬 ${p.need}개 필요` : ""}`}>
                  {locked && <span className="need"><Icon name="lock" size={12} />{p.need}</span>}
                </button>
              );
            })}
          </div>
          {names.length > 1 && <p className="wt-hint">본문에 {NAME_TOKEN}이라고 쓰면 받는 사람마다 그 사람 이름으로 바뀌어요</p>}

          {/* 도착 장면과 내 목소리: 받는 사람이 링크를 열면 이 장면에서 해무가 편지를 배달한다 */}
          <section className="wt-arrival" aria-label="도착 연출">
            <h3>받는 사람에게 이렇게 도착해요</h3>
            <div className="wt-scenes" role="radiogroup" aria-label="도착 장면">
              {CONCEPTS.map((c) => (
                <button key={c.id} role="radio" aria-checked={scene === c.id} className={`wt-scene ${scene === c.id ? "on" : ""}`} style={{ "--tone": c.tone }} onClick={() => setScene(c.id)}>
                  <span className="ico"><Icon name="party" size={20} /></span>
                  <b>{c.label.replace(" 파티", "")}</b><small>{c.hint}</small>
                </button>
              ))}
            </div>
            <div className="wt-voice">
              {!rec ? (
                <button className="btn ghost" onClick={record}><Icon name="mic" size={18} />{voice ? "다시 녹음하기" : "내 목소리 녹음하기"}</button>
              ) : (
                <button className="btn rec" onClick={() => ctl.current?.stop()}><Icon name="stop" size={18} />{rec.sec.toFixed(0)}초 · 멈추기</button>
              )}
              {voice && !rec && (
                <>
                  <span className="tag ready">{voice.seconds.toFixed(0)}초 녹음됨</span>
                  <button className="icon-act danger" onClick={() => setVoice(null)} aria-label="녹음 지우기" title="녹음 지우기"><Icon name="trash" size={18} /></button>
                </>
              )}
              <button className="btn ghost" onClick={() => setPreview(true)}><Icon name="play" size={18} />미리 보기</button>
            </div>
            <p className="wt-hint small">{micErr || `해무가 날아와 편지를 건네고, 내 목소리(선택, 최대 ${MAX_VOICE_SEC}초)에 맞춰 친구들이 노래해요. 녹음은 받는 사람에게 전해지고, 편지를 회수하거나 보관 기간(30일)이 지나면 함께 지워져요. 녹음이 없으면 기본 노래가 나와요.`}</p>
          </section>

          {blockedMsg && <p className="wt-hint warn" role="alert">{blockedMsg}</p>}
          <div className="wt-send-btns">
            <button className="btn wt-main" disabled={!ok || checking} onClick={send}><Icon name="link" size={22} />링크로 보내기</button>
          </div>
        </div>
      </div>

      {sending && (
        <div className="wt-send" role="status" aria-live="polite">
          <div className="wt-envelope"><Icon name="mail" size={84} /></div>
          <p>편지를 부치는 중…</p>
        </div>
      )}
      {preview && createPortal(<div className="party-overlay"><PartyScene preview intro party={partyOf({ ...picked, banner: names[0] ? `${names[0]}에게` : picked.banner })} voiceUrl={voice?.url ?? null} from={myName} onClose={() => setPreview(false)} /></div>, document.body)}
    </main>
  );
}
