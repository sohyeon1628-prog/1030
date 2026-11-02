import * as THREE from "three";
import { mesh, puck, makePostman, animatePostman, makeDolphin, makeFish, makeTurtle, makeGull, animateGull } from "../three/parts.js";

// 파티 무대 부품. 섬 위 항구(PartyScene 안), 바닷속, 하늘 위 세 무대가 현수막·음표를 함께 쓴다.
export const COLORS = ["#e8553a", "#5aa3d4", "#ffd166", "#5ec9a7", "#c78fe0", "#f59a4a", "#8fb4dc"];

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

// 현수막: 두 기둥 사이에 늘어진 두툼한 천. 바람(물살)에 살랑이고, 위에는 삼각 깃발 줄이 걸린다
export function addBanner(world, anim, text) {
  const BW = 4.2, BH = 1.05, by = 2.7, bz = -0.9;
  [-1, 1].forEach((sd) => {
    world.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.9, 12), "#8a5a2b", sd * 2.45, 1.85, bz), mesh(new THREE.SphereGeometry(0.13, 14, 10), "#ffd166", sd * 2.45, 3.85, bz, { metalness: 0.4, roughness: 0.35 }), puck(0.3, 0.18, 0.1, "#6d4521", sd * 2.45, 0.38, bz));
  });
  const geo = new THREE.PlaneGeometry(BW, BH, 28, 6), base = geo.attributes.position.array.slice();
  const btex = bannerTexture(text);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: btex, emissiveMap: btex, emissive: "#ffffff", emissiveIntensity: 0.5, side: THREE.DoubleSide, roughness: 0.85 }));
  cloth.castShadow = true; cloth.receiveShadow = true; world.add(cloth);
  const rope = (y0, sag, col) => {                                // 기둥 사이의 줄
    const pts = Array.from({ length: 21 }, (_, n) => { const u = n / 20 * 2 - 1; return new THREE.Vector3(u * 2.45, y0 - sag * (1 - u * u), bz + 0.05); });
    world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 })));
  };
  rope(3.6, 0.15, "#f2e2bd");
  const flags = Array.from({ length: 11 }, (_, n) => {              // 삼각 깃발
    const u = (n / 10) * 2 - 1, fx = u * 2.3, fy = 3.6 - 0.15 * (1 - u * u);
    const tri = new THREE.Shape(); tri.moveTo(-0.14, 0); tri.lineTo(0.14, 0); tri.lineTo(0, -0.3);
    const f = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: COLORS[n % COLORS.length], side: THREE.DoubleSide, roughness: 0.8 }));
    f.position.set(fx, fy - 0.02, bz + 0.07); f.castShadow = true; world.add(f); return { f, n };
  });
  [-1, 1].forEach((sd) => { const tas = mesh(new THREE.ConeGeometry(0.07, 0.24, 10), "#ffd166", sd * (BW / 2 - 0.05), by - BH / 2 - 0.12, bz + 0.05); tas.rotation.x = Math.PI; world.add(tas); });
  anim.push((t) => {                                               // 가운데는 처지고 바람에 물결친다
    const pos = geo.attributes.position;
    for (let n = 0; n < pos.count; n++) {
      const x = base[n * 3], y = base[n * 3 + 1], u = x / (BW / 2);
      pos.setXYZ(n, x, y + by - 0.22 * (1 - u * u), bz + Math.sin(x * 2.2 + t * 1.6) * 0.07 * (1 - u * u * 0.3) + (y / BH) * 0.05);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
    flags.forEach(({ f, n }) => { f.rotation.z = Math.sin(t * 2 + n) * 0.12; });
  });
}

// 노래하는 친구들 머리 위로 떠오르는 음표(♪). 입이 없는 바다·하늘 친구들이 노래하는 것을 보여 준다.
function makeNotes(world) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const k = c.getContext("2d"); k.font = "800 52px sans-serif"; k.textAlign = "center"; k.textBaseline = "middle";
  k.fillStyle = "#ffffff"; k.shadowColor = "rgba(255,200,80,.9)"; k.shadowBlur = 8; k.fillText("♪", 32, 34);
  const tex = new THREE.CanvasTexture(c);
  const pool = Array.from({ length: 14 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: COLORS[i % COLORS.length], transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.5); world.add(s); return { s, life: 0, vx: 0 };
  });
  let n = 0, cool = 0;
  return {
    emit(x, y, z) { const p = pool[n++ % pool.length]; p.life = 1; p.vx = (Math.random() - 0.5) * 0.5; p.s.position.set(x, y, z); },
    update(dt, amp, srcs) {
      cool -= dt;
      if (amp > 0.2 && cool <= 0 && srcs.length) { const q = srcs[Math.floor(Math.random() * srcs.length)]; this.emit(q.x, q.y + 0.9, q.z); cool = 0.28; }
      pool.forEach((p) => { if (p.life > 0) { p.life -= dt * 0.55; p.s.position.y += dt * 0.9; p.s.position.x += p.vx * dt; p.s.material.opacity = Math.max(0, Math.min(1, p.life * 1.6)); } else p.s.material.opacity = 0; });
    },
  };
}

// 노래하는 우체부: 입이 소리 크기에 맞춰 열리고 닫힌다. elder=true면 해무.
function singer(elder, pos, yaw, scale = 0.66) {
  const pm = makePostman({ elder }); pm.scale.setScalar(scale); pm.children[0].rotation.z = -0.08; pm.rotation.y = yaw; pm.position.copy(pos);
  const mouth = mesh(new THREE.SphereGeometry(0.07, 12, 10), "#6b2f2f", 0.31, -0.14, 0); mouth.scale.set(0.45, 0.3, 1); pm.userData.head.add(mouth);
  pm.traverse((o) => { o.castShadow = true; });
  return { pm, mouth, y0: pos.y };
}
// 잠수 마스크와 스노클
function addMask(pm) {
  const head = pm.userData.head;
  const ring = mesh(new THREE.TorusGeometry(0.19, 0.04, 8, 24), "#1e2a44", 0.33, 0.0, 0); ring.rotation.y = Math.PI / 2; head.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), new THREE.MeshStandardMaterial({ color: "#bfe9ff", transparent: true, opacity: 0.45, roughness: 0.1, side: THREE.DoubleSide }));
  glass.position.set(0.335, 0, 0); glass.rotation.y = Math.PI / 2; head.add(glass);
  const strap = mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 28), "#1e2a44", 0, 0.0, 0); strap.rotation.x = Math.PI / 2; head.add(strap);
  head.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), "#e8553a", -0.1, 0.4, 0.3));
}
const lipsync = (s, amp) => s.mouth.scale.set(0.45, 0.25 + Math.min(1, amp * 1.3) * 1.5, 1);

// ── 바닷속 파티: 잠수한 해무와 나, 돌고래·바다거북·물고기 떼가 모여 노래한다 ──
function buildSea({ scene, world, P, anim }) {
  const notes = makeNotes(world);
  // 바닥: 모래 언덕, 바위, 산호, 흔들리는 해초
  world.add(mesh(new THREE.CylinderGeometry(9.5, 11, 1.4, 44), "#e8d29a", 0, -1.7, 1.2));
  world.add(mesh(new THREE.CylinderGeometry(6.6, 8.2, 0.5, 40), "#f3e2b0", 0, -0.85, 1.4));
  [[-5.2, -0.5, -1.4, 1.3], [5.6, -0.4, -1.8, 1.5], [-3.6, -0.4, -4.4, 1.8], [4.2, -0.5, -4.6, 1.6]].forEach(([x, y, z, r]) => {
    const rock = mesh(new THREE.DodecahedronGeometry(r, 0), "#7d8aa0", x, y + r * 0.3, z); rock.scale.y = 0.7; world.add(rock);
  });
  const CORAL = ["#ff7a8a", "#ffb347", "#c78fe0", "#ff9ec4"];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, r = 5.4 + (i % 3) * 0.7, x = Math.cos(a) * r, z = -1.2 + Math.sin(a) * r * 0.55, col = CORAL[i % CORAL.length];
    if (z > 5) continue;                                                       // 카메라 앞은 비워 둔다
    const c = new THREE.Group(); c.position.set(x, -0.55, z);
    for (let k = 0; k < 3; k++) { const br = mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.8 + k * 0.25, 8), col, (k - 1) * 0.22, 0.4 + k * 0.1, 0); br.rotation.z = (k - 1) * 0.35; c.add(br, mesh(new THREE.SphereGeometry(0.11, 10, 8), col, (k - 1) * 0.22 - Math.sin((k - 1) * 0.35) * 0.4, 0.8 + k * 0.28, 0)); }
    world.add(c);
  }
  const weeds = Array.from({ length: 16 }, (_, i) => {
    const x = -6 + i * 0.8 + (i % 2) * 0.3, z = -2.6 - (i % 3) * 1.1, w = mesh(new THREE.CapsuleGeometry(0.07, 1.4 + (i % 4) * 0.3, 4, 8), i % 2 ? "#3fae6a" : "#2f9a5c", x, 0.1, z);
    w.geometry.translate(0, 0.7, 0); w.position.y = -0.7; world.add(w); return { w, ph: i * 0.7 };
  });
  // 햇살 기둥과 거품
  const rays = Array.from({ length: 6 }, (_, i) => {
    const ray = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 3) * 0.4, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#d6f2ff", transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ray.position.set(-7 + i * 2.8, 5.2, -3 - (i % 2) * 2); ray.rotation.z = 0.18; world.add(ray); return { ray, ph: i * 1.3 };
  });
  const NB = 130, bg = new THREE.BufferGeometry(), bp = new Float32Array(NB * 3);
  for (let k = 0; k < NB; k++) bp.set([(Math.random() - 0.5) * 16, Math.random() * 9 - 1, -5 + Math.random() * 10], k * 3);
  bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
  world.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: "#ffffff", size: 0.16, transparent: true, opacity: 0.7, depthWrite: false })));
  // 해파리 등불
  const jellies = Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.Group(), col = ["#ff9ec4", "#bfa8ff", "#8ff0ff", "#ffd166"][i];
    const bell = mesh(new THREE.SphereGeometry(0.34, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), col, 0, 0, 0, { emissive: col, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }); g.add(bell);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), col, Math.cos(a) * 0.18, -0.28, Math.sin(a) * 0.18, { emissive: col, emissiveIntensity: 0.6 })); }
    g.position.set([-4.2, 4.0, -3.8, 3.0][i], [3.4, 2.2, 3.2, 4.2][i], [-1.8, 0.2, -2.6, -1.4][i]); world.add(g); return { g, ph: i * 1.7, y0: g.position.y };
  });
  scene.add(new THREE.PointLight("#9fe6ff", 1.4, 16));
  addBanner(world, anim, P.banner.trim() || "축하해요");

  // 노래하는 이들: 잠수한 해무와 나
  const haemu = singer(true, new THREE.Vector3(-1.05, 1.15, 3.1), -Math.PI / 2 + 0.25), me = singer(false, new THREE.Vector3(1.1, 1.0, 3.2), -Math.PI / 2 - 0.15);
  [haemu, me].forEach((s) => { addMask(s.pm); world.add(s.pm); });
  // 바다 친구들
  const dolphins = [0, 1].map((k) => { const d = makeDolphin(); d.scale.setScalar(1.6); world.add(d); return { d, k }; });
  const turtles = [[-3.6, 0.5, 1.0, 0], [3.8, 0.4, 0.8, 2.4]].map(([x, y, z, ph]) => { const m = makeTurtle(); m.scale.setScalar(1.6); world.add(m); return { m, x, y, z, ph }; });
  const fish = Array.from({ length: 16 }, (_, k) => { const f = makeFish(k % 2 ? "#f59a4a" : "#ffd166", k % 2 ? "#e8703a" : "#f0a73a"); f.scale.setScalar(2.1); world.add(f); return { f, k }; });
  const src = [haemu.pm.position, me.pm.position];
  return {
    haemu,
    update(t, dt, amp, mood) {
      [haemu, me].forEach((s, i) => {
        animatePostman(s.pm, t + i, 0.3 + amp * 0.5);
        s.pm.position.y = s.y0 + Math.sin(t * mood.speed * 1.6 + i * 2) * 0.1 + amp * 0.06; s.pm.rotation.z = Math.sin(t * mood.speed + i) * 0.05; lipsync(s, amp);
      });
      dolphins.forEach(({ d, k }) => {                                          // 타원을 그리며 헤엄치다 노래가 커지면 뛰어오른다
        const a = t * 0.35 + k * Math.PI, x = Math.cos(a) * 4.8, z = -2.4 + Math.sin(a) * 1.2, y = 1.6 + Math.sin(t * 1.3 + k * 2) * 0.35 + amp * 0.5;      // 현수막 뒤쪽으로 돈다
        d.position.set(x, y, z); d.rotation.y = -Math.atan2(Math.cos(a) * 1.2, -Math.sin(a) * 4.8); d.rotation.z = Math.sin(t * 1.3 + k * 2) * 0.25;
        d.userData.fluke.rotation.z = Math.sin(t * (6 + amp * 8) + k) * 0.5;
      });
      turtles.forEach(({ m, x, y, z, ph }) => {
        m.position.set(x + Math.sin(t * 0.3 + ph) * 0.8, y + Math.sin(t * 0.8 + ph) * 0.1, z); m.rotation.y = Math.PI * 0.5 * (Math.cos(t * 0.3 + ph) > 0 ? 0 : 1) + Math.PI * 0.0;
        m.userData.flippers.forEach(({ f, z: zz, front, base }) => { f.rotation.y = base + Math.sin(t * (2.2 + amp * 3) + (front ? 0 : 1.2)) * 0.45 * zz * (front ? -1 : 1); });
      });
      fish.forEach(({ f, k }) => {                                              // 물고기 떼가 가운데를 크게 맴돈다
        const a = t * (0.5 + amp * 0.4) + k * 0.4, r = 2.4 + (k % 3) * 0.5;
        const cx = Math.cos(a) * r, cz = 0.2 + Math.sin(a) * r * 0.5, nx = Math.cos(a + 0.06) * r, nz = 0.2 + Math.sin(a + 0.06) * r * 0.5;
        f.position.set(cx, 3.9 + Math.sin(t * 1.4 + k) * 0.25, cz); f.rotation.y = -Math.atan2(nz - cz, nx - cx); f.userData.tail.rotation.y = Math.sin(t * 9 + k) * 0.5;
      });
      weeds.forEach(({ w, ph }) => { w.rotation.z = Math.sin(t * 1.2 + ph) * 0.12; });
      rays.forEach(({ ray, ph }) => { ray.rotation.z = 0.18 + Math.sin(t * 0.3 + ph) * 0.05; ray.material.opacity = 0.08 + Math.sin(t * 0.7 + ph) * 0.03; });
      jellies.forEach(({ g, ph, y0 }) => { g.position.y = y0 + Math.sin(t * 0.9 + ph) * 0.3; g.scale.y = 1 + Math.sin(t * 2 + ph) * 0.1; });
      const p = bg.attributes.position; for (let k = 0; k < NB; k++) { let y = p.getY(k) + dt * (0.4 + (k % 5) * 0.12); if (y > 8) y = -1; p.setY(k, y); } p.needsUpdate = true;
      notes.update(dt, amp, [...src, dolphins[0].d.position, dolphins[1].d.position, turtles[0].m.position]);
    },
  };
}

// ── 하늘 위 파티: 구름 무대에서 해무와 내가 갈매기 친구들과 노래한다. 무지개와 풍선이 떠 있다 ──
function buildSky({ world, P, anim }) {
  const notes = makeNotes(world);
  const cloudMat = (o = 1) => ({ emissive: "#dfeeff", emissiveIntensity: 0.35, transparent: o < 1, opacity: o });
  const platform = new THREE.Group(); platform.position.set(0, -0.55, 1.4); world.add(platform);
  for (let i = 0; i < 18; i++) {                                               // 무대가 되는 구름: 납작하게 뭉친 하얀 덩어리
    const a = (i / 18) * Math.PI * 2, r = i < 12 ? 3.3 + (i % 3) * 0.35 : 1.6, s = 0.9 + (i % 4) * 0.25;
    const c = mesh(new THREE.SphereGeometry(s, 18, 14), "#ffffff", Math.cos(a) * r, (i % 3) * 0.05, Math.sin(a) * r * 0.8, cloudMat()); c.scale.set(1.1, 0.5, 1); platform.add(c);
  }
  platform.add(mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.5, 30), "#ffffff", 0, -0.25, 0, cloudMat()));
  const drift = Array.from({ length: 16 }, (_, i) => {                           // 멀리 떠다니는 구름
    const g = new THREE.Group(), x = -16 + i * 2.2 + (i % 3), y = -3.5 + (i % 5) * 1.6, z = -8 - (i % 4) * 3;
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.SphereGeometry(0.9 + (k % 2) * 0.4, 14, 10), "#ffffff", k * 0.9 - 1.3, (k % 2) * 0.3, 0, cloudMat(0.95)));
    g.position.set(x, y, z); g.scale.set(1.3, 0.7, 1); world.add(g); return { g, x, sp: 0.15 + (i % 4) * 0.05 };
  });
  const bows = ["#ff6b6b", "#ffa94d", "#ffe066", "#69db7c", "#4dabf7", "#845ef7", "#da77f2"];   // 무지개
  bows.forEach((c, k) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(10 - k * 0.38, 0.19, 8, 56, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, fog: false })); arc.position.set(0, -3.2, -15); world.add(arc); });
  const sun = mesh(new THREE.SphereGeometry(1.6, 24, 18), "#fff3c9", -11, 9, -22, { emissive: "#fff3c9", emissiveIntensity: 1 }); sun.material.fog = false; world.add(sun);
  const balloons = Array.from({ length: 14 }, (_, i) => {
    const b = mesh(new THREE.SphereGeometry(0.3, 16, 12), COLORS[i % COLORS.length], 0, 0, 0); b.scale.y = 1.2;
    const x = (i % 2 ? 1 : -1) * (2.4 + (i % 5) * 0.45), y = 3.2 + (i % 4) * 0.5, z = 0.6 + (i % 4) * 0.8;
    b.position.set(x, y, z); world.add(b);
    const line = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 4), "#ffffff", x, y - 0.95, z); world.add(line); return { b, line, y, i };
  });
  addBanner(world, anim, P.banner.trim() || "축하해요");
  const haemu = singer(true, new THREE.Vector3(-1.05, 1.2, 3.0), -Math.PI / 2 + 0.25), me = singer(false, new THREE.Vector3(1.1, 1.05, 3.1), -Math.PI / 2 - 0.15);
  [haemu, me].forEach((s) => world.add(s.pm));
  const gulls = Array.from({ length: 6 }, (_, k) => { const g = makeGull(); g.scale.setScalar(1.25); world.add(g); return { g, k }; });
  return {
    haemu,
    update(t, dt, amp, mood) {
      [haemu, me].forEach((s, i) => {
        animatePostman(s.pm, t + i, 0.55 + amp * 0.5);                      // 하늘에서는 날개를 더 크게 퍼덕인다
        s.pm.position.y = s.y0 + Math.sin(t * mood.speed * 1.6 + i * 2) * 0.12 + amp * 0.08; s.pm.rotation.z = Math.sin(t * mood.speed + i) * 0.05; lipsync(s, amp);
      });
      gulls.forEach(({ g, k }) => {                                             // 무대 둘레를 크게 돌며 날아간다
        const a = t * (0.35 + (k % 3) * 0.06) + k * 1.05, rx = 5.2 + (k % 3) * 0.9, rz = 1.4 + (k % 2) * 0.5, nx = Math.cos(a + 0.05) * rx, nz = -3.2 + Math.sin(a + 0.05) * rz;   // 현수막 뒤쪽을 돈다
        const x = Math.cos(a) * rx, z = -3.2 + Math.sin(a) * rz, y = 2.2 + (k % 3) * 0.7 + Math.sin(t * 1.1 + k) * 0.25 + amp * 0.3;
        g.position.set(x, y, z); g.rotation.y = -Math.atan2(nz - z, nx - x); g.rotation.x = Math.sin(t * 0.7 + k) * 0.12; animateGull(g, t * (1 + amp * 0.6), k * 1.7);
      });
      balloons.forEach(({ b, line, y, i }) => { const dy = Math.sin(t * 1.2 + i) * 0.14; b.position.y = y + dy; line.position.y = y - 0.95 + dy; });
      drift.forEach(({ g, x, sp }) => { g.position.x = ((x + 18 + t * sp) % 36) - 18; });
      notes.update(dt, amp, [haemu.pm.position, me.pm.position, ...gulls.slice(0, 3).map((q) => q.g.position)]);
    },
  };
}

export function buildStage(stage, ctx) { return stage === "sea" ? buildSea(ctx) : buildSky(ctx); }
