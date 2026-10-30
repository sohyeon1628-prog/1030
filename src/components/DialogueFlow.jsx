import React, { useEffect, useRef, useState } from "react";
import { RELATIONS, GAP_OPTIONS, QUICK_UNSAID, RELATION_DEFAULTS, makePerson } from "../data/profile.js";

// 해무가 묻고 내가 한 마디씩 답하는 대화. 폼이 아니라 이야기의 일부로 보이도록,
// 한 번에 질문 하나, 칩을 누르면 바로 다음으로 넘어간다. 못 한 말과 장면은 비워 두면 관계별 기본값이 쓰인다.
const ABOUT_CHIPS = ["늘 바쁜 사람", "연락이 뜸한 사람", "말수가 적은 사람", "표현이 서툰 사람"];
const WHO_LINE = ["여섯 사람 중에서 네 사람을 고르게. 첫 번째 편지는 누구에게 쓸 텐가?", "다음은 누구인가?", "그다음은?", "마지막 한 장일세. 누구에게 쓸 텐가?"];

export default function DialogueFlow({ nickname = "", onFocus, onPerson, onFinish, onExample }) {
  const [step, setStep] = useState(nickname ? "about" : "name");           // name → about → bag → who → unsaid → gap (사람마다 반복)
  const [name, setName] = useState(nickname);
  const [about, setAbout] = useState("");
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState({ relation: "", name: "", unsaid: "" });
  const [hint, setHint] = useState("");
  const inputRef = useRef(null);
  const k = people.length;                              // 지금 정하는 사람의 번호(0~3)

  useEffect(() => { inputRef.current?.focus(); }, [step, draft.relation]);
  // 사람을 정하는 동안에는 카메라가 그 사람의 섬을 비춘다
  useEffect(() => { onFocus(step === "who" || step === "unsaid" || step === "gap" ? k + 1 : 0); }, [step, k]);   // eslint-disable-line react-hooks/exhaustive-deps

  const me = name.trim() || "자네";
  const say = {
    name: "자네, 이름이 뭔가? 이 가방에 적어 둘 걸세.",
    about: `${me}… 좋은 이름이군. 자네는 어떤 사람인가? 한마디면 되네.`,
    bag: "좋아. 오늘부터 이 가방은 자네 거야. 서랍 속엔 빈 편지지가 네 장 있다네. 누구에게 쓸지는 자네가 정하게.",
    who: WHO_LINE[k],
    unsaid: `${draft.name}에게 못 한 말이 있나? 가장 가까운 걸 골라 보게.`,
    gap: `${draft.name}과(와) 마지막으로 이야기한 건 언제인가?`,
  }[step];

  const submitName = () => { if (!name.trim()) { setHint("이름을 알려 주게."); return; } setHint(""); setStep("about"); };
  const pickRelation = (r) => setDraft({ relation: r, name: r === "직접 입력" ? "" : r, unsaid: "" });
  const submitWho = () => { if (!draft.name.trim()) { setHint("이름을 알려 주게."); return; } setHint(""); setStep("unsaid"); };
  const finishPerson = (gap) => {
    const person = makePerson({ ...draft, gap });
    const next = [...people, person];
    setPeople(next); onPerson(k, person);
    setDraft({ relation: "", name: "", unsaid: "" });
    if (next.length === 4) onFinish({ name: name.trim(), island: "노을섬", about: about.trim(), people: next });
    else setStep("who");
  };
  const key = (fn) => (e) => { if (e.key === "Enter") { e.preventDefault(); fn(); } };

  return (
    <div className="dialogue" role="dialog" aria-live="polite" aria-label="해무와의 대화">
      <p className="speaker">우체부 해무 <small>{step === "name" || step === "about" || step === "bag" ? "" : `${Math.min(k + 1, 4)} / 4`}</small></p>
      <p key={step + k} className="say fade">{say}</p>

      {step === "name" && (
        <div className="reply">
          <input ref={inputRef} value={name} maxLength={12} placeholder="이름 (예: 소라)" onChange={(e) => setName(e.target.value)} onKeyDown={key(submitName)} />
          <button className="btn" onClick={submitName}>대답하기</button>
        </div>
      )}

      {step === "about" && (
        <div className="reply col">
          <div className="chips">
            {ABOUT_CHIPS.map((c) => <button key={c} className="chip-btn" onClick={() => { setAbout(c); setStep("bag"); }}>{c}</button>)}
          </div>
          <div className="reply">
            <input ref={inputRef} value={about} maxLength={30} placeholder="직접 한마디" onChange={(e) => setAbout(e.target.value)} onKeyDown={key(() => setStep("bag"))} />
            <button className="btn ghost" onClick={() => setStep("bag")}>{about.trim() ? "이렇게 말하기" : "그냥 넘어가기"}</button>
          </div>
        </div>
      )}

      {step === "bag" && <div className="reply"><button className="btn" onClick={() => setStep("who")}>가방을 받는다</button></div>}

      {step === "who" && (
        <div className="reply col">
          <div className="chips">
            {RELATIONS.map((r) => {
              const used = people.some((x) => x.relation === r);                // 이미 쓴 사람은 다시 고르지 않는다
              return <button key={r} disabled={used} className={`chip-btn ${draft.relation === r ? "on" : ""}`} onClick={() => pickRelation(r)}>{r}</button>;
            })}
          </div>
          {draft.relation && (
            <div className="reply">
              <input ref={inputRef} value={draft.name} maxLength={10} placeholder="이름 또는 부르는 말" onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={key(submitWho)} />
              <button className="btn" onClick={submitWho}>이 사람에게</button>
            </div>
          )}
        </div>
      )}

      {step === "unsaid" && (
        <div className="reply col">
          <div className="chips">
            {QUICK_UNSAID.map((q) => (
              <button key={q.label} className="chip-btn" onClick={() => { setDraft({ ...draft, unsaid: q.text }); setStep("gap"); }}>{q.label}</button>
            ))}
          </div>
          <div className="reply">
            <input ref={inputRef} value={draft.unsaid} maxLength={80} placeholder="직접 한두 문장 (비워 두면 해무가 대신 적어 줘요)" onChange={(e) => setDraft({ ...draft, unsaid: e.target.value })} onKeyDown={key(() => setStep("gap"))} />
            <button className="btn ghost" onClick={() => setStep("gap")}>{draft.unsaid.trim() ? "이렇게 쓰기" : "알아서 써 주게"}</button>
          </div>
        </div>
      )}

      {step === "gap" && (
        <div className="reply col">
          <div className="chips">
            {GAP_OPTIONS.map((g) => <button key={g.id} className="chip-btn big" onClick={() => finishPerson(g.id)}>{g.label}</button>)}
          </div>
        </div>
      )}

      {hint && <p className="err" role="alert">{hint}</p>}
      <button className="linkbtn" onClick={() => onExample(name, about)}>귀찮으면, 예시 이야기로 바로 시작하기</button>
    </div>
  );
}
