import React, { useState } from "react";
import { GRADE_NAME } from "../data/letters.js";
import { HAEMU_LETTER } from "../data/chapters.js";

// 이야기 노트: 해무의 가방에 남아 있던 편지들을 봉투로 보여 준다. 봉투를 누르면 덮개가 열리며 편지지가 펼쳐진다.
// 아직 열리지 않은 장은 봉인된 채 가려 둔다(스포일러 방지). 네 통을 모두 전하면 가방 맨 밑 주머니의 해무 편지도 여기에 남는다.
export default function NoteScreen({ letters, grades, isUnlocked, storyDone, onBack, onReplay, onReplayEpilogue, bottleSeen, onReplayBottle, nickname, onNick, onReset }) {
  const firstOpen = (letters.find((l, i) => isUnlocked(i) && !grades[l.id]) || letters[0]).id;
  const [openId, setOpenId] = useState(firstOpen);
  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <main className="screen">
      <div className="notebook">
        <header className="nb-head">
          <h2>이야기 노트</h2>
          {nickname && <span className="nb-stamp" title="내 닉네임">{nickname}</span>}
        </header>
        <p className="nb-lead">해무의 가방에 남아 있던 네 통의 편지예요. 봉투를 눌러 펼쳐 보세요. 한 섬에 닿으면, 그 섬이 다음 섬으로 가는 바람길을 열어 줍니다.</p>

        <ol className="nb-route" aria-label="이야기 순서">
          <li className="done"><i />해무</li>
          {letters.map((l, i) => (
            <li key={l.id} className={grades[l.id] ? "done" : isUnlocked(i) ? "open" : ""}><i />{isUnlocked(i) ? l.who : "?"}</li>
          ))}
        </ol>

        {letters.map((l, i) => {
          const open = isUnlocked(i), g = grades[l.id], on = openId === l.id && open;
          return (
            <section key={l.id} className={`env ${on ? "on" : ""} ${open ? "" : "sealed"} ${g ? "done" : ""}`}>
              <button className="env-top" disabled={!open} aria-expanded={on} onClick={() => toggle(l.id)}>
                <span className="env-seal" aria-hidden="true">{open ? l.chapter : "·"}</span>
                <span className="env-info">
                  <small>{open ? `${l.chapter}장 · ${l.people}` : `${l.chapter}장`}</small>
                  <b>{open ? l.title : "봉인된 편지"}</b>
                </span>
                <span className={`env-tag ${g ? "ready" : ""}`}>{g ? `${GRADE_NAME[g]} · 배달 완료` : open ? "배달 대기" : "앞선 편지를 전하면 열려요"}</span>
              </button>
              <div className="env-body" aria-hidden={!on}>
                <div className="env-inner">
                  <article className="env-paper">
                    <div className="env-route">{l.from} → {l.to}</div>
                    <div className="env-sec bg">
                      <h3><i>1</i>이야기 배경</h3>
                      <p>{l.context}</p>
                      {l.memo && <p className="env-hand"><b>해무</b>{l.memo}</p>}
                    </div>
                    {l.body && (
                      <div className="env-sec letter">
                        <h3><i>2</i>편지 내용</h3>
                        <div className="env-letter">{l.body.map((t, k) => <p key={k}>{t}</p>)}</div>
                      </div>
                    )}
                    {g && (
                      <div className="env-sec after">
                        <h3><i>3</i>도착한 뒤</h3>
                        <p>{l.reply}</p>
                      </div>
                    )}
                  </article>
                </div>
              </div>
            </section>
          );
        })}

        {storyDone && (
          <section className={`env haemu ${openId === "haemu" ? "on" : ""}`}>
            <button className="env-top" aria-expanded={openId === "haemu"} onClick={() => toggle("haemu")}>
              <span className="env-seal" aria-hidden="true">✉</span>
              <span className="env-info"><small>해무 → 은결</small><b>가방 맨 밑 주머니</b></span>
              <span className="env-tag ready">해무의 편지</span>
            </button>
            <div className="env-body" aria-hidden={openId !== "haemu"}>
              <div className="env-inner">
                <article className="env-paper">{HAEMU_LETTER.map((t, i) => <p key={i}>{t}</p>)}</article>
              </div>
            </div>
          </section>
        )}

        <div className="nb-actions">
          <button className="btn ghost" onClick={onReplay}>오프닝 다시 보기</button>
          {storyDone && <button className="btn ghost" onClick={onReplayEpilogue}>에필로그 다시 보기</button>}
          {bottleSeen && <button className="btn ghost" onClick={onReplayBottle}>병 편지 다시 보기</button>}
          {onNick && <button className="btn ghost" onClick={onNick}>닉네임 바꾸기</button>}
          <button className="btn ghost" onClick={onBack}>지도로</button>
        </div>
        {onReset && <button className="linkbtn" onClick={onReset}>저장된 진행 모두 지우고 처음부터 (테스트용 초기화)</button>}
      </div>
    </main>
  );
}
