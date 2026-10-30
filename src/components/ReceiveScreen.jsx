import React, { useEffect, useMemo, useState } from "react";
import World3D from "./World3D.jsx";
import Icon from "./Icon.jsx";
import { getLetter, reportLetter } from "../api.js";
import { PAPERS } from "../data/story.js";
import { GRADE_NAME } from "../data/letters.js";
import { DEFAULT_PROFILE, buildLetters, josa } from "../data/profile.js";

// 받는 사람이 링크(/l/:id)를 열었을 때: 안개 낀 바다 위로 편지가 날아와 도착하고, 봉투가 열린다.
const fmt = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

export default function ReceiveScreen({ id }) {
  const [phase, setPhase] = useState("loading");      // loading → arriving → open | gone | error
  const [letter, setLetter] = useState(null);
  const [gone, setGone] = useState("");
  const [reported, setReported] = useState(false);
  const [tick, setTick] = useState(0);
  const bgLetters = useMemo(() => buildLetters(DEFAULT_PROFILE), []);

  useEffect(() => {
    let alive = true, timer;
    setPhase("loading");
    getLetter(id).then((l) => {
      if (!alive) return;
      setLetter(l); setPhase("arriving");
      timer = setTimeout(() => alive && setPhase("open"), 2800);          // 편지가 날아오는 연출이 끝나면 열린다
    }).catch((e) => {
      if (!alive) return;
      if (e.status === 404 || e.status === 410) { setGone(e.status === 404 ? "none" : "expired"); setPhase("gone"); }
      else setPhase("error");
    });
    return () => { alive = false; clearTimeout(timer); };
  }, [id, tick]);

  const color = letter && PAPERS.find((p) => p.id === letter.paper)?.color;
  const stars = letter ? (letter.grade === "perfect" ? 3 : letter.grade === "safe" ? 2 : 1) : 0;

  return (
    <div className="app">
      <div className="bg dim"><World3D letters={bgLetters} grades={{}} isUnlocked={() => false} onOpen={() => {}} interactive={false} /></div>
      <main className="screen center receive">
        {(phase === "loading" || phase === "arriving") && (
          <div className={`flying ${phase}`} aria-label="편지가 날아오는 중">
            <div className="envelope-fly"><Icon name="mail" size={72} /></div>
            <div className="dots-loading"><span /><span /><span /></div>
          </div>
        )}

        {phase === "open" && letter && (
          <>
            <article className="paper opening" style={{ background: color }}>
              <h2>{letter.to}에게</h2>
              <div className="route">{josa(letter.from, "이", "가")} 보낸 편지 · {fmt(letter.createdAt)}</div>
              {letter.body.split("\n").map((l, i) => <p key={i}>{l}</p>)}
              <div className="stars" role="img" aria-label={`${GRADE_NAME[letter.grade]} 등급`}>
                {[0, 1, 2].map((k) => <span key={k} className={k < stars ? "on" : ""}><Icon name="star" size={18} /></span>)}
              </div>
            </article>
            <div className="row">
              <a className="btn" href="/"><Icon name="pen" size={18} /> 나도 편지 쓰기</a>
              <button className="btn ghost" disabled={reported} onClick={() => { reportLetter(id).catch(() => {}); setReported(true); }}>{reported ? "신고했어요" : "신고"}</button>
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
