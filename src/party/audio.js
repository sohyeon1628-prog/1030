import { isMuted } from "../game/audio.js";

// 파티 편지의 소리: 목소리 녹음, 저장/삭제, 재생과 소리 크기(입모양용). 기본 노래는 직접 만든 선율이다. 기본 노래는 직접 만든 선율이다.
const KEY = (id) => `wing-voice:${id}`;

// 목소리는 편지와 같은 기기(브라우저)에만 저장된다. 쓴 사람이 언제든 삭제할 수 있다.
export function saveVoice(id, url) { try { localStorage.setItem(KEY(id), url); return true; } catch { return false; } }
export function loadVoice(id) { try { return localStorage.getItem(KEY(id)); } catch { return null; } }
export function deleteVoice(id) { try { localStorage.removeItem(KEY(id)); } catch { /* 이미 없음 */ } }

// 녹음: 마이크 허락을 받고 시작해 maxSec에서 자동으로 멈춘다. done은 { url(data URL), seconds }로 끝난다.
export async function startRecording(maxSec, onTick) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : {});
  const chunks = [], t0 = performance.now();
  let timer, stopped = false, cancelled = false, resolveFn;
  const done = new Promise((res) => { resolveFn = res; });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    clearInterval(timer); stream.getTracks().forEach((t) => t.stop());
    if (cancelled || !chunks.length) return resolveFn(null);
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    resolveFn({ url, seconds: Math.min(maxSec, (performance.now() - t0) / 1000) });
  };
  const stop = () => { if (!stopped) { stopped = true; if (rec.state !== "inactive") rec.stop(); } };
  rec.start();
  timer = setInterval(() => { const s = (performance.now() - t0) / 1000; onTick?.(s); if (s >= maxSec) stop(); }, 100);
  return { stop, cancel: () => { cancelled = true; stop(); }, done };
}

// 재생: url이 있으면 녹음을, 없으면 기본 노래를 들려준다. level()은 지금 소리의 크기(0~1)이고 입이 벌어지는 정도에 쓴다.
let ctx = null;
const audioCtx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

// 기본 노래: 5음계로 직접 지은 짧은 선율과 낮은 반주(약 14초). 기존 곡을 쓰지 않는다.
const TUNE = [
  [659, 0.5], [659, 0.5], [784, 1], [659, 0.5], [587, 0.5], [523, 1], [587, 2],
  [784, 0.5], [784, 0.5], [880, 1], [784, 0.5], [659, 0.5], [587, 1], [659, 2],
  [523, 0.5], [587, 0.5], [659, 0.5], [784, 0.5], [880, 0.5], [784, 0.5], [659, 0.5], [587, 0.5], [523, 2.5],
];
const BEAT = 0.42;

export function createPlayer(url, onEnd) {
  const a = audioCtx(); a.resume?.();
  // 지도의 스피커 버튼이 꺼져 있으면 소리는 내지 않는다. 입모양은 소리 크기를 읽어 움직이므로 분석기는 그대로 앞에 둔다.
  const analyser = a.createAnalyser(); analyser.fftSize = 512;
  const out = a.createGain(); out.gain.value = isMuted() ? 0 : 1;
  analyser.connect(out); out.connect(a.destination);
  const buf = new Uint8Array(analyser.fftSize);
  let amp = 0, stopped = false, stopFn = () => {}, endTimer = null;
  const finish = () => { if (!stopped) { stopped = true; stopFn(); onEnd?.(); } };

  if (url) {
    const el = new Audio(url);
    const src = a.createMediaElementSource(el);
    src.connect(analyser);
    el.onended = finish;
    el.play().catch(finish);
    stopFn = () => { el.pause(); try { src.disconnect(); } catch { /* 이미 끊김 */ } };
  } else {
    const master = a.createGain(); master.gain.value = 0.5; master.connect(analyser);
    let t = a.currentTime + 0.3;
    const note = (f, dur, type, vol, at) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
    };
    for (const [f, beats] of TUNE) { const d = beats * BEAT; note(f, d * 0.95, "triangle", 0.5, t); note(f / 2, d * 0.95, "sine", 0.18, t); t += d; }
    for (let b = 0, at = a.currentTime + 0.3; at < t; b++, at += BEAT * 4) { note(b % 2 ? 196 : 131, BEAT * 3.6, "sine", 0.22, at); }
    endTimer = setTimeout(finish, (t - a.currentTime) * 1000 + 600);
    stopFn = () => { clearTimeout(endTimer); try { master.disconnect(); } catch { /* 이미 끊김 */ } };
  }
  return {
    level() {
      analyser.getByteTimeDomainData(buf);
      let s = 0; for (const v of buf) { const d = (v - 128) / 128; s += d * d; }
      const rms = Math.sqrt(s / buf.length);
      amp += (Math.min(1, rms * 5.5) - amp) * 0.45;
      return amp;
    },
    stop() { stopped = true; clearTimeout(endTimer); stopFn(); },
  };
}
