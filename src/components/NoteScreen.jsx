import React from "react";
import { GRADE_NAME } from "../data/letters.js";

// 이야기 노트: 네 통이 어떻게 이어지는지 한눈에. 아직 열리지 않은 장은 가려 둔다(스포일러 방지).
export default function NoteScreen({ letters, grades, isUnlocked, onBack, onReplay, onEdit, nickname, onNick, onReset }) {
  return (
    <main className="screen">
      <div className="form">
        <h2>이야기 노트</h2>
        {nickname && <p className="sub">닉네임: <b>{nickname}</b></p>}
        <p className="sub">당신이 정한 네 사람의 이야기입니다. 한 사람에게 닿으면, 그 섬이 다음 사람에 대해 적어 둔 장면을 돌려줍니다.</p>
        <div className="chain" aria-label="이야기 순서">
          <span className="node done">나</span>
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
        <div className="row">
          {onEdit && letters.some((l) => !grades[l.id]) && <button className="btn ghost" onClick={onEdit}>나의 이야기 고치기</button>}
          <button className="btn ghost" onClick={onReplay}>오프닝 다시 보기</button>
          {onNick && <button className="btn ghost" onClick={onNick}>닉네임 바꾸기</button>}
          <button className="btn ghost" onClick={onBack}>지도로</button>
        </div>
        {onReset && <button className="linkbtn" onClick={onReset}>저장된 진행 모두 지우고 처음부터 (테스트용 초기화)</button>}
      </div>
    </main>
  );
}
