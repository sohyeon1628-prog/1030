import React, { useEffect, useMemo, useState } from "react";
import World3D from "./World3D.jsx";
import PartyScene from "./PartyScene.jsx";
import Icon from "./Icon.jsx";
import { getLetter, reportLetter, reactLetter, voiceUrl } from "../api.js";
import { PAPERS } from "../data/story.js";
import { GRADE_NAME } from "../data/letters.js";
import { buildLetters, josa } from "../data/chapters.js";
import { CONCEPTS, partyOf } from "../party/config.js";

// 받는 사람이 링크(/l/:id)를 열었을 때: 편지가 도착했다는 화면 → (누르면) 보낸 사람이 고른 장면에서 해무가 편지를 들고 날아와 건네는 영상,
// 보낸 사람의 목소리(없으면 기본 노래)가 흐르고 → 편지가 열리고 → 박수·폭죽·하트 중 하나로 마음을 돌려보낼 수 있다.
// 영상 앞에 버튼을 두는 이유: 브라우저는 사용자가 한 번 누르기 전에는 소리를 재생하지 못한다.
const fmt = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
const REACTIONS = [
  { kind: "clap", label: "박수", emoji: "👏" },
  { kind: "fireworks", label: "폭죽", emoji: "🎆" },
  { kind: "heart", label: "하트", emoji: "💗" },
];

export default function ReceiveScreen({ id }) {
  const [phase, setPhase] = useState("loading");      // loading → ready → scene → open | gone | error
  const [letter, setLetter] = useState(null);
  const [voice, setVoice] = useState(null);           // 보낸 사람의 녹음(blob 주소)
  const [gone, setGone] = useState("");
  const [reported, setReported] = useState(false);
  const [reacted, setReacted] = useState(null);
  const [tick, setTick] = useState(0);
  const bgLetters = useMemo(() => buildLetters(), []);

  useEffect(() => {
    let alive = true, blobUrl = null;
    setPhase("loading");
    (async () => {
      try {
        const l = await getLetter(id);
        if (!alive) return;
        if (l.voice) {                                  // 녹음은 미리 내려받아 둔다(없거나 실패하면 기본 노래)
          try { const r = await fetch(voiceUrl(l.voice)); if (r.ok) { blobUrl = URL.createObjectURL(await r.blob()); setVoice(blobUrl); } } catch { /* 기본 노래 */ }
        }
        if (!alive) return;
        setLetter(l); setPhase("ready");
      } catch (e) {
        if (!alive) return;
        if (e.status === 404 || e.status === 410) { setGone(e.status === 404 ? "none" : "expired"); setPhase("gone"); }
        else setPhase("error");
      }
    })();
    return () => { alive = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [id, tick]);

  const color = letter && PAPERS.find((p) => p.id === letter.paper)?.color;
  const stars = letter ? (letter.grade === "perfect" ? 3 : letter.grade === "safe" ? 2 : 1) : 0;
  const concept = CONCEPTS.find((c) => c.id === letter?.scene) || CONCEPTS[0];
  const react = (kind) => { setReacted(kind); reactLetter(id, kind).catch(() => {}); };

  if (phase === "scene" && letter) {
    return <PartyScene intro party={partyOf({ ...concept, banner: `${letter.to}에게` })} voiceUrl={voice} from={letter.from} onDone={() => setPhase("open")} />;
  }

  return (
    <div className="app">
      <div className="bg dim"><World3D letters={bgLetters} grades={{}} isUnlocked={() => false} onOpen={() => {}} interactive={false} /></div>
      <main className="screen center receive">
        {phase === "loading" && (
          <div className="flying loading" aria-label="편지를 불러오는 중">
            <div className="envelope-fly"><Icon name="mail" size={72} /></div>
            <div className="dots-loading"><span /><span /><span /></div>
          </div>
        )}

        {phase === "ready" && letter && (
          <>
            <div className="flying arriving"><div className="envelope-fly"><Icon name="mail" size={72} /></div></div>
            <h2 className="receive-title">{josa(letter.from, "이", "가")} 보낸 편지가 도착했어요</h2>
            <p className="sub">{letter.to}에게 · {fmt(letter.createdAt)}</p>
            <div className="row"><button className="btn" onClick={() => setPhase("scene")}><Icon name="mail" size={18} /> 배달받기</button></div>
          </>
        )}

        {phase === "open" && letter && (
          <>
            <article className={`paper opening paper-${letter.paper}`} style={{ backgroundColor: color }}>
              <h2>{letter.to}에게</h2>
              <div className="route">{josa(letter.from, "이", "가")} 보낸 편지 · {fmt(letter.createdAt)}</div>
              {letter.body.split("\n").map((l, i) => <p key={i}>{l}</p>)}
              <div className="stars" role="img" aria-label={`${GRADE_NAME[letter.grade]} 등급`}>
                {[0, 1, 2].map((k) => <span key={k} className={k < stars ? "on" : ""}><Icon name="star" size={18} /></span>)}
              </div>
            </article>
            <div className="reactions" role="group" aria-label="마음 돌려보내기">
              <p className="sub">{reacted ? `${letter.from}에게 마음을 보냈어요` : `${letter.from}에게 마음을 돌려보내세요`}</p>
              <div className="row">
                {REACTIONS.map((r) => (
                  <button key={r.kind} className={`react-btn ${reacted === r.kind ? "on" : ""}`} onClick={() => react(r.kind)} aria-pressed={reacted === r.kind}>
                    <span aria-hidden="true">{r.emoji}</span>{r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="row">
              <a className="btn" href="/"><Icon name="pen" size={18} /> 나도 편지 쓰기</a>
              <button className="btn ghost" disabled={reported} onClick={() => { reportLetter(id).catch(() => {}); setReported(true); }}>{reported ? "신고했어요 · 확인할게요" : "신고"}</button>
            </div>
          </>
        )}

        {phase === "gone" && (
          <>
            <article className="paper"><h2>{gone === "expired" ? "편지가 바람에 흩어졌어요" : "찾을 수 없는 편지예요"}</h2><p>{gone === "expired" ? "보관 기간이 지났거나, 보낸 사람이 거두어 갔어요." : "주소를 다시 확인해 주세요."}</p></article>
            <div className="row"><a className="btn" href="/">게임으로</a></div>
          </>
        )}

        {phase === "error" && (
          <>
            <article className="paper"><h2>편지를 가져오지 못했어요</h2><p>잠시 뒤에 다시 시도해 주세요.</p></article>
            <div className="row"><button className="btn" onClick={() => setTick((t) => t + 1)}>다시 시도</button></div>
          </>
        )}
      </main>
    </div>
  );
}
