import React from "react";
import { GRADE_NAME } from "../data/letters.js";
import { HAEMU_LETTER } from "../data/chapters.js";

// 이야기 노트: 네 통이 어떻게 이어지는지 한눈에. 아직 열리지 않은 장은 가려 둔다(스포일러 방지).
// 네 통을 모두 전하면 가방 맨 밑 주머니에 있던 해무의 편지도 여기에 남는다.
export default function NoteScreen({ letters, grades, isUnlocked, storyDone, onBack, onReplay, onReplayEpilogue, bottleSeen, onReplayBottle, nickname, onNick, onReset }) {
  return (
    <main className="screen">
      <div className="form">
        <h2>이야기 노트</h2>
        {nickname && <p className="sub">닉네임: <b>{nickname}</b></p>}
        <p className="sub">해무의 가방에 남아 있던 네 통의 편지입니다. 한 섬에 닿으면, 그 섬이 다음 섬으로 가는 바람길을 열어 줍니다.</p>
        <div className="chain" aria-label="이야기 순서">
          <span className="node done">해무</span>
          {letters.map((l, i) => (
            <React.Fragment key={l.id}>
              <span className="arrow">→</span>
              <span className={`node ${grades[l.id] ? "done" : isUnlocked(i) ? "open" : ""}`}>{isUnlocked(i) ? l.who : "?"}</span>
            </React.Fragment>
          ))}
        </div>
        {letters.map((l, i) => {
          const open = isUnlocked(i), g = grades[l.id];
          return (
            <article key={l.id} className={`card note ${open ? "" : "closed"}`}>
              <div>
                <small>{l.chapter}장{open ? ` · ${l.people}` : ""}</small>
                <b>{open ? l.title : "아직 열리지 않은 이야기"}</b>
                <p>{open ? l.context : "앞선 편지를 전하면 열립니다."}</p>
                {g && <p className="done-line">{l.reply}</p>}
              </div>
              <span className={`tag ${g ? "ready" : ""}`}>{g ? `${GRADE_NAME[g]} · 배달 완료` : open ? "배달 대기" : "잠김"}</span>
            </article>
          );
        })}
        {storyDone && (
          <article className="paper">
            <h2>가방 맨 밑 주머니</h2>
            <div className="route">해무 → 은결</div>
            {HAEMU_LETTER.map((l, i) => <p key={i}>{l}</p>)}
          </article>
        )}
        <div className="row">
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
