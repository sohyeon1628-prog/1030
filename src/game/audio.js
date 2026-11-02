// 비행 사운드: 바람 소리, 잔잔한 배경 선율, 효과음(차임·충돌·물보라·이륙·착륙·콤보). 전부 코드로 만들어 낸다(오디오 파일 없음).
// 지도 화면의 스피커 버튼(setMuted)이 이 파일의 모든 소리를 한꺼번에 켜고 끈다.
let ac = null;
let wind = null;
let bgm = null;
let muted = false;
let noiseBuf = null;
import { getVolume, onVolume } from "../volume.js";
// 효과음과 바람 소리는 하나의 통로(fxBus)를 지나 스피커로 나간다. 효과음 크기 슬라이더가 이 통로의 크기를 바꾼다.
let fxBus = null;
const out = () => {
  if (!ac) return null;
  if (!fxBus) { fxBus = ac.createGain(); fxBus.gain.value = getVolume().fx; fxBus.connect(ac.destination); }
  return fxBus;
};
onVolume((v) => {
  try {
    if (fxBus) fxBus.gain.setTargetAtTime(v.fx, ac.currentTime, 0.03);
    if (bgm) bgm.master.gain.setTargetAtTime(Math.max(0.0001, BGM_VOL * v.bgm), ac.currentTime, 0.05);
  } catch { /* 소리가 없는 상태 */ }
});

export function audioStart() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    ac.resume();
    if (wind || muted) return;
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = "bandpass"; filt.Q.value = 0.8;
    const gain = ac.createGain();
    gain.gain.value = 0.05;
    src.connect(filt).connect(gain).connect(out());
    src.start();
    wind = { src, filt };
    startBgm();
  } catch { /* 사운드 실패는 게임에 영향 없음 */ }
}

// 배경음악: 코드(C-Am-F-G)를 이어 주는 부드러운 패드 위에, 5음계 선율과 베이스가 얹힌다. 박자는 0.5초, 한 마디 8박(4초). 미리 1초 앞까지만 예약한다.
// 노트북·휴대폰 스피커는 낮은 소리를 거의 못 내서, 베이스는 배음이 있는 삼각파로 하고 선율은 한 옥타브 위를 겹친다.
const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
const BASS = [131, 110, 87.3, 98];
const BGM_VOL = 0.5;                                  // 배경음악 전체 크기(효과음·바람과의 균형은 여기서 맞춘다)
function startBgm() {
  if (bgm || muted || !ac) return;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime); master.gain.exponentialRampToValueAtTime(Math.max(0.0001, BGM_VOL * getVolume().bgm), ac.currentTime + 2);   // 천천히 들어온다
  master.connect(ac.destination);
  const note = (f, at, dur, type, vol, att = 0.05) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + att); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
  };
  // 패드는 직선으로 차오르고 사라진다. 다음 마디와 1.2초 겹치게 해서 소리가 한 번도 비지 않는다(지수 곡선은 겹치는 구간에서 둘 다 거의 0이 된다).
  const pad = (f, at, dur, vol) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 1.2); g.gain.setValueAtTime(vol, at + dur - 1.2); g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
  };
  let beat = 0, at = ac.currentTime + 0.2, deg = 4;
  const timer = setInterval(() => {
    if (!ac) return;
    while (at < ac.currentTime + 1) {
      const bar = Math.floor(beat / 8) % BASS.length;
      if (beat % 8 === 0) {
        for (const f of CHORDS[bar]) pad(f, at, 5.2, 0.06);
        note(BASS[bar], at, 3.8, "triangle", 0.13, 0.08);
      }
      if (beat % 4 === 2) note(BASS[bar] * 2, at, 0.9, "triangle", 0.06, 0.04);          // 박 사이를 메우는 가벼운 베이스
      if (beat % 2 === 0 && Math.random() < 0.8) {                                       // 선율은 이웃한 음으로 걷고, 가끔 쉰다
        deg = Math.max(0, Math.min(PENTA.length * 2 - 1, deg + pick([-2, -1, -1, 1, 1, 2])));
        const semi = PENTA[deg % PENTA.length] + 12 * Math.floor(deg / PENTA.length);
        const f = 330 * 2 ** (semi / 12);
        note(f, at, 1.4, "triangle", 0.1, 0.03); note(f * 2, at, 0.9, "sine", 0.035, 0.03);
      }
      at += 0.5; beat++;
    }
  }, 250);
  bgm = { timer, master };
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function stopBgm() {
  if (!bgm) return;
  const { timer, master } = bgm; bgm = null;
  clearInterval(timer);
  try { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4); setTimeout(() => master.disconnect(), 600); } catch { /* 이미 끊김 */ }
}

export function audioUpdate(thrust) {
  if (wind) wind.filt.frequency.value = 350 + 900 * thrust;
}

export function audioStop() {
  try { wind?.src.stop(); } catch { /* 이미 정지 */ }
  wind = null;
  stopBgm();
}

export function setMuted(m) {
  muted = m;
  if (m) audioStop();
}
export const isMuted = () => muted;

function tone(freq, dur, type, vol) {
  if (!ac || muted) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(out());
  o.start(); o.stop(ac.currentTime + dur);
}

const noise = () => {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
};
// 걸러 낸 노이즈 한 번: 필터 주파수가 f0에서 f1로 미끄러지며 vol에서 사라진다(물보라·바람 가르는 소리·발소리).
function puff(type, f0, f1, dur, vol, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noise();
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = 0.9;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.06, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out()); s.start(t); s.stop(t + dur + 0.05);
}
function glide(f0, f1, dur, type, vol, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out()); o.start(t); o.stop(t + dur);
}
// 같은 소리가 한꺼번에 겹쳐 시끄러워지지 않도록 gap초 안에 또 오면 건너뛴다
const lastAt = {};
const gate = (key, gap) => { const n = performance.now(); if (n - (lastAt[key] || -1e9) < gap * 1000) return false; lastAt[key] = n; return true; };

export const fx = {
  chime: (f) => tone(f, 0.35, "sine", 0.08),
  thud: () => tone(110, 0.2, "triangle", 0.15),
  crash: () => tone(80, 0.35, "sawtooth", 0.12),
  tick: () => tone(520, 0.1, "sine", 0.06),                                                  // 이륙 카운트다운
  takeoff: () => { puff("bandpass", 300, 1600, 0.8, 0.12); glide(330, 700, 0.5, "sine", 0.05); },   // 날개를 펴고 솟아오르는 소리
  land: () => { puff("lowpass", 500, 120, 0.25, 0.2); [523, 659, 784].forEach((f, i) => tone2(f, 0.45, 0.07, 0.07 * i)); },
  splash: () => { if (gate("splash", 0.2)) { puff("lowpass", 2600, 400, 0.6, 0.2); glide(200, 60, 0.35, "sine", 0.12); } },   // 상어·고래가 물을 박차거나 들어갈 때
  whoosh: () => { if (gate("whoosh", 0.3)) puff("bandpass", 1400, 300, 0.45, 0.07); },        // 새·비행기가 화면에 들어올 때
  warn: () => { if (gate("warn", 0.35)) tone(880, 0.09, "square", 0.025); },                  // 경고가 뜰 때
  combo: (n) => { const f = 660 + Math.min(n, 16) * 30; tone2(f, 0.2, 0.06, 0); tone2(f * 1.5, 0.25, 0.06, 0.08); },   // 연속 회피가 쌓일수록 높아진다
  bump: () => { puff("lowpass", 900, 150, 0.3, 0.16); glide(260, 110, 0.18, "triangle", 0.12); },        // 병이 기슭에 툭 부딪힌다
  pop: () => { glide(240, 880, 0.09, "sine", 0.16); puff("bandpass", 1800, 700, 0.12, 0.12); },            // 병마개가 뽕 하고 뽑힌다
  shield: () => { glide(400, 900, 0.3, "sine", 0.07); puff("highpass", 3000, 6000, 0.25, 0.05); },
};
function tone2(freq, dur, vol, delay) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out()); o.start(t); o.stop(t + dur);
}
