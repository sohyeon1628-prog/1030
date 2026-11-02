import * as THREE from "three";

// 비행 장애물의 3D 스프라이트: 새·비행기·상어·고래·먹구름·회오리를 Three.js로 한 번씩 그려 2D 캔버스에 붙여 쓴다.
// 모두 오른쪽(+x)을 보고, 비스듬히 위에서 내려다본 장난감 느낌이다. 단위는 게임 화면의 픽셀이다.
// WebGL을 쓸 수 없으면 getSprite가 null을 돌려주고, render.js가 기존 2D 그림으로 대신한다.
let R, scene, cam, pose;
const cache = new Map();
const SCALE = 2;                                            // 화면보다 두 배로 그려 선명하게

function setup() {
  if (R !== undefined) return R;
  try {
    R = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    R.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb7cc, 1.05));
    const sun = new THREE.DirectionalLight(0xfff3dc, 2.1); sun.position.set(-60, 120, 160); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfdcff, 0.6); fill.position.set(80, -40, 60); scene.add(fill);
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -600, 600); cam.position.set(0, 0, 300);
    pose = new THREE.Group(); pose.rotation.set(0.32, -0.5, 0); scene.add(pose);   // 위에서, 코가 살짝 앞으로 오게
  } catch { R = null; }
  return R;
}

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0, ...o });
function S(r, c, sx, sy, sz, x = 0, y = 0, z = 0, o) {      // 타원체
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), M(c, o)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m;
}
function Cone(r, h, c, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18), M(c)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); return m;
}
function twoTone(r, top, bottom, sx, sy, sz, split = 0.05) {   // 등은 짙고 배는 밝은 몸통
  const geo = new THREE.SphereGeometry(r, 28, 20), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(top), b = new THREE.Color(bottom), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const k = THREE.MathUtils.smoothstep(pos.getY(i) / r, -split - 0.2, -split + 0.2); c.copy(b).lerp(a, k); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, M("#ffffff", { vertexColors: true })); m.scale.set(sx, sy, sz); return m;
}

// ── 모델 ──
function bird(tone, phase) {
  const c = tone === "dark" ? ["#4a4657", "#2e2b38", "#5a5668"] : ["#7b93ab", "#56708a", "#97aec4"];
  const g = new THREE.Group();
  g.add(S(11, c[0], 1.2, 0.78, 0.82));                                           // 몸통
  g.add(S(6.2, c[0], 1, 1, 1, 11, 3, 0));                                        // 머리
  g.add(Cone(2.6, 8, "#f4a63a", 19, 2, 0, 0, 0, -Math.PI / 2));                   // 부리
  g.add(Cone(4.5, 11, c[1], -17, 0, 0, 0, 0, Math.PI / 2, 1, 1, 2.2));           // 꼬리
  for (const z of [-1, 1]) g.add(S(1.5, "#1f2d3a", 1, 1, 1, 13.5, 4.6, z * 4.6));  // 눈
  for (const s of [-1, 1]) {                                                    // 날개: 앞뒤 축을 따라 위아래로 퍼덕인다
    const w = new THREE.Group(); w.position.set(-1, 2, s * 4);
    const wing = S(11, s < 0 ? c[1] : c[2], 1.0, 0.16, 0.7, -2, 0, s * 9); w.add(wing);
    w.rotation.x = -s * (Math.sin(phase) * 0.85 + 0.15);
    g.add(w);
  }
  return g;
}
function plane(phase) {
  const g = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(6.5, 42, 10, 20), M("#ffffff")); fus.rotation.z = Math.PI / 2; g.add(fus);
  g.add(S(6.8, "#e8553a", 0.9, 1, 1, 26, 0, 0));                                  // 빨간 코
  const band = new THREE.Mesh(new THREE.CylinderGeometry(6.7, 6.7, 3, 20), M("#e8553a")); band.rotation.z = Math.PI / 2; band.position.x = 6; g.add(band);
  g.add(S(1, "#b9c7d4", 14, 1.1, 27, -3, -2.5, 0));                               // 날개
  g.add(S(1, "#b9c7d4", 6, 0.9, 11, -27, 1.5, 0));                                // 꼬리날개
  g.add(S(1, "#e8553a", 4.8, 9, 0.9, -27, 8.5, 0));                               // 꼬리 지느러미
  for (let i = 0; i < 4; i++) for (const z of [-1, 1]) g.add(S(2.1, "#7ea6d4", 0.9, 1, 0.6, -14 + i * 9, 2.5, z * 6.2));   // 창문
  const prop = new THREE.Group(); prop.position.set(32.5, 0, 0); prop.rotation.x = phase;
  prop.add(S(1, "#40362e", 1, 10, 1.6)); prop.add(S(1.8, "#40362e", 1, 1, 1));
  g.add(prop);
  return g;
}
function jumper(kind, wag) {
  const whale = kind === "whale", g = new THREE.Group();
  if (whale) {
    g.add(twoTone(22, "#4f7fb6", "#dbe8f4", 2.75, 1, 0.92, 0.1));
    g.add(S(3.5, "#10202c", 1, 1, 1, 40, 3, 14));  g.add(S(3.5, "#10202c", 1, 1, 1, 40, 3, -14));
    for (const z of [-1, 1]) g.add(S(8, "#3d6aa0", 1.7, 0.35, 0.8, 14, -12, z * 20));   // 가슴지느러미
    const tail = new THREE.Group(); tail.position.set(-52, 4, 0); tail.rotation.z = wag * 0.9;
    tail.add(S(9, "#4f7fb6", 2.4, 0.8, 0.8, -8, 0, 0));
    for (const z of [-1, 1]) tail.add(S(10, "#3d6aa0", 0.7, 0.25, 1.4, -26, 6, z * 12));  // 꼬리지느러미
    g.add(tail);
  } else {
    g.add(twoTone(17, "#7b93a9", "#f1f4f8", 2.8, 1, 0.86, 0.05));
    g.add(Cone(6.5, 18, "#62788f", -3, 21, 0, 0, 0, 0.45, 1, 1, 0.38));            // 등지느러미
    g.add(S(2.8, "#10202c", 1, 1, 1, 32, 5, 12));  g.add(S(2.8, "#10202c", 1, 1, 1, 32, 5, -12));
    for (const z of [-1, 1]) {
      g.add(Cone(5, 17, "#62788f", 6, -13, z * 15, z * 0.9, 0, 0.5, 1, 1, 0.4));     // 가슴지느러미
      for (let i = 0; i < 4; i++) g.add(Cone(1.2, 3.6, "#ffffff", 30 + i * 3.8 - (i > 1 ? 1 : 0), -8, z * 10.5, Math.PI, 0, 0));   // 이빨
    }
    const tail = new THREE.Group(); tail.position.set(-40, 0, 0); tail.rotation.z = wag * 0.9;
    tail.add(Cone(6, 22, "#62788f", -8, 9, 0, 0, 0, 0.9, 1, 1, 0.35));
    tail.add(Cone(5, 14, "#62788f", -8, -8, 0, 0, 0, Math.PI - 0.7, 1, 1, 0.35));
    tail.add(S(6, "#7b93a9", 2, 0.9, 0.7, -3, 0, 0));
    g.add(tail);
  }
  return g;
}
function storm() {
  const g = new THREE.Group();
  const lump = (x, y, z, r) => { const m = twoTone(r, "#8d9bad", "#4a566a", 1, 0.9, 0.95, 0.1); m.position.set(x, y, z); g.add(m); };
  [[-26, -5, 0, 17], [-9, 8, 4, 22], [13, 7, -2, 21], [30, -4, 0, 16], [2, -7, 6, 20]].forEach((a) => lump(...a));
  g.add(S(6, "#c8d2de", 1.6, 0.5, 0.6, -10, 22, 14, { transparent: true, opacity: 0.55 }));   // 윗면 하이라이트
  return g;
}
function tornado(phase) {
  // 안개처럼 비치는 회오리: 겹겹의 반투명 고리가 겹칠수록 짙어지고, 바깥에는 더 옅은 안개막이 둘러싼다
  const g = new THREE.Group(), r = 55;
  const mist = (c, op) => ({ transparent: true, opacity: op, depthWrite: false, roughness: 1, emissive: c, emissiveIntensity: 0.25 });
  for (let i = 0; i < 14; i++) {
    const u = i / 13, y = r * 1.9 - r * 2.9 * u, w = r * (1.15 - 0.9 * u), sh = Math.sin(phase * 2 + i * 0.7) * r * 0.13 * (1 - u * 0.3);
    const c = new THREE.Color().setRGB(0.55 + u * 0.1, 0.6 + u * 0.1, 0.68 + u * 0.08);
    const ring = S(1, c, w, r * 0.2, w * 0.85, sh, y, 0, mist(c, 0.34)); ring.rotation.y = phase + i; g.add(ring);
    const haze = S(1, "#dbe6f0", w * 1.3, r * 0.26, w * 1.1, sh, y, 0, mist("#dbe6f0", 0.14)); g.add(haze);   // 바깥 안개막
  }
  g.add(S(1, "#eef4fa", r * 0.22, r * 1.45, r * 0.2, 0, r * 0.45, 0, mist("#eef4fa", 0.2)));                      // 가운데 밝은 기둥
  for (let k = 0; k < 10; k++) { const a = phase * 2.5 + k * 0.9; g.add(S(2.2, "#8a6a4a", 1, 1, 1, Math.cos(a) * r * (0.5 + 0.3 * Math.sin(k)), (k - 5) * r * 0.28, Math.sin(a) * r * 0.4, { transparent: true, opacity: 0.7 })); }
  return g;
}

// 귀여운 해적(구름 길을 뛰어오는 장애물): 큰 머리, 삼각 모자와 해골 표시, 눈가리개, 줄무늬 옷, 한쪽 팔 끝에 갈고리. 오른쪽(+x)을 보고 달린다. 발은 y=-46 근처.
function pirate(phase) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.position.y = Math.abs(Math.sin(phase)) * 4;                                  // 달리며 통통 뛴다
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 28, 24), M("#fff6e6")); torso.position.y = -2; torso.scale.z = 0.95; body.add(torso);
  for (const y of [-10, -2, 6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 15.8, 4.5, 24), M("#4a7cc9")); b.position.y = y; b.scale.z = 0.95; body.add(b); }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(15.8, 15.8, 4, 24), M("#6b4a2e")); belt.position.y = -14; belt.scale.z = 0.95; body.add(belt);
  body.add(S(17, "#f2c9a0", 1, 1, 1, 2, 27, 0));                                    // 머리
  const hat = new THREE.Mesh(new THREE.ConeGeometry(16, 13, 22), M("#222a3a")); hat.position.set(2, 46, 0); body.add(hat);
  body.add(S(21, "#222a3a", 1, 0.2, 1, 2, 40, 0));                                  // 모자 챙
  body.add(S(3.4, "#ffffff", 1, 1.2, 0.5, 15, 44, 0));                              // 해골 표시
  for (const z of [-1, 1]) body.add(S(2.6, "#222a3a", 0.9, 1.2, 0.9, 18.5, 28, z * 7));    // 눈(한쪽은 눈가리개가 덮는다)
  body.add(S(1.1, "#ffffff", 1, 1, 1, 20.2, 29.2, -6));
  body.add(S(6.5, "#222a3a", 0.5, 1, 1, 17.5, 28.5, 7));                            // 눈가리개
  const band = new THREE.Mesh(new THREE.TorusGeometry(17, 0.9, 8, 28), M("#222a3a")); band.position.set(2, 30, 0); band.rotation.x = Math.PI / 2 + 0.25; body.add(band);
  for (const z of [-1, 1]) body.add(S(3.6, "#f59ab0", 0.6, 1, 1, 15, 21, z * 10.5, { transparent: true, opacity: 0.75 }));   // 볼
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.9, 8, 14, Math.PI), M("#7a3b2e")); mouth.position.set(18.5, 20, 0); mouth.rotation.set(0, Math.PI / 2, Math.PI); body.add(mouth);
  const arm = (z, swing, hook) => {                                                  // 팔: 한쪽은 손 대신 갈고리, 앞으로 치켜든다
    const a = new THREE.Group(); a.position.set(2, 8, z * 16);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(3.6, 15, 6, 12), M("#fff6e6")); limb.position.y = -9; a.add(limb);
    if (hook) {
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 4, 14), M("#6b4a2e")); cuff.position.y = -19; a.add(cuff);          // 팔 끝 가죽띠
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 9, 10), M("#cfd8e2", { metalness: 0.6, roughness: 0.25 })); shaft.position.y = -25; a.add(shaft);
      const curve = new THREE.Mesh(new THREE.TorusGeometry(6.2, 1.7, 10, 22, Math.PI * 1.25), M("#cfd8e2", { metalness: 0.6, roughness: 0.25 })); curve.position.set(-5, -31, 0); curve.rotation.z = -Math.PI * 0.62; a.add(curve);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(1.8, 6, 10), M("#cfd8e2", { metalness: 0.6, roughness: 0.25 })); tip.position.set(-10.2, -26, 0); tip.rotation.z = Math.PI * 0.1; a.add(tip);
    } else a.add(S(4.2, "#f2c9a0", 1, 1, 1, 0, -20, 0));
    if (hook) a.scale.setScalar(1.25); a.rotation.z = hook ? 1.2 + Math.sin(phase) * 0.15 : swing; a.rotation.x = z * 0.15;
    return a;
  };
  body.add(arm(1, 0, true));                                                         // 반대쪽 팔은 없다
  for (const side of [-1, 1]) {                                                     // 다리: 번갈아 앞뒤로
    const leg = new THREE.Group(); leg.position.set(0, -15 + body.position.y * 0, side * 7);
    const sw = Math.sin(phase + (side > 0 ? 0 : Math.PI));
    leg.rotation.z = sw * 0.95;
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(4.6, 12, 6, 12), M("#3d4a6b")); l.position.y = -11; leg.add(l);
    leg.add(S(6.6, "#3b2a22", 1.45, 0.8, 1, 4, -27, 0));
    g.add(leg);
  }
  return g;
}

function shoot(model, w, h, oy = 0, view = [0.32, -0.5], k = 1) {
  if (!setup()) return null;
  pose.rotation.set(view[0], view[1], 0); model.scale.setScalar(k);
  pose.add(model);
  cam.left = -w / 2; cam.right = w / 2; cam.top = h / 2 + oy; cam.bottom = -h / 2 + oy; cam.updateProjectionMatrix();
  R.setSize(w * SCALE, h * SCALE, false); R.render(scene, cam);
  const c = document.createElement("canvas"); c.width = w * SCALE; c.height = h * SCALE;
  c.getContext("2d").drawImage(R.domElement, 0, 0);
  pose.remove(model);
  model.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  return c;
}

const SPECS = {   // [가로, 세로, 프레임 수, 만드는 함수, 세로 기준 이동, 보는 각도(위·옆), 모델 크기 배율]
  bird: (tone) => [72, 56, 8, (i, n) => bird(tone, (i / n) * Math.PI * 2), 0, [0.62, -0.28], 1.45],
  plane: () => [112, 70, 4, (i, n) => plane((i / n) * Math.PI), 0, [0.42, -0.5], 1.2],
  shark: () => [150, 96, 8, (i, n) => jumper("shark", Math.sin((i / n) * Math.PI * 2))],
  whale: () => [200, 118, 8, (i, n) => jumper("whale", Math.sin((i / n) * Math.PI * 2))],
  storm: () => [124, 90, 1, () => storm(), 0, [0.22, -0.2], 1.4],
  pirate: () => [100, 116, 8, (i, n) => pirate((i / n) * Math.PI * 2), 0, [0.2, -0.45], 1],
  tornado: () => [150, 190, 8, (i, n) => tornado((i / n) * Math.PI * 2), r45, [0.18, 0]],
};
const r45 = 55 * 0.45;   // 회오리 상자의 가운데가 깔때기 위쪽에 오도록

// kind: bird:blue | bird:dark | plane | shark | whale | storm | tornado. frameT: 0~1(한 주기). 반환: { img, w, h } 또는 null
export function getSprite(kind, frameT = 0) {
  let e = cache.get(kind);
  if (e === undefined) {
    const [name, tone] = kind.split(":");
    const [w, h, n, make, oy = 0, view, k] = SPECS[name](tone);
    const frames = [];
    for (let i = 0; i < n; i++) { const c = shoot(make(i, n), w, h, oy, view, k); if (!c) { e = null; break; } frames.push(c); }
    e = e === null ? null : { frames, w, h };
    cache.set(kind, e);
  }
  if (!e) return null;
  const f = e.frames[Math.floor((((frameT % 1) + 1) % 1) * e.frames.length) % e.frames.length];
  return { img: f, w: e.w, h: e.h };
}

// 비행을 시작하기 전에 미리 그려 두어, 처음 장애물이 나올 때 끊기지 않게 한다
export function warmSprites() { ["bird:blue", "bird:dark", "plane", "shark", "whale", "storm", "tornado", "pirate"].forEach((k) => getSprite(k)); }
