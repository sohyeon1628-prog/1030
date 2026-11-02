import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildBottleScript, sentences, EPILOGUE_PLAYBACK } from "../data/chapters.js";
import { POST_ISLAND, buildIsland, makePostman, animatePostman, standStraight, blinkEyes, makeBottle, makeGull, animateGull, waterTexture } from "../three/parts.js";
import { audioStart, audioStop, fx } from "../game/audio.js";

// 병 편지 에필로그(열린 결말): 노을 지는 편지섬 기슭. 이 세계의 편지는 하늘의 바람길로 오는 것이 당연해서, 바다의 결을 따라 온 유리병을 의아해하며 연다.
// 유리병이 파도를 타고 다가와 기슭에 툭 부딪히고, 내가 주워 마개를 뽑아 돌돌 말린 편지를 펼친다. 보낸 사람도 편지의 내용도 보여 주지 않고, 노을빛이 쏟아지며 화면이 밝아지는 데서 끝난다.
// 카메라는 한 구도로 고정하지 않고 컷을 나눈다(대본 buildBottleScript의 at.shots):
//   wide 전경 → char 인물과 흘러오는 병 → bottle 파도 위 병 클로즈업 → face 인물 얼굴 → pov 인물 시점 → side 옆모습 → fp 1인칭(줍기·마개) → ots 어깨 너머(편지)
// 오프닝·에필로그와 같은 방식(시간 T의 함수, 자막 단위 건너뛰기·되감기)이다.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const backOut = (t) => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// 비율: 이 장면에서는 편지섬을 넓게(K배) 키우고, 사람은 집 문보다 조금 작게, 병은 사람 팔 길이쯤으로 한다.
// 지도에서 쓰는 섬은 지름이 3쯤이라 사람이 집만큼 커 보였다. 여기서는 잔디 지름이 6쯤, 집 벽 높이가 사람의 두 배쯤이다.
const K = 2.6;                                                                // 섬과 집의 확대 배율
const GT = 0.42;                                                              // 잔디 윗면의 수면 위 높이(모래층은 얕은 물속 선반이 된다)
const BASE_Y = GT - 0.58 * K;                                                 // 섬 그룹의 높이(원래 잔디 윗면이 0.58)
const PSCALE = 0.5;                                                           // 나(우체부) 크기
const BS = 0.3;                                                               // 병 크기
const P0 = new THREE.Vector3(POST_ISLAND.x, 0, POST_ISLAND.z);
const SPOT = new THREE.Vector3(P0.x - 2.55, 0, P0.z + 0.2);                  // 내가 서 있는 자리: 집에서 떨어진 잔디 서쪽 가장자리(서쪽을 본다)
const REST = new THREE.Vector3(SPOT.x - 0.85, 0.03, SPOT.z);                 // 병이 부딪혀 멈추는 물가(내 바로 앞)
// 서 있을 때의 발 높이: 모델의 가장 낮은 점이 잔디에 닿도록 잰다
const STAND_Y = (() => { const m = makePostman(); standStraight(m); m.scale.setScalar(PSCALE); m.children[0].rotation.z = -0.08; return GT + 0.02 - new THREE.Box3().setFromObject(m).min.y; })();
// 펼친 편지가 떠 있는 자리: 내 앞(서쪽) 바다 위. 어깨 너머 컷에서 카메라가 내 뒤에서 이 편지를 본다.
const PAPER = new THREE.Vector3(SPOT.x - 1.4, STAND_Y + 0.5, SPOT.z - 0.15);
const ROUTE = new THREE.CatmullRomCurve3([new THREE.Vector3(-20, 0.03, 21), new THREE.Vector3(-14, 0.03, 18.4), new THREE.Vector3(-9, 0.03, 16.0), new THREE.Vector3(-6, 0.03, 14.6), REST]);
const FOVS = { wide: 42, char: 40, bottle: 38, face: 34, pov: 52, side: 38, fp: 50, ots: 46 };
const DUSK = { sky: new THREE.Color("#f6a97c"), hemiSky: new THREE.Color("#ffd2a8"), hemiGround: new THREE.Color("#4d8fc0"), sun: new THREE.Color("#ffc890") };

// 읽을 수 없는 손글씨 줄(내용은 보여 주지 않는다)
function scribbleTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 360;
  const k = c.getContext("2d");
  k.fillStyle = "#fbf1d6"; k.fillRect(0, 0, 256, 360);
  k.strokeStyle = "rgba(120,80,40,.55)"; k.lineWidth = 2.2; k.lineCap = "round"; k.lineJoin = "round";
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 11; row++) {
    const y = 44 + row * 26; let x = 28;
    const end = row === 10 ? 120 : 228 - rnd() * 24;
    k.beginPath(); k.moveTo(x, y);
    while (x < end) { x += 5 + rnd() * 7; k.quadraticCurveTo(x - 3, y - 6 - rnd() * 7, x, y + (rnd() - 0.5) * 3); }
    k.stroke();
  }
  k.strokeStyle = "rgba(200,70,50,.8)"; k.lineWidth = 3; k.beginPath(); k.moveTo(28, 28); k.lineTo(96, 28); k.stroke();       // 첫 줄 머리말만 붉게
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function Bottle3D({ nickname = "", onDone }) {
  const wrap = useRef(null);
  const fadeEl = useRef(null);
  const cutEl = useRef(null);
  const timeRef = useRef(0);
  const endedRef = useRef(false);
  const scriptRef = useRef(null);
  if (!scriptRef.current) scriptRef.current = buildBottleScript(nickname.trim() || "나");
  const caps = scriptRef.current.caps, AT = scriptRef.current.at;
  const [idx, setIdx] = useState(-1);
  const [ended, setEnded] = useState(false);
  const [fail, setFail] = useState(false);

  const back = () => {
    if (endedRef.current) return;
    const T = timeRef.current;
    let cur = -1; caps.forEach((c, n) => { if (c.t <= T) cur = n; });
    if (cur >= 0 && T - caps[cur].t > 1.2) timeRef.current = caps[cur].t + 0.05;
    else timeRef.current = cur > 0 ? caps[cur - 1].t + 0.05 : 0;
  };
  const advance = () => {
    if (endedRef.current) return;
    const T = timeRef.current, next = caps.find((c) => c.t > T + 0.6);
    timeRef.current = next ? next.t - 0.3 : AT.endT;
  };
  const skip = () => { timeRef.current = AT.endT; };

  useEffect(() => {
    audioStart();                                              // 바람 소리와 잔잔한 배경음(소리 끄기 상태면 조용하다)
    const el = wrap.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFail(true); return () => audioStop(); }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(renderer.domElement); renderer.domElement.className = "w3d-canvas";

    const scene = new THREE.Scene();
    scene.background = DUSK.sky.clone(); scene.fog = new THREE.Fog(DUSK.sky.clone(), 34, 150);
    const cam = new THREE.PerspectiveCamera(42, 1, 0.03, 300); scene.add(cam);                      // 카메라가 장면에 들어 있어야 1인칭의 손이 따라온다
    const hemi = new THREE.HemisphereLight(DUSK.hemiSky, DUSK.hemiGround, 1.0);
    const sun = new THREE.DirectionalLight(DUSK.sun, 2.4);
    sun.position.set(-12, 7, 24); sun.target.position.set(P0.x, 0.5, P0.z);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    const paperLight = new THREE.PointLight(0xffd9a0, 0, 5); paperLight.position.copy(PAPER).add(new THREE.Vector3(0.4, 0.1, 0.1));
    scene.add(hemi, sun, sun.target, paperLight);

    const wtex = waterTexture();
    const seaMat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, transparent: true, opacity: 0.9, color: "#c9bdf2" });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), seaMat); sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; scene.add(sea);
    const world = new THREE.Group(); scene.add(world);

    // 해: 수평선 가까이에 낮게 걸린다(장식)
    const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 18), new THREE.MeshBasicMaterial({ color: "#fff0c0", fog: false })); sunDisk.position.set(40, 9, -50); scene.add(sunDisk);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 18), new THREE.MeshBasicMaterial({ color: "#ffb070", transparent: true, opacity: 0.35, fog: false, depthWrite: false })); glow.position.copy(sunDisk.position); scene.add(glow);

    // 편지섬: 넓게 키우고, 창가에 불이 켜진 저녁
    const post = buildIsland({ x: P0.x, z: P0.z, style: "post" }); post.scale.setScalar(K); post.position.y = BASE_Y; world.add(post);
    const foam0 = post.getObjectByName("foam"); if (foam0) foam0.position.y = (0.04 - BASE_Y) / K;      // 물거품 고리는 수면에 둔다
    const windowLamp = new THREE.PointLight(0xffc880, 2.4, 12); windowLamp.position.set(P0.x - 0.4, GT + 0.9, P0.z + 2.0); scene.add(windowLamp);

    // 밀려오는 물결: 기슭을 향해 천천히 오는 하얀 물마루
    const crests = Array.from({ length: 16 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4 + (i % 3) * 0.6, 0.11), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2 + (i % 5 - 2) * 0.05; world.add(m);
      return { m, ph: (i * 0.137) % 1, z: 10.5 + (i * 7.3) % 11 };
    });
    const ripples = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; world.add(r); return r; });
    const gulls = [0, 1].map((k) => { const g = makeGull(); g.scale.setScalar(1.1); world.add(g); return { g, k }; });

    // 하늘의 바람길: 편지는 늘 이 길을 타고 섬으로 온다(금빛 입자가 하늘에서 편지섬으로 흘러내린다). 바다로 온 병과 대비된다.
    const road = new THREE.QuadraticBezierCurve3(new THREE.Vector3(24, 10, -2), new THREE.Vector3(9, 8.2, 8), new THREE.Vector3(P0.x + 0.2, 5.4, P0.z));
    const dots = Array.from({ length: 22 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.9, fog: false })); scene.add(d); return d; });

    // 나
    const me = makePostman(); standStraight(me); me.scale.setScalar(PSCALE); me.children[0].rotation.z = -0.08; me.position.set(SPOT.x, STAND_Y, SPOT.z); me.rotation.y = Math.PI;
    me.traverse((o) => { o.castShadow = true; }); world.add(me);
    const lean = me.children[0], myHead = me.userData.head;

    // 병: holder(위치·방향) → tilt(누움/세움) → bottle(길이 방향 굴러가기)
    const holder = new THREE.Group(), tilt = new THREE.Group(), bottle = makeBottle(); bottle.scale.setScalar(BS);
    holder.add(tilt); tilt.add(bottle); world.add(holder);
    const cork = bottle.userData.cork, scrollIn = bottle.userData.scroll;
    const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"), g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,242,176,.9)"); g.addColorStop(1, "rgba(255,242,176,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const bottleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); bottleGlow.scale.setScalar(0.9); holder.add(bottleGlow);   // 부드러운 빛 번짐(각진 구 모양이 보이지 않게 스프라이트로)   // 멀리서도 반짝여 보이게
    // 병 밖으로 나온 편지(말린 것 → 펼친 것)
    const scrollOut = bottle.userData.scroll.clone(); scrollOut.scale.setScalar(BS * 1.15); scrollOut.visible = false; world.add(scrollOut);
    const ptex = scribbleTexture();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshBasicMaterial({ map: ptex, side: THREE.DoubleSide, color: "#fff7e0" })); paper.position.copy(PAPER); paper.scale.set(0.001, 0.001, 1); world.add(paper);

    // 1인칭의 손: 카메라에 붙어 병을 쥔다(1인칭 컷에서만 보인다)
    const fpRig = new THREE.Group(); fpRig.visible = false; cam.add(fpRig);
    const limb = (a, b, r, color) => {
      const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, d.length() - 2 * r), 6, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
    };
    [-1, 1].forEach((sd) => {
      const hand = new THREE.Vector3(sd * 0.085, -0.17, -0.42);
      fpRig.add(limb(new THREE.Vector3(sd * 0.3, -0.52, -0.16), hand, 0.04, "#4f7fb5"));
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), new THREE.MeshStandardMaterial({ color: "#f6d2b0", roughness: 0.8 })); h.position.copy(hand); fpRig.add(h);
    });

    // 불꽃 가루: 마개가 뽑힐 때, 편지를 펼 때
    const spark = (n, col) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: 0.04, transparent: true, opacity: 0, depthWrite: false })); world.add(pts);
      return { pts, dirs: Array.from({ length: n }, () => new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.9 + 0.2, (Math.random() - 0.5)).multiplyScalar(0.7 + Math.random() * 0.9)) };
    };
    const popSpark = spark(40, "#fff2b0"), unrollSpark = spark(60, "#ffd9a0");
    const burst = (s, o, u, R) => { const p = s.pts.geometry.attributes.position; s.dirs.forEach((d, k) => p.setXYZ(k, o.x + d.x * u * R, o.y + d.y * u * R - u * u * 0.4, o.z + d.z * u * R)); p.needsUpdate = true; s.pts.material.opacity = u <= 0 || u >= 1 ? 0 : (u < 0.1 ? u * 10 : 1 - u); };

    const resize = () => { const w = el.clientWidth, h = el.clientHeight || 1; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(el);

    const SH = AT.shots;
    const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), look = new THREE.Vector3();
    const tmp = new THREE.Vector3(), headW = new THREE.Vector3(), eye = new THREE.Vector3(), base = new THREE.Vector3(), neck = new THREE.Vector3(), camUp = new THREE.Vector3(), hold = new THREE.Vector3();
    const fpScroll = new THREE.Vector3(SPOT.x - 0.5, STAND_Y + 0.4, SPOT.z);                  // 1인칭 컷의 마지막에 편지가 떠 있던 자리(어깨 너머 컷에서 여기서 출발한다)
    let curShot = -1, cutFlash = 0, raf, last = performance.now(), A = 0, prevT = 0, lastIdx = -2, lastEnded = false, lastFov = 0;

    // 병이 물 위에 있을 때의 자리(멀리서 파도를 타고 와서 기슭에 닿고, 부딪혀 살짝 튕겼다 돌아온다)
    const bottleBase = (T, out) => {
      const flo = clamp((T - AT.floatFrom) / (AT.bumpT - AT.floatFrom), 0, 1), since = T - AT.bumpT;
      ROUTE.getPoint(flo, out);
      if (since > 0) { const q = clamp(since / 1.1, 0, 1); out.x -= Math.sin(q * Math.PI) * 0.14 * (1 - q * 0.2); }
      return out;
    };

    // 컷별 카메라: 위치·바라보는 곳
    const shotCam = (kind, T, t0, t1) => {
      const e = smooth((T - t0) / Math.max(0.01, t1 - t0));
      eye.copy(headW).add(tmp.set(-0.1, 0.03, 0));                                   // 인물의 눈(서쪽을 본다)
      switch (kind) {
        case "wide": tPos.set(lerp(-13, -11.5, e), lerp(3.8, 3.0, e), lerp(22.5, 20.8, e)); tLook.set(-3, 0.5, 13.5); break;
        case "char": tPos.set(SPOT.x - 2.8 + e * 0.5, STAND_Y + 0.45, SPOT.z + 3.0); tLook.set(SPOT.x - 1.0, STAND_Y + 0.2, SPOT.z - 0.2); break;      // 인물을 잡고, 바다 쪽에서 병이 흘러온다
        case "bottle": bottleBase(T, base); tPos.copy(base).add(tmp.set(0.9, 0.16, 1.1)); tLook.copy(base).add(tmp.set(-0.05, 0.05, 0)); break;      // 파도 위를 따라가는 병 클로즈업
        case "face": tPos.copy(headW).add(tmp.set(-1.15, 0.05, 1.1)); tLook.copy(headW).add(tmp.set(0, -0.02, 0)); break;                    // 갸웃하는 얼굴
        case "pov": tPos.copy(eye); bottleBase(T, base); tLook.copy(base).add(tmp.set(0, 0.05, 0)); break;                                  // 인물의 시점: 병이 밀려와 부딪힌다
        case "side": tPos.set(SPOT.x - 1.0, STAND_Y + 0.35, SPOT.z + 2.6); tLook.set(SPOT.x - 0.9, STAND_Y + 0.1, SPOT.z); break;
        case "fp": {                                                                                                                       // 1인칭: 물가의 병을 내려다보다가, 병을 들고 마개를 본다
          const q = smooth((T - AT.pickFrom) / (AT.pickTo - AT.pickFrom));
          // 병을 주우러 가기 전에는 한 걸음 뒤에서 비스듬히 내려다보고(가파르게 내려다보면 물결이 일그러진다), 병을 들면서 눈높이로 다가온다
          tPos.copy(eye).add(tmp.set(0.55 * (1 - q), 0.14 * (1 - q), 0)); tLook.copy(REST).add(tmp.set(0, 0.12, 0)).lerp(tmp.copy(eye).add(new THREE.Vector3(-1, -0.15, 0)), q); break;
        }
        default: tPos.copy(headW).add(tmp.set(1.0, 0.2, -0.38)); tLook.copy(PAPER); break;                                                 // ots: 인물의 어깨 너머로 펼쳐진 편지
      }
    };

    const frame = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);   // 첫 프레임의 시각이 시계보다 앞서도 음수가 되지 않게 last = now; A += dt;
      timeRef.current += dt * EPILOGUE_PLAYBACK;
      const T = timeRef.current;
      const crossed = (x) => prevT < x && T >= x;                                   // 각 순간을 지날 때 소리 한 번
      if (crossed(AT.bumpT)) fx.bump();
      if (crossed(AT.uncorkT)) fx.pop();
      if (crossed(AT.slideT)) fx.chime(660);
      if (crossed(AT.unrollT)) fx.chime(990);
      prevT = T;

      wtex.offset.set(A * 0.012, A * 0.02);
      post.position.y = BASE_Y + Math.sin(A * 1.3 + 8.5) * 0.03; const pf = post.getObjectByName("foam"); if (pf) pf.scale.setScalar(1 + Math.sin(A * 1.6 + 5) * 0.05);
      crests.forEach(({ m, ph, z }) => {
        const p = (A * 0.07 + ph) % 1, x = -22 + p * 16.6;
        m.position.set(x, 0.05, z + Math.sin(A * 0.6 + ph * 9) * 0.3); m.material.opacity = 0.42 * Math.sin(Math.PI * p) * (p > 0.8 ? (1 - p) / 0.2 : 1);
      });
      gulls.forEach(({ g, k }) => { const a = A * 0.25 + k * 3; g.position.set(-2 + Math.cos(a) * 9, 5 + k * 1.3 + Math.sin(a * 2) * 0.3, 8 + Math.sin(a) * 4); g.rotation.y = -a - Math.PI / 2; animateGull(g, A, k * 2); });
      dots.forEach((d, k) => { d.position.copy(road.getPoint(((A / 9) + k / dots.length) % 1)); d.material.opacity = 0.9 * (1 - smooth((T - AT.pickFrom) / 3)); });

      // 나: 기슭에 서서 바다를 바라보다가, 병을 보고 고개를 갸웃한다
      myHead.rotation.z = Math.sin(A * 3) * 0.03 + 0.34 * smooth((T - AT.doubtT) / 0.7) * (1 - smooth((T - (AT.doubtT + 2.6)) / 0.8));
      lean.rotation.z = -0.08;
      me.position.set(SPOT.x, STAND_Y + Math.sin(A * 1.8) * 0.01, SPOT.z); animatePostman(me, A, 0.12);
      me.rotation.y = Math.PI + Math.sin(A * 0.4) * 0.05;
      { const bp = (A % 3.6); blinkEyes(me, bp < 0.16 ? Math.sin((bp / 0.16) * Math.PI) : (A % 7.9 < 0.14 ? Math.sin(((A % 7.9) / 0.14) * Math.PI) : 0)); }   // 몇 초마다 눈을 깜빡인다
      me.updateMatrixWorld(true); myHead.getWorldPosition(headW);

      // 카메라: 지금 컷을 고른다. 컷이 바뀌는 순간에는 바로 건너뛰고 화면이 잠깐 어두워졌다 돌아온다(자연스러운 컷 전환)
      let si = 0; while (si < SH.length - 1 && T >= SH[si + 1].t) si++;
      const shot = SH[si], nextT = SH[si + 1] ? SH[si + 1].t : AT.endT;
      shotCam(shot.k, T, shot.t, nextT);
      if (si !== curShot) { curShot = si; camPos.copy(tPos); camLook.copy(tLook); cutFlash = 0.55; }
      const kf = 1 - Math.exp(-dt * (shot.k === "fp" || shot.k === "pov" ? 30 : 9)); camPos.lerp(tPos, kf); camLook.lerp(tLook, kf);
      cam.position.copy(camPos); look.copy(camLook); cam.lookAt(look);
      if (FOVS[shot.k] !== lastFov) { lastFov = FOVS[shot.k]; cam.fov = lastFov; cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld(true);
      const fp = shot.k === "fp";
      me.visible = !fp && shot.k !== "pov";                                         // 1인칭·인물 시점에서는 내 몸이 보이지 않는다(눈 안에서 보면 머리와 가방이 화면을 가린다)
      const near = fp || shot.k === "pov";
      seaMat.roughness = near ? 0.9 : 0.3; if (foam0) foam0.visible = !near;               // 가까이서 내려다볼 때 바다의 반사와 거품 고리가 일그러져 보이지 않게
      crests.forEach(({ m }) => { if (near) m.material.opacity = 0; });
      windowLamp.intensity = near ? 0.5 : 2.4;                    // 물 위에 번쩍이는 창가 불빛의 반사가 화면을 덮지 않게
      const pickQ = smooth((T - AT.pickFrom) / (AT.pickTo - AT.pickFrom));
      fpRig.visible = fp; fpRig.position.y = -0.35 * (1 - pickQ);
      if (cutEl.current) { cutFlash = Math.max(0, cutFlash - dt * 3.2); cutEl.current.style.opacity = String(cutFlash); }

      // 병: 멀리서 반짝이다가 → 파도를 타고 다가와 → 툭 부딪히고 → 1인칭으로 내 손에
      bottleBase(T, base); holder.position.copy(base);
      holder.position.y = 0.03 + Math.sin(A * 2.1) * 0.015 + Math.max(0, Math.sin(clamp(T - AT.bumpT, 0, 1) * Math.PI)) * 0.015;
      holder.quaternion.identity();
      const since = T - AT.bumpT;
      tilt.rotation.z = -Math.PI / 2 + Math.sin(A * 1.3) * 0.1 + (since > 0 ? Math.exp(-since * 2.2) * Math.sin(since * 9) * 0.18 : 0);
      bottle.rotation.y = A * 0.9;
      if (T >= AT.pickFrom) {
        hold.set(0, -0.1, -0.45); cam.localToWorld(hold);                          // 카메라 앞, 두 손 사이
        holder.position.lerpVectors(tmp.copy(base).setY(0.03), hold, pickQ); holder.position.y += Math.sin(pickQ * Math.PI) * 0.1;
        holder.quaternion.slerp(cam.quaternion, pickQ);
        tilt.rotation.z = lerp(-Math.PI / 2, 0.0, pickQ) + Math.sin(A * 1.6) * 0.02 * pickQ;
        bottle.rotation.y = lerp(A * 0.9, 0, pickQ) + (T > AT.pickTo ? Math.sin((T - AT.pickTo) * 0.9) * 0.9 : 0);     // 손에 든 병을 돌려 보며 이름이 없는지 살핀다
      }
      holder.visible = T >= AT.floatFrom - 0.5 && T < AT.otsT;
      bottleGlow.material.opacity = T < AT.bumpT ? (0.2 + 0.2 * Math.sin(A * 4)) * smooth((T - AT.floatFrom) / 2) * (1 - clamp((T - AT.floatFrom) / (AT.bumpT - AT.floatFrom), 0, 1) * 0.7) : 0;
      ripples.forEach((r, n) => { const q = ((A * 0.5 + n / 3) % 1); r.position.set(base.x, 0.04, base.z); r.scale.setScalar(0.15 + q * 0.9); r.material.opacity = T > AT.floatFrom && T < AT.pickFrom + 1 ? (1 - q) * 0.5 : 0; });
      holder.updateMatrixWorld(true); bottle.localToWorld(neck.set(0, 0.66, 0));      // 병목의 세계 좌표(마개·종이가 나오는 곳)

      // 마개: 뽕 하고 튀어 오른다
      const cq = (T - AT.uncorkT) / 1.1;
      if (cq < 0) { cork.visible = true; cork.position.set(0, 0.69, 0); cork.rotation.set(0, 0, 0); }
      else { cork.visible = cq < 1.4; cork.position.set(0.18 * cq, 0.69 + 1.6 * cq - 2.2 * cq * cq, 0.05 * cq); cork.rotation.set(cq * 5, 0, cq * 7); }
      burst(popSpark, neck, clamp((T - AT.uncorkT) / 1.0, 0, 1), 0.4);

      // 편지: 병 속 → 병목에서 위로 미끄러져 나옴(1인칭 컷) → 어깨 너머 컷에서 내 앞 허공으로 떠올라 펼쳐짐
      scrollIn.visible = T < AT.slideT;
      const uq = smooth((T - AT.unrollT) / 1.8);
      scrollOut.visible = T >= AT.slideT && uq < 1;
      if (scrollOut.visible) {
        if (T < AT.otsT) {
          const sq = smooth((T - AT.slideT) / 1.6); camUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
          scrollOut.position.copy(neck).addScaledVector(camUp, 0.32 * sq); fpScroll.copy(scrollOut.position);
          scrollOut.rotation.set(0, A * 0.8 * sq, 0.05);
        } else {
          const rq = smooth((T - AT.otsT) / Math.max(0.01, AT.unrollT - AT.otsT));
          scrollOut.position.lerpVectors(fpScroll, PAPER, rq); scrollOut.position.y += Math.sin(rq * Math.PI) * 0.12;
          scrollOut.rotation.set(0, A * 0.8, lerp(0.05, Math.PI / 2, rq));
        }
        scrollOut.scale.set(BS * 1.15 * (1 - uq), BS * 1.15, BS * 1.15 * (1 - uq));
      }
      paper.scale.set(Math.max(0.001, backOut(uq)), Math.max(0.001, backOut(uq)), 1);
      paper.rotation.y = Math.PI / 2 + Math.sin(A * 0.7) * 0.05;                    // 어깨 너머에서 보는 카메라(동쪽)를 향한다
      paper.position.y = PAPER.y + Math.sin(A * 1.4) * 0.015;
      paperLight.intensity = 3.4 * uq;
      burst(unrollSpark, PAPER, clamp((T - AT.unrollT) / 2.2, 0, 1), 0.7);

      // 마지막: 노을빛이 쏟아지며 화면이 밝아진다
      if (fadeEl.current) fadeEl.current.style.opacity = String(smooth((T - AT.fadeT) / (AT.endT - AT.fadeT)) * 0.96);
      renderer.render(scene, cam);

      let ci = -1; caps.forEach((c, n) => { if (T >= c.t && T < c.end) ci = n; });
      if (ci !== lastIdx) { lastIdx = ci; setIdx(ci); }
      const e = T >= AT.endT; if (e !== lastEnded) { lastEnded = e; endedRef.current = e; setEnded(e); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const key = (e) => {
      if (endedRef.current || e.target.tagName === "BUTTON") return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight") { e.preventDefault(); advance(); }
      else if (e.code === "ArrowLeft" || e.code === "Backspace") { e.preventDefault(); back(); }
    };
    addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("keydown", key); audioStop();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); wtex.dispose(); ptex.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (fail) { endedRef.current = true; setEnded(true); } }, [fail]);

  const cap = caps[idx];
  return (
    <div className={`intro bottle ${ended ? "ended" : ""}`} ref={wrap} onPointerDown={ended ? undefined : advance}>
      <div className="bottle-cut" ref={cutEl} />
      <div className="bottle-fade" ref={fadeEl} />
      {!ended && (
        <>
          <div className="letterbox top" /><div className="letterbox bottom" />
          <button className="pill intro-back" onPointerDown={(e) => e.stopPropagation()} onClick={back}>‹ 이전</button>
          <button className="pill intro-skip" onPointerDown={(e) => e.stopPropagation()} onClick={skip}>건너뛰기</button>
          {cap && <p key={idx} className="intro-cap narr fade" aria-live="polite">{sentences(cap.text).map((x, i) => <span key={i} className="cap-s">{x}</span>)}</p>}
          <p className="intro-hint">화면을 누르면 다음 장면 · ← 키로 이전 장면</p>
        </>
      )}
      {ended && (
        <div className="bottle-end fade">
          <p>바람길이 아닌, 바다가 실어 온 편지. 누가 보낸 걸까.</p>
          <button className="btn" onClick={() => onDone?.()}>편지함으로</button>
        </div>
      )}
    </div>
  );
}
