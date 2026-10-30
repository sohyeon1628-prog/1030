import React, { useEffect, useRef, useState } from "react";
import { MOODS, DECOS, SKIES, OUTFITS, CONCEPTS, MAX_VOICE_SEC } from "../party/config.js";
import { startRecording } from "../party/audio.js";
import Icon from "./Icon.jsx";

const Group = ({ title, items, value, onPick }) => (
  <fieldset>
    <legend>{title}</legend>
    {items.map((o) => (
      <label key={o.id} className={`chip ${value === o.id ? "on" : ""}`}>
        <input type="radio" name={title} checked={value === o.id} onChange={() => onPick(o.id)} />{o.label}
      </label>
    ))}
  </fieldset>
);

// 파티 꾸미기 + 목소리 녹음. 콘셉트로 한 번에 채우고 항목별로 고칠 수 있다. 녹음은 선택이고 없으면 마을의 기본 노래가 나온다.
export default function PartyEditor({ party, onParty, voice, onVoice, consent, onConsent, onPreview }) {
  const [rec, setRec] = useState(null);       // { sec } 녹음 중
  const [err, setErr] = useState("");
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.cancel(), []);
  const set = (k) => (v) => onParty({ ...party, [k]: v });

  const start = async () => {
    setErr("");
    try {
      ctl.current = await startRecording(MAX_VOICE_SEC, (sec) => setRec({ sec }));
      setRec({ sec: 0 });
      const r = await ctl.current.done;
      setRec(null); ctl.current = null;
      if (r) onVoice(r);
    } catch { setRec(null); setErr("마이크를 쓸 수 없어요. 허용했는지 확인해 주세요. 녹음 없이도 마을의 기본 노래가 나와요."); }
  };

  return (
    <div className="party-editor">
      <fieldset>
        <legend>콘셉트로 한 번에</legend>
        {CONCEPTS.map((c) => (
          <button key={c.id} type="button" className="chip" onClick={() => onParty({ ...party, mood: c.mood, deco: c.deco, sky: c.sky, outfit: c.outfit })}>
            <Icon name="party" size={16} />{c.label}
          </button>
        ))}
      </fieldset>
      <Group title="분위기" items={MOODS} value={party.mood} onPick={set("mood")} />
      <Group title="장식" items={DECOS} value={party.deco} onPick={set("deco")} />
      <Group title="하늘" items={SKIES} value={party.sky} onPick={set("sky")} />
      <Group title="마을 친구들 차림" items={OUTFITS} value={party.outfit} onPick={set("outfit")} />
      <label>현수막 문구 <small>무슨 날인지 직접 적어 주세요</small>
        <input value={party.banner} maxLength={14} placeholder="예: 생일 축하해요" onChange={(e) => set("banner")(e.target.value)} />
      </label>

      <fieldset className="voice">
        <legend>내 목소리로 노래하기 <small>선택 · 최대 {MAX_VOICE_SEC}초</small></legend>
        <p className="sub">마을 친구들이 내 목소리에 맞춰 입을 움직여요. 직접 지은 말이나 노래가 가장 좋아요. 저작권이 있는 노래는 피해 주세요. 녹음은 이 기기에만 저장되고 편지함에서 언제든 지울 수 있어요.</p>
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} />
          <span>내 목소리를 녹음해 파티에서 재생하는 것에 동의해요</span>
        </label>
        <div className="row voice-row">
          {!rec ? (
            <button type="button" className="btn ghost" disabled={!consent} onClick={start}>
              <Icon name="mic" size={18} />{voice ? "다시 녹음" : "녹음하기"}
            </button>
          ) : (
            <button type="button" className="btn rec" onClick={() => ctl.current?.stop()}>
              <Icon name="stop" size={18} />{rec.sec.toFixed(0)}초 · 멈추기
            </button>
          )}
          {voice && !rec && (
            <>
              <span className="tag ready">{voice.seconds.toFixed(0)}초 녹음됨</span>
              <button type="button" className="icon-act danger" onClick={() => onVoice(null)} aria-label="녹음 지우기" title="녹음 지우기"><Icon name="trash" size={18} /></button>
            </>
          )}
        </div>
        {err && <p className="sub warn">{err}</p>}
      </fieldset>

      <button type="button" className="btn ghost" onClick={onPreview}><Icon name="play" size={18} />미리 보기 (친구들이 부르는 모습)</button>
    </div>
  );
}
