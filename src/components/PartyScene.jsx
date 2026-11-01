import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { MOODS, DEFAULT_PARTY } from "../party/config.js";
import { createPlayer } from "../party/audio.js";
import { mesh, box, puck, palm, bush, waterTexture, makePostman, animatePostman, makeEnvelope } from "../three/parts.js";
import { COLORS, addBanner, buildStage } from "./partyStages.js";
import { josa } from "../data/chapters.js";
import Icon from "./Icon.jsx";

// 도착 영상(intro): 받는 사람이 링크를 열면 먼저 해무가 편지를 들고 멀리서 날아와 무대에 내려앉는다(ARRIVE초). 그 뒤에 노래가 시작되고, 끝나면 onDone(편지가 열린다).
const ARRIVE = 6;
const sm01 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// 파티: 콘셉트(무대)에 따라 섬 위 항구의 마을 친구들 / 바닷속의 해무와 바다 친구들 / 하늘 위 구름 무대의 갈매기 친구들이 모여, 녹음한 목소리(없으면 기본 노래)에 맞춰 노래한다.
// 입모양 1단계: 지금 소리의 크기에 맞춰 입이 열리고 닫힌다. 노래가 끝나면 onDone(편지가 열린다).
const SKY = {
  day: { bg: "#bfe6f5", hemi: [0xe4f6ff, 0x4aa3cf, 1.1], sun: [0xfff4e0, 2.2], fog: 60 },
  dusk: { bg: "#f6b48c", hemi: [0xffd2a8, 0x7a6aa0, 0.95], sun: [0xffc890, 1.8], fog: 55 },
  night: { bg: "#151a45", hemi: [0x8aa0ff, 0x1b2150, 0.55], sun: [0x9fb4ff, 0.7], fog: 45 },
};
// 바닷속·하늘 위 무대는 하늘 설정과 무관하게 자기 빛과 안개를 쓴다(바닷속은 안개가 가깝고 푸르다)
const STAGE_SKY = {
  sea: { bg: "#0b6aa0", hemi: [0x8fd8ff, 0x0a3a66, 1.0], sun: [0xcfeeff, 1.3], fog: 14, near: 3 },
  sky: { bg: "#9fd8ff", hemi: [0xf4fbff, 0x8fb8e8, 1.15], sun: [0xfff4e0, 2.0], fog: 70, near: 20 },
};
const SKINS = ["#f6d2b0", "#e9b98f", "#f3c9a8", "#d9a77c"];
// 섬 친구들: 우체부처럼 큰 머리의 장난감 사람들. 저마다 다른 일을 하며 노래한다.
// 0 탬버린, 1 춤, 2 박수, 3 손 흔들기, 4 마라카스, 5 폴짝폴짝
const PEOPLE = [
  { job: "tambourine", cloth: "#e8553a", skin: 0, hair: "#2b1d1a", style: "short" },
  { job: "dance", cloth: "#c78fe0", skin: 1, hair: "#6b3a22", style: "pigtail" },
  { job: "clap", cloth: "#5ec9a7", skin: 2, hair: "#d9b36a", style: "bun" },
  { job: "wave", cloth: "#f59a4a", skin: 3, hair: "#3b2a24", style: "curly" },
  { job: "maracas", cloth: "#5aa3d4", skin: 0, hair: "#8a8f99", style: "short" },
  { job: "jump", cloth: "#ffd166", skin: 1, hair: "#c9483a", style: "pigtail" },
];
const sm = (x) => (1 - Math.cos(x)) / 2;   // 0~1로 부드럽게 오르내리는 파형(꺾이는 곳이 없다)

function makeVillager(i, outfit) {
  const { job, cloth, skin, hair, style } = PEOPLE[i % PEOPLE.length];
  const sk = SKINS[skin];
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);                       // 흔들림·뛰기는 몸 전체 그룹에
  body.add(mesh(new THREE.CapsuleGeometry(0.2, 0.28, 8, 14), cloth, 0, 0.62, 0));
  const belt = mesh(new THREE.TorusGeometry(0.205, 0.03, 8, 22), "#3d2a22", 0, 0.46, 0); belt.rotation.x = Math.PI / 2; body.add(belt);
  const scarf = mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 22), COLORS[(i + 2) % COLORS.length], 0, 0.88, 0); scarf.rotation.x = Math.PI / 2; body.add(scarf);
  const legs = [];
  [-1, 1].forEach((s2) => {
    const l = new THREE.Group(); l.position.set(s2 * 0.1, 0.42, 0); body.add(l);
    l.add(mesh(new THREE.CapsuleGeometry(0.075, 0.2, 6, 10), "#4a3a5c", 0, -0.17, 0));
    l.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), "#3d2a22", 0, -0.34, 0.03));
    legs.push(l);
  });
  const head = new THREE.Group(); head.position.y = 1.2; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.3, 24, 18), sk));
  const hairCap = mesh(new THREE.SphereGeometry(0.315, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.03, -0.02); head.add(hairCap);
  if (style === "pigtail") [-1, 1].forEach((s2) => head.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), hair, s2 * 0.3, -0.02, -0.04)));
  if (style === "bun") head.add(mesh(new THREE.SphereGeometry(0.13, 12, 10), hair, 0, 0.34, -0.06));
  if (style === "curly") for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; head.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), hair, Math.cos(a) * 0.27, 0.12, Math.sin(a) * 0.2 - 0.06)); }
  [-1, 1].forEach((s2) => {
    head.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), "#2b1d1a", s2 * 0.11, 0.0, 0.27));
    head.add(mesh(new THREE.SphereGeometry(0.013, 6, 5), "#ffffff", s2 * 0.11 + 0.012, 0.015, 0.305));
    const ch = mesh(new THREE.SphereGeometry(0.05, 8, 6), "#f4a58a", s2 * 0.18, -0.08, 0.23); ch.scale.set(1, 0.7, 0.5); head.add(ch);
  });
  head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.Color(sk).multiplyScalar(0.92), 0, -0.04, 0.3));
  const mouth = mesh(new THREE.SphereGeometry(0.07, 12, 10), "#6b2f2f", 0, -0.14, 0.27); mouth.scale.set(1, 0.3, 0.5); head.add(mouth);

  // 팔: 어깨 축(pivot)에서 아래로 늘어진다. rotation.z는 옆으로, rotation.x(음수)는 앞으로 든다.
  const arms = [-1, 1].map((s2) => {
    const pv = new THREE.Group(); pv.position.set(s2 * 0.27, 0.8, 0); body.add(pv);
    pv.add(mesh(new THREE.CapsuleGeometry(0.06, 0.22, 6, 10), cloth, 0, -0.16, 0));
    const hand = mesh(new THREE.SphereGeometry(0.075, 10, 8), sk, 0, -0.34, 0); pv.add(hand);
    pv.userData.hand = hand;
    return pv;
  });
  const [armL, armR] = arms;

  // 도구
  let prop = null;
  if (job === "tambourine") {
    prop = new THREE.Group(); prop.position.set(0.02, -0.4, 0.06);
    const ring = mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 22), "#c98a4b"); prop.add(ring);
    const skinD = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 20), "#faf3e6"); skinD.rotation.x = Math.PI / 2; prop.add(skinD);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; prop.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10), "#ffd166", Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.03).rotateX(Math.PI / 2)); }
    armR.add(prop);
  }
  if (job === "maracas") arms.forEach((pv) => {
    const m = new THREE.Group(); m.position.set(0, -0.44, 0.02);
    m.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), COLORS[(i + 3) % COLORS.length], 0, -0.04, 0), mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), "#c98a4b", 0, 0.08, 0));
    pv.add(m);
  });
  if (job === "wave") {                                              // 왼손에 작은 꽃다발
    const fl = new THREE.Group(); fl.position.set(0, -0.42, 0.04);
    fl.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 6), "#5f9a45", 0, 0.05, 0));
    [[0, 0.17], [0.06, 0.13], [-0.06, 0.13]].forEach(([dx, y], k) => fl.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), COLORS[(i + k) % COLORS.length], dx, y, 0)));
    armL.add(fl);
  }

  // 차림(파티 설정): 모자 / 머리 꽃 / 반짝이 별
  if (outfit === "hat") {
    const hat = mesh(new THREE.ConeGeometry(0.14, 0.3, 14), COLORS[(i + 4) % COLORS.length], 0.1, 0.42, 0); hat.rotation.z = -0.25; head.add(hat);
    head.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), "#ffd166", 0.17, 0.58, 0));
  } else if (outfit === "bouquet") {
    [[0, 0], [0.07, 0.05], [-0.07, 0.04]].forEach(([dx, dy], k) => head.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), COLORS[(i + k + 1) % COLORS.length], 0.2 + dx, 0.22 + dy, 0.12)));
  } else {
    const star = mesh(new THREE.OctahedronGeometry(0.1), "#ffd166", 0, 0.5, 0, { emissive: "#ffd166", emissiveIntensity: 0.6 }); head.add(star); g.userData.star = star;
  }
  Object.assign(g.userData, { body, head, mouth, armL, armR, legs, prop, job });
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

// 사람마다 다른 동작. 모두 사인 곡선이라 끊김 없이 부드럽고, 분위기(speed·sway·bounce)에 따라 빠르기와 크기가 달라진다.
function animateVillager(v, t, ph, mood, amp) {
  const u = v.userData, k = t * mood.speed * 2 + ph, sw = mood.sway, bn = mood.bounce;
  const { body, head, armL, armR, legs } = u;
  let by = 0, rz = Math.sin(k * 0.5) * 0.05 * sw, ry = 0;
  const set = (arm, x, z) => { arm.rotation.x = x; arm.rotation.z = z; };
  set(armL, 0, -0.12); set(armR, 0, 0.12);
  legs.forEach((l) => { l.rotation.x = 0; });
  by = sm(k * 2) * 0.03 * (0.4 + bn * 0.6);                         // 모두 박자에 맞춰 살짝 들썩
  if (u.job === "tambourine") {                                      // 오른손으로 탬버린을 흔들고 왼팔은 박자 맞춰 흔든다
    set(armR, -1.15 + Math.sin(k * 2) * 0.22, 0.35); u.prop.rotation.set(Math.sin(k * 4) * 0.35, 0, Math.sin(k * 4 + 1) * 0.3);
    set(armL, Math.sin(k) * 0.25, -0.3 - sm(k) * 0.2); rz += Math.sin(k) * 0.07 * sw; ry = Math.sin(k * 0.5) * 0.2;
  } else if (u.job === "dance") {                                    // 두 팔을 번갈아 들며 몸을 돌려 춤춘다
    set(armR, 0, 2.0 + Math.sin(k * 2) * 0.45); set(armL, 0, -2.0 + Math.sin(k * 2 + Math.PI) * 0.45);
    ry = Math.sin(k) * 0.7 * (0.5 + sw * 0.5); rz = Math.sin(k * 2) * 0.16 * sw; by += sm(k * 2) * 0.07 * bn;
    legs[0].rotation.x = Math.sin(k * 2) * 0.35; legs[1].rotation.x = -Math.sin(k * 2) * 0.35;
  } else if (u.job === "clap") {                                     // 앞에서 손뼉을 마주친다
    const c = sm(k * 4);
    set(armR, -1.25, 0.1 + c * 0.55); set(armL, -1.25, -0.1 - c * 0.55); by += sm(k * 2) * 0.03 * bn; ry = Math.sin(k * 0.5) * 0.15;
  } else if (u.job === "wave") {                                     // 오른손을 높이 들어 흔든다
    set(armR, 0, 2.55 + Math.sin(k * 3) * 0.3); set(armL, 0.2, -0.25); rz = Math.sin(k) * 0.1 * sw;
  } else if (u.job === "maracas") {                                  // 마라카스를 앞에서 번갈아 흔들며 어깨를 들썩
    set(armR, -0.9 + Math.sin(k * 4) * 0.35, 0.3); set(armL, -0.9 + Math.sin(k * 4 + Math.PI) * 0.35, -0.3); rz = Math.sin(k * 2) * 0.12 * sw; ry = Math.sin(k) * 0.25;
  } else if (u.job === "jump") {                                     // 폴짝폴짝 뛰며 팔을 쭉 올린다
    const j = sm(k * 2); by += j * 0.22 * (0.4 + bn * 0.6); const up = 2.1 + j * 0.5;
    set(armR, 0, up); set(armL, 0, -up); legs.forEach((l, n) => { l.rotation.x = -j * 0.4 * (n ? 1 : -1) * 0.3 - j * 0.15; }); ry = Math.sin(k) * 0.3;
  }
  body.position.y = by + amp * 0.03; body.rotation.z = rz; body.rotation.y = ry;
  head.rotation.z = Math.sin(k) * 0.08 * sw; head.rotation.x = Math.sin(k * 2) * 0.04;
  if (u.star) u.star.rotation.y = t * 2;
}

function bannerTexture(text) {
  const c = document.createElement("canvas"); c.width = 1024, c.height = 288;
  const k = c.getContext("2d");
  const g = k.createLinearGradient(0, 0, 0, 288); g.addColorStop(0, "#f26a4b"); g.addColorStop(1, "#d9452c");
  k.fillStyle = g; k.fillRect(0, 0, 1024, 288);
  k.strokeStyle = "rgba(255,255,255,.07)"; k.lineWidth = 2;                                   // 천의 결
  for (let y = 6; y < 288; y += 8) { k.beginPath(); k.moveTo(0, y); k.lineTo(1024, y); k.stroke(); }
  k.fillStyle = "#ffd166"; k.fillRect(0, 0, 1024, 20); k.fillRect(0, 268, 1024, 20);          // 위아래 금빛 띠
  k.fillStyle = "#fff6e0"; k.beginPath(); k.roundRect(40, 40, 944, 208, 30); k.fill();                    // 글씨가 또렷하도록 크림색 판
  k.strokeStyle = "#d9452c"; k.lineWidth = 6; k.setLineDash([18, 14]); k.beginPath(); k.roundRect(54, 54, 916, 180, 22); k.stroke(); k.setLineDash([]);
  k.textAlign = "center"; k.textBaseline = "middle";
  let size = 150; k.font = `800 ${size}px "Jua","Noto Sans KR",sans-serif`;
  while (k.measureText(text).width > 840 && size > 48) { size -= 6; k.font = `800 ${size}px "Jua","Noto Sans KR",sans-serif`; }
  k.fillStyle = "#b8341f"; k.fillText(text, 512, 152);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function PartyScene({ party = DEFAULT_PARTY, voiceUrl = null, from = "", preview = false, intro = false, onDone, onClose }) {
  const wrap = useRef(null);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const [ended, setEnded] = useState(false);
  const [round, setRound] = useState(0);          // 다시 보기(미리보기)마다 증가
  const [fail, setFail] = useState(false);
  const [landed, setLanded] = useState(!intro);    // 해무가 내려앉았는가(intro가 아니면 처음부터 true)
  const P = { ...DEFAULT_PARTY, ...party };

  useEffect(() => {
    const el = wrap.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFail(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(renderer.domElement); renderer.domElement.className = "w3d-canvas";

    const stage = P.stage || "island";
    const sk = STAGE_SKY[stage] || SKY[P.sky] || SKY.day, mood = MOODS.find((m) => m.id === P.mood) || MOODS[1];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sk.bg); scene.fog = new THREE.Fog(sk.bg, sk.near ?? 14, sk.fog + (sk.near ? 0 : 20));
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    scene.add(new THREE.HemisphereLight(sk.hemi[0], sk.hemi[1], sk.hemi[2]));
    const sun = new THREE.DirectionalLight(sk.sun[0], sk.sun[1]); sun.position.set(-5, 10, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 }); sun.shadow.bias = -0.0005;
    scene.add(sun);

    const anim = [];
    let vill = [], pm = null, pmMouth = null, wtex = null, stageApi = null, hm = null, hmMouth = null;
    if (stage !== "island") { stageApi = buildStage(stage, { scene, world: scene, P, anim }); if (intro) { hm = stageApi.haemu.pm; hmMouth = stageApi.haemu.mouth; } }
    if (stage === "island") {
    // 바다와 항구 섬, 선착장
    wtex = waterTexture();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, transparent: true, opacity: 0.9, color: P.sky === "night" ? "#5c6fa8" : P.sky === "dusk" ? "#ffd2c8" : "#ffffff" }));
    sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; scene.add(sea);
    const world = new THREE.Group(); scene.add(world);
    world.add(puck(4.6, 1.4, 0.6, "#b9a58a", 0, -1.1, 0), puck(4.4, 0.5, 0.25, "#f2e2bd", 0, -0.15, 0), puck(3.7, 0.4, 0.2, "#a5d65a", 0, 0.3, 0));
    const deckY = 0.4;
    for (let k = 0; k < 6; k++) world.add(box(2.0, 0.1, 0.5, 0.03, k % 2 ? "#c98a4b" : "#b97a3e", 0, 0.02, 3.4 + k * 0.52));     // 선착장
    [-1, 1].forEach((s) => { world.add(box(0.16, 0.6, 0.16, 0.05, "#8a5a2b", s * 1.1, 0.02, 3.6)); });
    world.add(box(0.7, 0.55, 0.6, 0.1, "#faf3e6", -3.0, deckY, -0.6), box(0.9, 0.25, 0.8, 0.1, "#5ec9a7", -3.0, deckY + 0.55, -0.6));
    world.add(box(0.7, 0.55, 0.6, 0.1, "#f6e3c4", 3.1, deckY, -0.9), box(0.9, 0.25, 0.8, 0.1, "#e8553a", 3.1, deckY + 0.55, -0.9));
    world.add(palm(-2.2, 1.2, deckY, 1.5), palm(2.6, 1.0, deckY, 1.4), bush(-1.6, 2.4, deckY, 1.1), bush(1.9, 2.6, deckY, 1.0));

    // 현수막: 무슨 날인지는 쓴 사람이 직접 적은 문구


    // 마을 친구들: 7명이 반원으로 모여 노래한다
    vill = Array.from({ length: 6 }, (_, i) => {
      const v = makeVillager(i, P.outfit), a = (-0.5 + i / 5) * 2.2;
      v.scale.setScalar(0.78); v.position.set(Math.sin(a) * 2.3, deckY, 1.5 + (1 - Math.cos(a)) * 0.6 + (i % 2) * 0.5); v.rotation.y = -a * 0.35;
      world.add(v); return { v, ph: i * 0.9 };
    });

    // 우체부: 친구들 앞에 떠서(나는 모습 그대로) 함께 노래한다
    pm = makePostman(); pm.scale.setScalar(0.62); pm.children[0].rotation.z = -0.08; pm.rotation.y = -Math.PI / 2 + 0.2; pm.position.set(0, 0.95, 3.3);
    pmMouth = mesh(new THREE.SphereGeometry(0.07, 12, 10), "#6b2f2f", 0.31, -0.14, 0); pmMouth.scale.set(0.45, 0.3, 1); pm.userData.head.add(pmMouth);
    pm.traverse((o) => { o.castShadow = true; }); world.add(pm);

    if (intro) {                                                 // 섬 위 무대의 해무: 항구 한쪽에 내려앉는다
      hm = makePostman({ elder: true }); hm.scale.setScalar(0.62); hm.children[0].rotation.z = -0.08; hm.rotation.y = -Math.PI / 2 - 0.15; hm.position.set(-1.7, 0.95, 3.4);
      hmMouth = mesh(new THREE.SphereGeometry(0.07, 12, 10), "#6b2f2f", 0.31, -0.14, 0); hmMouth.scale.set(0.45, 0.3, 1); hm.userData.head.add(hmMouth);
      hm.traverse((o) => { o.castShadow = true; }); world.add(hm);
    }
    // 장식

    addBanner(world, anim, P.banner.trim() || "축하해요");
    const deco = P.deco;
    if (deco === "balloon") {
      for (let i = 0; i < 12; i++) {
        const b = mesh(new THREE.SphereGeometry(0.3, 16, 12), COLORS[i % COLORS.length], 0, 0, 0); b.scale.y = 1.2;
        const bx = (i % 2 ? 1 : -1) * (2.3 + (i % 5) * 0.35), bz = 3.4 + (i % 3) * 0.3, by = 3.3 + (i % 4) * 0.35;
        b.position.set(bx, by, bz); world.add(b);
        const line = mesh(new THREE.CylinderGeometry(0.008, 0.008, by - 1.2, 4), "#ffffff", bx, (by + 1.2) / 2, bz); world.add(line);
        anim.push((t) => { b.position.y = by + Math.sin(t * 1.2 + i) * 0.12; });
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = 3.0 + (i % 3) * 0.2;
        world.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), "#5f9a45", Math.cos(a) * r, deckY + 0.11, Math.sin(a) * r * 0.8 - 0.5), mesh(new THREE.SphereGeometry(0.09, 8, 6), COLORS[i % COLORS.length], Math.cos(a) * r, deckY + 0.26, Math.sin(a) * r * 0.8 - 0.5));
      }
    } else if (deco === "lantern") {
      const warm = new THREE.PointLight("#ffb347", P.sky === "day" ? 0.4 : 2.2, 12); warm.position.set(0, 2.6, 3); world.add(warm);
      for (let i = 0; i < 9; i++) {
        const x = i < 5 ? -4.6 + i * 0.55 : 2.4 + (i - 5) * 0.55, y = 2.9 - Math.sin(((i % 5) / 4) * Math.PI) * 0.4;
        const l = mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), "#ffb347", x, y, -0.9, { emissive: "#ff9a2e", emissiveIntensity: 0.9 }); world.add(l);
        world.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), "#ffffff", x, y + 0.35, -0.9));
        anim.push((t) => { l.position.y = y + Math.sin(t * 1.5 + i) * 0.04; });
      }
    } else if (deco === "fireworks") {
      const bursts = Array.from({ length: 4 }, (_, n) => {
        const N = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), dirs = [];
        for (let k = 0; k < N; k++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); dirs.push([Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)]); }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: COLORS[n * 2 % COLORS.length], size: 0.2, transparent: true, depthWrite: false })); world.add(pts);
        return { pts, dirs, o: [(-3 + n * 2) * 1.2, 5 + (n % 2) * 1.3, -1 - (n % 3)], n };
      });
      anim.push((t) => bursts.forEach(({ pts, dirs, o, n }) => {
        const u = ((t + n * 0.9) % 3.6) / 3.6, r = u * 3.2, p = pts.geometry.attributes.position;
        dirs.forEach((d, k) => p.setXYZ(k, o[0] + d[0] * r, o[1] + d[1] * r - u * u * 1.2, o[2] + d[2] * r));
        p.needsUpdate = true; pts.material.opacity = u < 0.08 ? u * 12 : 1 - u;
      }));
    } else if (deco === "snow") {
      const N = 260, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3);
      for (let k = 0; k < N; k++) pos.set([(Math.random() - 0.5) * 16, Math.random() * 9, -3 + Math.random() * 12], k * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#ffffff", size: 0.12, transparent: true, opacity: 0.9, depthWrite: false })); world.add(snow);
      anim.push((t, dt) => { const p = snow.geometry.attributes.position; for (let k = 0; k < N; k++) { let y = p.getY(k) - dt * 0.7; if (y < 0) y = 9; p.setY(k, y); p.setX(k, p.getX(k) + Math.sin(t + k) * dt * 0.1); } p.needsUpdate = true; });
    }
    if (P.sky === "night") {                                     // 별과 달
      const N = 160, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3);
      for (let k = 0; k < N; k++) { const th = Math.random() * Math.PI * 2, y = 8 + Math.random() * 28; pos.set([Math.cos(th) * 55, y, -30 - Math.random() * 20], k * 3); }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      world.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: "#fff6c9", size: 0.5, transparent: true, opacity: 0.9, depthWrite: false, fog: false })));
      world.add(mesh(new THREE.SphereGeometry(2, 20, 16), "#fff3c9", 14, 16, -45, { emissive: "#fff3c9", emissiveIntensity: 0.9 }));
    }
    }   // end: 섬 위 무대

    const resize = () => { const w = el.clientWidth, h = el.clientHeight || 1; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(el);

    // 해무가 날아오는 길: 멀리 위쪽에서 시작해 무대 옆(원래 서 있는 자리)에 내려앉는다. 편지를 안고 온다.
    let hmEnd = null, hmPath = null, parcel = null;
    if (intro && hm) {
      hmEnd = hm.position.clone();
      hmPath = new THREE.CatmullRomCurve3([new THREE.Vector3(-13, 9, -16), new THREE.Vector3(-6, 6.5, -4), new THREE.Vector3(hmEnd.x - 2.2, hmEnd.y + 1.6, hmEnd.z - 1.5), hmEnd]);
      parcel = makeEnvelope(); parcel.scale.setScalar(1.6); parcel.position.set(0.55, -0.15, 0.45); parcel.rotation.z = 0.3; hm.add(parcel);
    }
    // 노래: 녹음이 있으면 그 목소리를, 없으면 기본 노래를. 끝나면 잠깐 뒤 편지로 넘어간다. 도착 영상에서는 해무가 내려앉은 뒤에 시작한다.
    let player = { level: () => 0, stop() {} };
    const startSong = () => { player = createPlayer(voiceUrl, () => { setEnded(true); if (!preview) setTimeout(() => doneRef.current?.(), 1300); }); };
    let songTimer = null, landTimer = null;
    if (intro) { songTimer = setTimeout(startSong, ARRIVE * 1000); landTimer = setTimeout(() => setLanded(true), ARRIVE * 1000); } else startSong();
    const hist = []; let raf; const clock = new THREE.Clock();
    const frame = () => {
      const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
      const amp = player.level(); hist.unshift(amp); if (hist.length > 24) hist.pop();
      stageApi?.update(t, dt, amp, mood);
      if (hm && hmPath) {                                          // 해무: 날아와 내려앉기(노래가 시작되면 입을 움직인다)
        const u = sm01(t / ARRIVE);
        if (u < 1) {
          const p = hmPath.getPoint(u), tg = hmPath.getTangent(Math.min(u, 0.98)), face = -Math.PI / 2 - 0.15, flying = Math.atan2(-tg.z, tg.x);
          hm.position.copy(p); hm.rotation.set(0, flying + (face - flying) * sm01((u - 0.8) / 0.2), 0);
          animatePostman(hm, t, 0.95);
        } else {
          if (parcel) parcel.visible = false;                      // 편지는 해무 품으로
          if (!stageApi) { animatePostman(hm, t, 0.35 + amp * 0.5); hm.position.y = hmEnd.y + Math.sin(t * mood.speed * 2 + 1) * 0.08; }
          hmMouth.scale.set(0.45, 0.25 + Math.min(1, amp * 1.3) * 1.5, 1);
        }
      }
      vill.forEach(({ v, ph }, i) => {
        animateVillager(v, t, ph, mood, amp);
        const a = hist[Math.min(hist.length - 1, i * 2)] ?? 0;                         // 친구마다 살짝 늦게: 입 모양이 한꺼번에 똑같지 않게
        v.userData.mouth.scale.set(1 - a * 0.25, 0.25 + Math.min(1, a * 1.3) * 1.5, 0.5);
      });
      if (pm) {
        animatePostman(pm, t, 0.35 + amp * 0.5);
        pm.position.y = 0.95 + Math.sin(t * mood.speed * 2) * 0.08 + amp * 0.06; pm.rotation.z = Math.sin(t * mood.speed) * 0.05;
        pmMouth.scale.set(0.45, 0.25 + Math.min(1, amp * 1.3) * 1.5, 1);
      }
      anim.forEach((f) => f(t, dt));
      wtex?.offset.set(t * 0.02, t * 0.012);
      cam.position.set(Math.sin(t * 0.18) * 1.2, 2.7 + Math.sin(t * 0.13) * 0.15, 8.8); cam.lookAt(0, 1.3, 1.4);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); player.stop(); clearTimeout(songTimer); clearTimeout(landTimer);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); wtex?.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [round]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (fail) doneRef.current?.(); }, [fail]);

  return (
    <div className="intro party" ref={wrap}>
      <div className="letterbox top" /><div className="letterbox bottom" />
      <button className="pill intro-skip" onClick={preview ? onClose : () => doneRef.current?.()} aria-label={preview ? "닫기" : "건너뛰기"}>
        {preview ? <Icon name="close" size={16} /> : "건너뛰기"}
      </button>
      <p className="intro-cap tag fade party-cap" key={landed ? "song" : "arrive"}>{!landed ? `해무가 ${from || "누군가"}의 편지를 배달하러 왔어요` : voiceUrl ? `${josa(from || "누군가", "이", "가")} 부른 노래` : ({ sea: "잠수한 해무와 바다 친구들이 부르는 노래", sky: "구름 위 친구들이 부르는 노래" }[P.stage] || "마을 친구들과 우체부가 부르는 노래")}</p>
      {preview && ended && <button className="btn intro-start fade" onClick={() => { setEnded(false); setRound((r) => r + 1); }}><Icon name="play" size={18} /> 다시 보기</button>}
    </div>
  );
}
