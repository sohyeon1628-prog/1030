import React, { useState } from "react";
import { createPortal } from "react-dom";
import { GAPS, DELAYS, PAPERS } from "../data/story.js";
import Icon from "./Icon.jsx";
import PartyEditor from "./PartyEditor.jsx";
import PartyScene from "./PartyScene.jsx";
import { DEFAULT_PARTY, QUICK_WHEN, MIN_FUTURE_MS, fmtWhen } from "../party/config.js";

const toLocal = (t) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

const MAX = 500;
export const MAX_TOS = 10;                 // 링크로 한 번에 보낼 수 있는 사람 수(서버의 MAX_BATCH와 같다)
export const NAME_TOKEN = "{이름}";        // 본문에 쓰면 받는 사람마다 그 사람 이름으로 바뀐다
const KEEP = [{ days: 7, label: "7일" }, { days: 30, label: "30일" }, { days: 90, label: "90일" }];

// 내 편지 쓰기: 보낼 방법(미래의 나 / 링크로 보내기), 받는 사람, 편지지, 본문
export default function WriteScreen({ myName = "", orbsTotal = 0, onSubmit, onBack }) {
  const [mode, setMode] = useState("future");        // future: 정한 날 내 편지함으로 / link: 링크를 받은 사람에게
  const [to, setTo] = useState("");
  const [tos, setTos] = useState([]);                // 링크로 보낼 때 받는 사람 목록
  const [fromName, setFromName] = useState(myName);
  const [expireDays, setExpireDays] = useState(30);
  const [gap, setGap] = useState(1);
  const [paper, setPaper] = useState("cream");
  const [delay, setDelay] = useState(DELAYS[1].ms);
  const [body, setBody] = useState("");
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [voice, setVoice] = useState(null);
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState(false);
  const [openAt, setOpenAt] = useState(() => Date.now() + QUICK_WHEN[0].ms);
  const link = mode === "link", pty = mode === "party";
  const okWhen = !pty || openAt >= Date.now() + MIN_FUTURE_MS - 5000;
  // 링크로 보낼 때는 받는 사람을 여러 명 넣을 수 있다. 입력칸에 남은 이름도 함께 보낸다.
  const allTos = link ? [...new Set([...tos, to.trim()].filter(Boolean))].slice(0, MAX_TOS) : [to.trim()].filter(Boolean);
  const addTo = () => {
    const names = to.split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length) setTos((t) => [...new Set([...t, ...names])].slice(0, MAX_TOS));
    setTo("");
  };
  const ok = allTos.length && body.trim() && (!link || fromName.trim()) && okWhen;
  const color = PAPERS.find((p) => p.id === paper).color;

  return (
    <main className="screen">
      <div className="form">
        <h2>내 편지 쓰기</h2>

        <fieldset>
          <legend>어디로 보낼까요?</legend>
          <label className={`chip big ${!link ? "on" : ""}`}>
            <input type="radio" name="mode" checked={!link} onChange={() => setMode("future")} />
            <Icon name="mail" size={18} /> 미래의 나에게<small>정한 날 내 편지함으로</small>
          </label>
          <label className={`chip big ${link ? "on" : ""}`}>
            <input type="radio" name="mode" checked={link} onChange={() => setMode("link")} />
            <Icon name="link" size={18} /> 링크로 보내기<small>받은 사람이 열어 봐요</small>
          </label>
          <label className={`chip big ${pty ? "on" : ""}`}>
            <input type="radio" name="mode" checked={pty} onChange={() => setMode("party")} />
            <Icon name="party" size={18} /> 파티 편지<small>정한 날 항구에서 파티가 열려요</small>
          </label>
        </fieldset>
        {link && <p className="sub">링크를 가진 사람만 편지를 볼 수 있어요. 보관 기간이 지나면 사라지고, 편지함에서 언제든 거두어 올 수 있어요.</p>}

        {link ? (
          <label>누구에게 보낼까요? <small>여러 명이면 한 명씩 추가하세요. 한 번 날면 사람마다 링크가 따로 만들어져요 (최대 {MAX_TOS}명)</small>
            {tos.length > 0 && (
              <span className="chips">
                {tos.map((n) => <button type="button" key={n} className="chip-btn on" aria-label={`${n} 빼기`} onClick={() => setTos((t) => t.filter((x) => x !== n))}>{n} ✕</button>)}
              </span>
            )}
            <span className="to-row">
              <input value={to} maxLength={60} placeholder={tos.length ? "한 명 더 (예: 도윤)" : "예: 엄마, 도윤, 하준"} disabled={tos.length >= MAX_TOS}
                onChange={(e) => setTo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTo(); } }} />
              <button type="button" className="btn ghost" disabled={!to.trim() || tos.length >= MAX_TOS} onClick={addTo}>추가</button>
            </span>
          </label>
        ) : (
          <label>누구에게 하고 싶은 말인가요?
            <input value={to} maxLength={20} placeholder="예: 엄마, 오랜 친구, 열일곱의 나" onChange={(e) => setTo(e.target.value)} />
          </label>
        )}

        {link && (
          <>
            <label>보내는 사람 이름 <small>받는 사람에게 보이는 이름이에요</small>
              <input value={fromName} maxLength={20} placeholder="예: 소라" onChange={(e) => setFromName(e.target.value)} />
            </label>
            <fieldset>
              <legend>얼마나 보관할까요?</legend>
              {KEEP.map((k) => (
                <label key={k.days} className={`chip ${expireDays === k.days ? "on" : ""}`}>
                  <input type="radio" name="keep" checked={expireDays === k.days} onChange={() => setExpireDays(k.days)} />{k.label}
                </label>
              ))}
            </fieldset>
          </>
        )}

        {!pty && <fieldset>
          <legend>이 사람과 마지막으로 이야기한 건 언제인가요?</legend>
          {GAPS.map((g) => (
            <label key={g.value} className={`chip ${gap === g.value ? "on" : ""}`}>
              <input type="radio" name="gap" checked={gap === g.value} onChange={() => setGap(g.value)} />
              {g.label}<small>{g.hint}</small>
            </label>
          ))}
        </fieldset>}

        <fieldset>
          <legend>편지지</legend>
          {PAPERS.map((p) => {
            const locked = p.need > orbsTotal;           // 기억 구슬을 충분히 모아야 열린다
            return (
              <label key={p.id} className={`chip ${paper === p.id ? "on" : ""} ${locked ? "locked" : ""}`} title={locked ? `기억 구슬 ${p.need}개` : p.label}>
                <input type="radio" name="paper" disabled={locked} checked={paper === p.id} onChange={() => setPaper(p.id)} />
                <i className="sw" style={{ background: p.color }} />{p.label}
                {locked && <small className="need"><Icon name="lock" size={12} />{p.need}</small>}
              </label>
            );
          })}
        </fieldset>

        {pty && (
          <>
            <fieldset>
              <legend>언제 도착할까요?</legend>
              {QUICK_WHEN.map((q) => (
                <button key={q.label} type="button" className="chip" onClick={() => setOpenAt(Date.now() + q.ms)}>{q.label}</button>
              ))}
              <input type="datetime-local" value={toLocal(openAt)} min={toLocal(Date.now() + MIN_FUTURE_MS)}
                onChange={(e) => { const t = new Date(e.target.value).getTime(); if (t) setOpenAt(t); }} />
              {!okWhen ? <p className="sub warn">도착 시각은 지금보다 1분 이상 뒤여야 해요.</p> : <p className="sub">{fmtWhen(openAt)}에 도착해요. 파티 편지는 언제나 가벼운 바람 속을 날아요.</p>}
            </fieldset>
            <PartyEditor party={party} onParty={setParty} voice={voice} onVoice={setVoice} consent={consent} onConsent={setConsent} onPreview={() => setPreview(true)} />
          </>
        )}

        {!link && !pty && (
          <fieldset>
            <legend>언제 도착할까요?</legend>
            {DELAYS.map((d) => (
              <label key={d.ms} className={`chip ${delay === d.ms ? "on" : ""}`}>
                <input type="radio" name="delay" checked={delay === d.ms} onChange={() => setDelay(d.ms)} />
                {d.label}
              </label>
            ))}
          </fieldset>
        )}

        <label>편지
          <textarea style={{ background: color }} value={body} maxLength={MAX} rows={8}
            placeholder="요즘 안부와 하고 싶은 말을 적어 보세요." onChange={(e) => setBody(e.target.value)} />
          <small className="count">{body.length} / {MAX}</small>
          {link && allTos.length > 1 && <small>본문에 {NAME_TOKEN}이라고 쓰면 받는 사람마다 그 사람 이름으로 바뀌어요.</small>}
        </label>

        <div className="row">
          <button className="btn" disabled={!ok}
            onClick={() => onSubmit({ mode, tos: allTos, to: allTos.length > 1 ? `${allTos[0]} 외 ${allTos.length - 1}명` : allTos[0], fromName: fromName.trim(), expireDays, gap: pty ? 1 : gap, paper, delay: pty ? openAt - Date.now() : delay, body: body.trim(), party: pty ? party : undefined, voice: pty && consent ? voice : null })}>
            부치러 가기
          </button>
          <button className="btn ghost" onClick={onBack}>돌아가기</button>
        </div>
      </div>
      {preview && createPortal(<div className="party-overlay"><PartyScene preview party={party} voiceUrl={consent ? voice?.url : null} from={fromName || myName} onClose={() => setPreview(false)} /></div>, document.body)}
    </main>
  );
}
