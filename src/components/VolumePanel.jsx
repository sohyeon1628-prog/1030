import React, { useEffect, useRef, useState } from "react";
import { getVolume, setVolume, onVolume } from "../volume.js";
import { audioStart, fx, isMuted, setMuted } from "../game/audio.js";
import Icon from "./Icon.jsx";

const ROWS = [{ k: "bgm", label: "음악" }, { k: "fx", label: "효과음·바람" }, { k: "voice", label: "목소리·노래" }];

// 소리 설정: 켜기/끄기와 세 가지 크기(음악, 효과음·바람, 목소리·노래). 값은 이 기기에 기억하고, 듣는 중에도 바로 반영된다.
export function VolumeControls() {
  const [v, setV] = useState(getVolume());
  const [muted, setMut] = useState(isMuted());
  useEffect(() => onVolume(setV), []);
  useEffect(() => { const f = () => setMut(isMuted()); addEventListener("naru-mute", f); return () => removeEventListener("naru-mute", f); }, []);
  const toggle = () => { setMuted(!isMuted()); if (!isMuted()) audioStart(); dispatchEvent(new Event("naru-mute")); };
  return (
    <div className="vol" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <button className={`vol-switch ${muted ? "" : "on"}`} role="switch" aria-checked={!muted} onClick={toggle}><Icon name={muted ? "mute" : "sound"} size={18} />소리 {muted ? "꺼짐" : "켜짐"}</button>
      {ROWS.map(({ k, label }) => (
        <label key={k} className="vol-row">
          <span>{label}</span>
          <input type="range" min="0" max="100" step="5" value={Math.round(v[k] * 100)} disabled={muted} aria-label={`${label} 크기`}
            onChange={(e) => setVolume({ [k]: Number(e.target.value) / 100 })}
            onPointerUp={() => { audioStart(); if (k === "fx") fx.chime(784); }} />
          <output>{Math.round(v[k] * 100)}</output>
        </label>
      ))}
    </div>
  );
}

// 스피커 버튼: 누르면 소리 설정이 펼쳐진다. 바깥을 누르면 닫힌다.
export default function SoundButton({ className = "", muted: mutedProp }) {
  const [open, setOpen] = useState(false);
  const [muted, setMut] = useState(isMuted());
  const box = useRef(null);
  useEffect(() => { const f = () => setMut(isMuted()); addEventListener("naru-mute", f); return () => removeEventListener("naru-mute", f); }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    addEventListener("pointerdown", away); return () => removeEventListener("pointerdown", away);
  }, [open]);
  const off = mutedProp ?? muted;
  return (
    <span className={`sound-wrap ${className}`} ref={box} onPointerDown={(e) => e.stopPropagation()}>
      <button className="icon-btn sound-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="소리 설정" title="소리 설정"><Icon name={off ? "mute" : "sound"} size={22} /></button>
      {open && <div className="vol-pop"><VolumeControls /></div>}
    </span>
  );
}
