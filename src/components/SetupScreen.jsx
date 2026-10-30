import React, { useState } from "react";
import { RELATIONS, GAP_OPTIONS } from "../data/profile.js";

// 나의 이야기: 시작 전에 채운다. 예시 구성이 미리 채워져 있어 그대로 시작해도 된다.
// lockedCount: 이미 전한 장의 수. 앞의 lockedCount명은 고칠 수 없고 순서도 바꿀 수 없다(이야기 노트에서 고치는 경우).
export default function SetupScreen({ initial, lockedCount = 0, editing = false, onSubmit, onBack }) {
  const [pr, setPr] = useState(() => JSON.parse(JSON.stringify(initial)));
  const [err, setErr] = useState("");

  const set = (patch) => setPr((p) => ({ ...p, ...patch }));
  const setPerson = (i, patch) => setPr((p) => ({ ...p, people: p.people.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
  const move = (i, d) => setPr((p) => {
    const j = i + d;
    if (j < lockedCount || j >= p.people.length) return p;
    const people = p.people.slice(); [people[i], people[j]] = [people[j], people[i]];
    return { ...p, people };
  });

  const submit = () => {
    if (!pr.name.trim()) { setErr("내 이름을 적어 주세요. 해무가 그 이름을 부르며 가방을 넘겨요."); return; }
    if (pr.people.some((p) => !p.name.trim())) { setErr("네 사람의 이름을 모두 적어 주세요."); return; }
    setErr("");
    onSubmit(pr);
  };

  return (
    <main className="screen">
      <div className="form">
        <h2>{editing ? "나의 이야기 고치기" : "나의 이야기"}</h2>
        <p className="sub">
          {editing ? "아직 열리지 않은 장의 사람과 순서를 고칠 수 있어요. 이미 전한 사람은 바꿀 수 없어요."
            : "해무가 가방을 넘기기 전에, 당신의 이야기를 채워 주세요. 적은 내용은 오프닝과 편지, 섬의 대답에 그대로 나와요. 예시가 채워져 있어서 그대로 시작해도 돼요."}
        </p>

        <label>내 이름 <small>해무가 부를 이름이에요</small>
          <input value={pr.name} maxLength={12} placeholder="예: 소라" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>내 섬 <small>모든 비행의 출발점이에요</small>
          <input value={pr.island} maxLength={12} onChange={(e) => set({ island: e.target.value })} />
        </label>
        <label>나는 어떤 사람인가요? <small>한 줄 소개</small>
          <input value={pr.about} maxLength={40} placeholder="예: 퇴근이 늘 늦은 아빠, 연락이 뜸한 딸" onChange={(e) => set({ about: e.target.value })} />
        </label>

        <h3>사랑하는 네 사람</h3>
        <p className="sub">위에서 아래 순서로 전해요. ▲▼로 순서를 바꿀 수 있어요.</p>
        {pr.people.map((p, i) => {
          const locked = i < lockedCount;
          return (
            <fieldset key={i} className={`person ${locked ? "locked" : ""}`} disabled={locked}>
              <legend>{i + 1}번째 사람{locked ? " (이미 전함)" : ""}</legend>
              <div className="row between">
                <div className="chips">
                  {RELATIONS.map((r) => (
                    <button type="button" key={r} className={`chip-btn ${p.relation === r ? "on" : ""}`}
                      onClick={() => setPerson(i, { relation: r, ...(r !== "직접 입력" && (!p.name.trim() || RELATIONS.includes(p.name)) ? { name: r } : {}) })}>{r}</button>
                  ))}
                </div>
                {!locked && (
                  <div className="movers">
                    <button type="button" aria-label="위로" disabled={i <= lockedCount} onClick={() => move(i, -1)}>▲</button>
                    <button type="button" aria-label="아래로" disabled={i === pr.people.length - 1} onClick={() => move(i, 1)}>▼</button>
                  </div>
                )}
              </div>
              <div className="grid2">
                <label>이름<input value={p.name} maxLength={10} onChange={(e) => setPerson(i, { name: e.target.value })} /></label>
                <label>그 사람의 섬<input value={p.island} maxLength={12} placeholder={`${p.name || "○○"}의 섬`} onChange={(e) => setPerson(i, { island: e.target.value })} /></label>
              </div>
              <label>그 사람에게 못 한 말 <small>한두 문장. 편지의 첫 줄이 돼요</small>
                <textarea rows={2} maxLength={120} value={p.unsaid} onChange={(e) => setPerson(i, { unsaid: e.target.value })} />
              </label>
              <div className="grid2">
                <label>마지막으로 이야기한 때
                  <select value={p.gap} onChange={(e) => setPerson(i, { gap: e.target.value })}>
                    {GAP_OPTIONS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </label>
                <label>그 사람 하면 떠오르는 장면
                  <input value={p.scene} maxLength={40} onChange={(e) => setPerson(i, { scene: e.target.value })} />
                </label>
              </div>
            </fieldset>
          );
        })}

        {err && <p className="err" role="alert">{err}</p>}
        <div className="row">
          <button className="btn" onClick={submit}>{editing ? "저장하기" : "이 이야기로 시작하기"}</button>
          {onBack && <button className="btn ghost" onClick={onBack}>돌아가기</button>}
        </div>
      </div>
    </main>
  );
}
