// 최소 사운드: 상승 중 피치가 오르는 바람 소리 + 통과 차임. 화면을 가리는 효과 없음.
let ac = null;
let wind = null;
let muted = false;

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
    src.connect(filt).connect(gain).connect(ac.destination);
    src.start();
    wind = { src, filt };
  } catch { /* 사운드 실패는 게임에 영향 없음 */ }
}

export function audioUpdate(thrust) {
  if (wind) wind.filt.frequency.value = 350 + 900 * thrust;
}

export function audioStop() {
  try { wind?.src.stop(); } catch { /* 이미 정지 */ }
  wind = null;
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
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur);
}

export const fx = {
  chime: (f) => tone(f, 0.35, "sine", 0.08),
  thud: () => tone(110, 0.2, "triangle", 0.15),
  crash: () => tone(80, 0.35, "sawtooth", 0.12),
};
