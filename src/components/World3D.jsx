import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import WorldMap from "./WorldMap.jsx";
import { GRADE_NAME } from "../data/letters.js";
import Icon, { RELATION_ICON } from "./Icon.jsx";
import { ISLANDS, CENTER, POST_ISLAND, buildIsland, makeEnvelope, buoy, boat, makePostman, animatePostman, waterTexture, makeFog, makeBridge, makeExtras, makeIslet, makeGull, animateGull, makeDolphin, makeFish, makeTurtle } from "../three/parts.js";

// 직전에 보여 준 진행도. 새로 배달이 끝나 돌아왔을 때만 "구름이 걷히고 땅이 생기는" 연출을 재생한다.
let seenCount = null;
let pmAt = null;      // 우체부가 마지막으로 서 있던 섬 번호(0 = 해무의 집). 다음 섬으로 옮겨 갈 때 날아가는 모션의 출발점
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const backOut = (t) => { t = Math.max(0, Math.min(1, t)); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
// 안개 구역: 해무의 집에서 마지막 섬까지 이어지는 길을 따라, 앞쪽 구역 전체가 안개로 덮여 있다.
// 어떤 지점이 길의 몇 번째 구간에 있는지(t)로, 몇 통을 전해야 걷히는지(thr)를 정한다.
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function routeT(x, z) {
  let best = { d: 1e9, t: 0 };
  for (let i = 0; i < 4; i++) {
    const a = ISLANDS[i], b = ISLANDS[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const u = clampN(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - (a.x + dx * u), z - (a.z + dz * u));
    if (d < best.d) best = { d, t: i + u };
  }
  return best.t;
}
function fogThr(x, z) {
  if (Math.hypot(x - POST_ISLAND.x, z - POST_ISLAND.z) < 2.7) return 4;                   // 편지섬은 네 통을 모두 전해야 안개가 걷힌다
  for (let k = 1; k <= 4; k++) if (Math.hypot(x - ISLANDS[k].x, z - ISLANDS[k].z) < 2.7) return k - 1;   // 섬 하나는 통째로 같이 걷힌다
  return Math.max(0, Math.ceil(routeT(x, z) - 1e-6) - 1);
}
// 바다 곳곳의 작은 섬: delivered가 thr 이상이면 솟아난다. 그 전에는 구름이 덮고 있다.
const ISLETS = [{ x: -3.4, z: 5.2 }, { x: 12.4, z: 3.8 }, { x: 8.4, z: 17.4 }].map((l) => ({ ...l, thr: Math.max(1, fogThr(l.x, l.z)) }));

// 진짜 3D 장난감 세계: 바다 위에 따로 떠 있는 섬들. 아이소메트릭 정사영 카메라 + 부드러운 그림자.
// ISLANDS[0]은 해무의 집(출발점), ISLANDS[i+1]은 편지 i의 도착 섬. 섬 사이의 점선 = 바람길,
// 부표 = 아직 끊겨 있는 항로(배달하면 사라진다). WebGL이 없으면 SVG 지도로 대체.
// postOpen: 편지섬이 열렸는가(네 통을 모두 전했는가). onPost: 편지섬을 눌렀을 때(내 편지 쓰기).
export default function World3D({ letters, grades, isUnlocked, onOpen, postOpen = false, onPost, interactive = true }) {
  const wrap = useRef(null);
  const labels = useRef([]);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const postRef = useRef(onPost);
  postRef.current = onPost;
  const liveRef = useRef(interactive);
  liveRef.current = interactive;
  const [fallback, setFallback] = useState(false);
  const gradesKey = JSON.stringify(grades);
  const target = letters.findIndex((l) => !grades[l.id]);

  useEffect(() => {
    const el = wrap.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch { setFallback(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(renderer.domElement);
    renderer.domElement.className = "w3d-canvas";

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 140);
    cam.position.copy(CENTER).add(new THREE.Vector3(22, 24, 22));
    cam.lookAt(CENTER);

    // 빛: 하늘색 반구광 + 부드러운 태양. 그림자는 길고 부드럽게.
    scene.add(new THREE.HemisphereLight(0xe4f6ff, 0x4aa3cf, 1.1));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.position.set(CENTER.x - 5, 18, CENTER.z + 9);
    sun.target.position.copy(CENTER);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
    sun.shadow.radius = 5; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    // 바다: 약간 투명해서 섬의 바위 밑동이 물속에 비친다
    const wtex = waterTexture();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, transparent: true, opacity: 0.88 }));
    sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true;
    const world = new THREE.Group(); scene.add(world, sea);

    // 섬: [0] 해무의 집, [k] = 편지 k-1의 도착지
    const stops = ISLANDS.map((s, k) => {
      const i = k - 1;
      const g = k === 0
        ? buildIsland({ x: s.x, z: s.z, roof: "#e8553a", arch: true, home: true, style: 0, stop: -1 })
        : buildIsland({ x: s.x, z: s.z, style: k, grade: !!grades[letters[i].id], locked: !isUnlocked(i), roof: grades[letters[i].id] ? "#5ec9a7" : i === target ? "#e8553a" : "#d9d2c3", stop: i });
      world.add(g); return g;
    });

    // 편지섬: 내 편지를 쓰는 곳. 열리면 위에 봉투가 떠서 돌고, 아직이면 회색빛으로 안개 속에 있다.
    const post = buildIsland({ x: POST_ISLAND.x, z: POST_ISLAND.z, style: "post", locked: !postOpen, stop: 99 });
    world.add(post);
    const postEnv = makeEnvelope(); postEnv.scale.setScalar(1.8); postEnv.visible = postOpen; world.add(postEnv);

    // 바람길: 섬에서 섬으로 잇는 포물선. 이어진 길은 금빛 입자가 흐르고, 끊긴 길은 점선 + 부표
    const curveAB = (a, b) => new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, 1.0, a.z), new THREE.Vector3((a.x + b.x) / 2, 2.6, (a.z + b.z) / 2), new THREE.Vector3(b.x, 1.0, b.z));
    const curve = (i) => {
      const a = ISLANDS[i], b = ISLANDS[i + 1];
      return new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, 1.0, a.z), new THREE.Vector3((a.x + b.x) / 2, 2.6, (a.z + b.z) / 2), new THREE.Vector3(b.x, 1.0, b.z));
    };
    // 점선(흰 점)은 아직 끊긴 항로에만 둔다. 다리가 놓이면(배달을 마치면) 점선은 없어지고 다리만 남는다.
    const buoys = [];
    const dots = (cv) => {
      for (let k = 0; k < 14; k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 }));
        m.position.copy(cv.getPoint(k / 13)); world.add(m);
      }
    };
    letters.forEach((l, i) => {
      if (grades[l.id]) return;
      const cv = curve(i);
      dots(cv);
      const p = cv.getPoint(0.86);
      [-0.5, 0, 0.5].forEach((o) => { const b = buoy(p.x + o * 0.9, p.z - o * 0.9); world.add(b); buoys.push(b); });
    });
    if (!postOpen) dots(curveAB(ISLANDS[4], POST_ISLAND));      // 마지막 이야기 섬 → 편지섬도 열리기 전에는 점선, 열리면 다리

    const boats = [["#e8553a", 26, 0], ["#5aa3d4", 34, 0.5]].map(([c, dur, ph]) => { const m = boat(c); world.add(m); return { m, dur, ph }; });

    // 바다의 생물: 섬 위를 지나지 않도록, 섬·작은 섬·다리를 피해 다닌다
    const obstacles = [...ISLANDS.map((o) => ({ x: o.x, z: o.z, r: 3.0 })), { x: POST_ISLAND.x, z: POST_ISLAND.z, r: 3.0 }, ...ISLETS.filter((l) => letters.filter((x) => grades[x.id]).length >= l.thr).map((o) => ({ x: o.x, z: o.z, r: 2.0 }))];
    const avoid = (x, z) => {
      for (let k = 0; k < 3; k++) {
        for (const o of obstacles) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz) || 0.001; if (d < o.r) { x = o.x + (dx / d) * o.r; z = o.z + (dz / d) * o.r; } }
        for (const sg of bridgeSegs) {                                                    // 다리 밑으로는 지나지 않는다(돛이 걸린다)
          const dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z, u = clampN(((x - sg.a.x) * dx + (z - sg.a.z) * dz) / (dx * dx + dz * dz), 0, 1);
          const px = sg.a.x + dx * u, pz = sg.a.z + dz * u, ex = x - px, ez = z - pz, d = Math.hypot(ex, ez) || 0.001;
          if (d < 1.7) { x = px + (ex / d) * 1.7; z = pz + (ez / d) * 1.7; }
        }
      }
      return [x, z];
    };
    const loopPos = (a, rx, rz) => avoid(CENTER.x + Math.cos(a) * rx, CENTER.z + Math.sin(a) * rz);
    // 갈매기: 원을 그리지 않고 화면 세로로 곧게 날아간다(한 마리는 아래로, 한 마리는 위로). 화면 밖에서 이어서 다시 나타난다.
    const gulls = [{ sc: -7, speed: 1.1, h: 3.8, ph: 0.1, dir: 1 }, { sc: 7.5, speed: 0.85, h: 4.6, ph: 0.62, dir: -1 }].map((c) => { const g = makeGull(); g.scale.setScalar(1.25); world.add(g); return { g, ...c }; });
    // 빈 바다를 채우는 생물 3가지: 돌고래(왼쪽 가장자리), 물고기 떼(오른쪽 아래), 바다거북(오른쪽 위). 섬이 있는 가운데는 비워 둔다.
    // 좌표는 화면 기준: s = 화면 가로(오른쪽이 +), t = 화면 세로(아래쪽이 +)
    const at = (sc, tc) => [CENTER.x + 0.7071 * sc + 0.7071 * tc, CENTER.z - 0.7071 * sc + 0.7071 * tc];
    const dolphins = Array.from({ length: 3 }, (_, k) => { const d = makeDolphin(); d.scale.setScalar(1.15); world.add(d); return { d, k }; });
    const schools = [[10.5, 6, "#f59a4a", "#e8703a"], [12.5, -2, "#ffd166", "#f0a73a"]].map(([sc, tc, c1, c2], n) => ({
      sc, tc, n, fish: Array.from({ length: 6 }, (_, k) => { const f = makeFish(c1, c2); f.scale.setScalar(1.35); world.add(f); return { f, k, ox: Math.sin(k * 2.1) * 0.8, oz: Math.cos(k * 1.7) * 0.8 }; }),
    }));
    const turtles = [[12.5, -9, 0], [10.5, -5.5, 2.4]].map(([sc, tc, ph]) => { const m = makeTurtle(); m.scale.setScalar(1.4); world.add(m); return { m, sc, tc, ph }; });
    const pm = makePostman();
    // ── 진행에 따라 넓어지는 바다: 구름이 걷히고, 지나온 섬은 다리와 땅으로 이어진다
    const delivered = letters.filter((l) => grades[l.id]).length;
    const seen = seenCount === null ? delivered : Math.min(seenCount, delivered);
    seenCount = delivered;
    // 우체부는 편지를 전한 마지막 섬에 서 있다(처음에는 출발 섬). 새 편지를 전해 다리가 놓이면, 다리가 완성된 뒤에 하늘로 날아올라 그 섬으로 건너간다.
    const cur = Math.min(delivered, ISLANDS.length - 1), fromAt = pmAt ?? cur;
    pmAt = cur;
    const trip = fromAt !== cur ? { a: ISLANDS[fromAt], b: ISLANDS[cur], t0: null, dur: 3.6, wait: seen < delivered ? 4.2 : 0.6 } : null;
    pm.position.set(ISLANDS[fromAt].x, 2.5, ISLANDS[fromAt].z); world.add(pm);
    const fogs = [], pops = [], bridgesAnim = [], bridgeSegs = [];
    // 아직 열리지 않은 구역을 빈틈없이 덮는 안개: 두 겹(낮은 층 + 높은 층)을 엇갈리게 깔고, 이미 걷힌 곳은 만들지 않는다.
    // 방금 걷힌 곳은 길을 따라 앞에서부터 차례로 흩어진다.
    let seedN = 0;
    for (let layer = 0; layer < 2; layer++) {
      for (let gx = -8; gx <= 18; gx += 2.3) for (let gz = -8; gz <= 22; gz += 2.3) {
        const x = gx + (layer ? 1.15 : 0), z = gz + (layer ? 1.15 : 0);
        const thr = fogThr(x, z);
        if (delivered >= thr && seen >= thr) continue;                        // 이미 걷힌 구역
        const sp = makeFog(seedN++, layer ? 0.62 : 0.68);
        const y0 = layer ? 2.3 : 1.0;
        sp.scale.set(6.4, 3.4, 1); sp.position.set(x, y0, z); world.add(sp);
        fogs.push({ sp, x0: x, y0, z0: z, o0: sp.material.opacity, ph: Math.random() * 6, clearing: delivered >= thr, delay: 0.2 + Math.abs(routeT(x, z) - thr) * 0.9 + Math.random() * 0.5 });
      }
    }
    ISLETS.forEach(() => {});                                                  // (작은 섬의 자리도 같은 안개가 덮는다)

    const popIn = (obj, delay) => { obj.scale.setScalar(0.001); world.add(obj); pops.push({ obj, delay }); };
    for (let k = 1; k <= 4; k++) {                                // 배달을 마친 섬: 땅이 넓어진다
      if (delivered < k) continue;
      const ex = makeExtras(); ex.position.set(ISLANDS[k].x, 0, ISLANDS[k].z);
      if (seen < k) popIn(ex, 3.2); else world.add(ex);
    }
    for (let i = 0; i < 4; i++) {                                 // 이어지는 다리 + 중간의 작은 땅
      if (!grades[letters[i].id]) continue;
      const br = makeBridge(ISLANDS[i], ISLANDS[i + 1]); world.add(br.group);
      bridgeSegs.push({ a: ISLANDS[i], b: ISLANDS[i + 1] });
      if (i >= seen) { br.items.forEach((m) => m.scale.setScalar(0.001)); bridgesAnim.push({ items: br.items, delay: 3.4 }); }
    }
    if (postOpen) {                                              // 편지섬이 열리면 마지막 이야기 섬에서 다리로 이어진다
      const br = makeBridge(ISLANDS[4], POST_ISLAND); world.add(br.group);
      bridgeSegs.push({ a: ISLANDS[4], b: POST_ISLAND });
    }
    ISLETS.forEach((l) => {                                      // 걷힌 자리에 솟아난 작은 섬
      if (delivered < l.thr) return;
      const it = makeIslet(); it.position.set(l.x, 0, l.z);
      if (seen < l.thr) popIn(it, 3.6 + (l.x % 1) * 0.4); else world.add(it);
    });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight || 1, a = w / h;
      renderer.setSize(w, h, false);
      const hh = Math.max(9.8, 12.6 / a);
      Object.assign(cam, { left: -hh * a, right: hh * a, top: hh, bottom: -hh });
      cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    // 클릭 / 호버
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    let hover = -1;
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, cam);
      const hit = ray.intersectObjects([...stops, post], true)[0];
      return hit ? hit.object.userData.stop : -1;
    };
    const move = (e) => { if (!liveRef.current) return; hover = pick(e); el.style.cursor = hover === 99 ? (postOpen ? "pointer" : "default") : hover >= 0 && isUnlocked(hover) ? "pointer" : "default"; };
    const click = (e) => {
      if (!liveRef.current) return;
      const i = pick(e);
      if (i === 99) { if (postOpen) postRef.current?.(); } else if (i >= 0 && isUnlocked(i)) openRef.current(letters[i]);
    };
    el.addEventListener("pointermove", move); el.addEventListener("click", click);

    // 드래그로 옮기고, 두 손가락 벌리기/오므리기·마우스 휠로 확대·축소한다(지도 화면에서만)
    el.style.touchAction = "none";
    const ptrs = new Map(); let zoomT = 1, zoom = 1, panX = 0, panZ = 0, tx = 0, tz = 0, pinch0 = 0, z0 = 1, moved = 0, dragged = false;
    const clampZ = (z) => Math.min(2.6, Math.max(0.75, z));
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const down = (e) => { if (!liveRef.current) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) { moved = 0; dragged = false; } if (ptrs.size === 2) { pinch0 = dist(); z0 = zoomT; dragged = true; } };
    const drag = (e) => {
      const p = ptrs.get(e.pointerId); if (!p || !liveRef.current) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size >= 2) { zoomT = clampZ(z0 * dist() / pinch0); return; }
      moved += Math.abs(dx) + Math.abs(dy); if (moved < 8) return;
      dragged = true;
      const per = ((cam.right - cam.left) / zoomT) / (el.clientWidth || 1), k = Math.SQRT1_2;       // 화면 1px이 바닥에서 몇 칸인지
      tx += (-dx * k - dy * k / 0.614) * per; tz += (dx * k - dy * k / 0.614) * per;                // 화면 오른쪽 = (1,0,-1), 화면 위쪽 = (-1,0,-1) 방향
      const m = Math.hypot(tx, tz), lim = 16; if (m > lim) { tx *= lim / m; tz *= lim / m; }
    };
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size === 1) { moved = 99; } };
    const wheel = (e) => { if (!liveRef.current) return; e.preventDefault(); zoomT = clampZ(zoomT * Math.exp(-e.deltaY * 0.0015)); };
    const stopClick = (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", drag); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false }); el.addEventListener("click", stopClick, true);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock(); let raf;
    const v = new THREE.Vector3();
    let mapT0 = null;                                                     // 지도가 실제로 보이기 시작한 시각: 구름·다리·우체부 날아가기는 이때부터 시작한다(다른 화면 뒤에서 미리 끝나 버리지 않게)
    const loop = () => {
      const t = reduce ? 0 : clock.getElapsedTime();
      if (mapT0 === null && liveRef.current) mapT0 = t;
      const te = mapT0 === null ? 0 : t - mapT0;
      wtex.offset.set(t * 0.02, t * 0.012);
      stops.forEach((s, k) => {
        const on = k > 0 && k - 1 === hover && isUnlocked(hover) ? 1.04 : 1;
        s.scale.lerp(v.set(on, 1, on), 0.15);
        s.position.y = Math.sin(t * 1.3 + k * 1.7) * 0.05;                 // 물 위에서 아주 천천히 흔들린다
        const foam = s.getObjectByName("foam");
        if (foam) { foam.scale.setScalar(1 + Math.sin(t * 1.6 + k) * 0.05); foam.material.opacity = 0.42 + Math.sin(t * 1.6 + k) * 0.12; }
      });
      {                                                                   // 편지섬: 물 위에서 흔들리고, 열렸으면 봉투가 떠서 돈다
        const on = hover === 99 && postOpen ? 1.04 : 1;
        post.scale.lerp(v.set(on, 1, on), 0.15);
        post.position.y = Math.sin(t * 1.3 + 8.5) * 0.05;
        const foam = post.getObjectByName("foam");
        if (foam) { foam.scale.setScalar(1 + Math.sin(t * 1.6 + 5) * 0.05); foam.material.opacity = 0.42 + Math.sin(t * 1.6 + 5) * 0.12; }
        if (postOpen) { postEnv.position.set(POST_ISLAND.x - 0.15, 2.9 + Math.sin(t * 2) * 0.14, POST_ISLAND.z - 0.1); postEnv.rotation.y = t * 1.2; postEnv.rotation.z = Math.sin(t * 1.6) * 0.15; }
      }
      buoys.forEach((b, k) => { b.position.y = Math.sin(t * 1.8 + k) * 0.06; b.rotation.z = Math.sin(t * 1.4 + k) * 0.1; });
      boats.forEach(({ m, dur, ph }) => {
        const a = ((t / dur) + ph) * Math.PI * 2;
        const [x, z] = loopPos(a, 14.5, 13), [x2, z2] = loopPos(a + 0.03, 14.5, 13);
        m.position.set(x, Math.sin(t * 2 + ph * 9) * 0.04 + 0.05, z);
        m.rotation.y = -Math.atan2(z2 - z, x2 - x);
        m.rotation.z = Math.sin(t * 1.5 + ph) * 0.05;
      });
      gulls.forEach(({ g, sc, speed, h, ph, dir }) => {
        const span = 36, tt = ((((t * speed * dir) + ph * span) % span) + span) % span - span / 2;       // 화면 세로 -18 ~ +18
        const [x, z] = at(sc + Math.sin(t * 0.45 + ph * 9) * 1.3, tt);
        g.position.set(x, h + Math.sin(t * 0.9 + ph * 7) * 0.3, z);
        g.rotation.y = dir > 0 ? -Math.PI / 4 : (3 * Math.PI) / 4;                                          // 날아가는 방향(화면 아래 / 위)을 본다
        g.rotation.x = Math.sin(t * 0.7 + ph * 5) * 0.12;
        animateGull(g, t, ph * 10);
      });
      // 돌고래 무리: 왼쪽 가장자리를 위아래로 길게 돌며 헤엄치고, 차례로 뛰어오른다
      dolphins.forEach(({ d, k }) => {
        const a = t * 0.12 - k * 0.2, b = a + 0.03;
        const [x, z] = avoid(...at(-13 + 2.4 * Math.cos(a), 11 * Math.sin(a))), [x2, z2] = avoid(...at(-13 + 2.4 * Math.cos(b), 11 * Math.sin(b)));
        const s0 = Math.sin(t * 1.5 + k * 1.1), y = s0 > 0 ? 1.0 * s0 : 0.28 * s0, dy = Math.cos(t * 1.5 + k * 1.1) * (s0 > 0 ? 1.0 : 0.28);
        d.position.set(x + Math.sin(k * 2.3) * 0.4, y, z + Math.cos(k * 2.3) * 0.4);
        d.rotation.y = -Math.atan2(z2 - z, x2 - x); d.rotation.z = Math.atan2(dy, 1.6);
        d.userData.fluke.rotation.z = Math.sin(t * 7 + k) * 0.4;
      });
      // 물고기 떼: 오른쪽 아래 빈 바다를 천천히 맴돈다
      schools.forEach(({ sc, tc, n, fish }) => {
        const a = t * 0.16 + n * 2, [cx, cz] = at(sc + 2 * Math.cos(a), tc + 3 * Math.sin(a)), [nx, nz] = at(sc + 2 * Math.cos(a + 0.05), tc + 3 * Math.sin(a + 0.05));
        const yaw = -Math.atan2(nz - cz, nx - cx);
        fish.forEach(({ f, k, ox, oz }) => {
          f.position.set(cx + ox + Math.sin(t * 1.3 + k) * 0.12, -0.12 + Math.sin(t * 2.4 + k) * 0.04, cz + oz + Math.cos(t * 1.1 + k) * 0.12);
          f.rotation.y = yaw + Math.sin(t * 1.5 + k) * 0.12;
          f.userData.tail.rotation.y = Math.sin(t * 9 + k) * 0.5;
        });
      });
      // 바다거북: 오른쪽 위 바다에서 느리게 노를 젓는다
      turtles.forEach(({ m, sc, tc, ph }) => {
        const a = t * 0.13 + ph, [cx, cz] = at(sc + 1.8 * Math.cos(a), tc + 2.2 * Math.sin(a)), [nx, nz] = at(sc + 1.8 * Math.cos(a + 0.05), tc + 2.2 * Math.sin(a + 0.05));
        m.position.set(cx, 0.0 + Math.sin(t * 0.8 + ph) * 0.03, cz); m.rotation.y = -Math.atan2(nz - cz, nx - cx);
        m.userData.flippers.forEach(({ f, z, front, base }) => { f.rotation.y = base + Math.sin(t * 2.2 + (front ? 0 : 1.2)) * 0.45 * z * (front ? -1 : 1); });
      });
      {
        const dst = ISLANDS[cur];
        if (trip && trip.t0 === null && liveRef.current) trip.t0 = te + trip.wait;     // 안내 카드를 닫고 지도가 보이면, 다리가 놓이길 기다렸다가 날아오른다
        const q = trip && trip.t0 !== null ? Math.min(1, Math.max(0, (te - trip.t0) / trip.dur)) : trip ? 0 : 1;
        const e = q * q * (3 - 2 * q), s0 = trip ? trip.a : dst, s1 = trip ? trip.b : dst;
        const flying = trip && q > 0 && q < 1;
        pm.position.set(s0.x + (s1.x - s0.x) * e, 2.5 + Math.sin(t * 2) * 0.14 + (flying ? Math.sin(e * Math.PI) * 1.7 : 0), s0.z + (s1.z - s0.z) * e);
        pm.rotation.y = flying ? Math.atan2(-(s1.z - s0.z), s1.x - s0.x) : 0.5;
        animatePostman(pm, t, flying ? 0.95 : 0.6);
      }
      // 구름: 떠 있다가, 조건을 채우면 흩어지며 걷힌다. 이어서 땅이 솟고 다리가 놓인다
      const tb = reduce ? 1e3 : te;
      fogs.forEach((f) => {
        if (f.clearing) {                                                     // 걷히는 중: 옅어지며 위로 번져 사라진다
          const u = Math.min(1, Math.max(0, (tb - f.delay) / 3.2));
          f.sp.visible = u < 1;
          f.sp.material.opacity = f.o0 * (1 - smooth(u));
          f.sp.position.set(f.x0 + Math.sin(tb * 0.15 + f.ph) * 0.3 + u * 1.4, f.y0 + u * 1.6, f.z0 - u * 0.9);
        } else {                                                              // 덮여 있는 중: 느리게 흐른다
          f.sp.position.x = f.x0 + Math.sin(tb * 0.15 + f.ph) * 0.4;
          f.sp.position.z = f.z0 + Math.cos(tb * 0.12 + f.ph) * 0.25;
          f.sp.material.opacity = f.o0 * (0.92 + 0.08 * Math.sin(tb * 0.4 + f.ph));
        }
      });
      pops.forEach(({ obj, delay }) => { const u = (tb - delay) / 1.3; obj.scale.setScalar(Math.max(0.001, backOut(u) * (obj.userData.s || 1))); });
      bridgesAnim.forEach(({ items, delay }) => items.forEach((m, j) => { m.scale.setScalar(Math.max(0.001, backOut((tb - delay - j * 0.07) / 0.5))); }));
      zoom += (zoomT - zoom) * 0.2; panX += (tx - panX) * 0.2; panZ += (tz - panZ) * 0.2;
      if (Math.abs(zoomT - zoom) > 1e-4 || Math.abs(tx - panX) > 1e-3 || Math.abs(tz - panZ) > 1e-3 || cam.zoom !== zoom) {
        cam.zoom = zoom; cam.updateProjectionMatrix(); cam.position.set(CENTER.x + 22 + panX, CENTER.y + 24, CENTER.z + 22 + panZ);
      }
      renderer.render(scene, cam);
      // 라벨(접근 가능한 버튼)을 3D 위치에 맞춰 투영
      const w = el.clientWidth, h = el.clientHeight;
      [...letters.map((_, i) => ISLANDS[i + 1]), POST_ISLAND].forEach((s, i) => {      // 마지막 라벨은 편지섬
        const node = labels.current[i]; if (!node) return;
        v.set(s.x, i === letters.length ? 3.9 : 3.4, s.z).project(cam);
        node.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      });
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      el.removeEventListener("pointermove", move); el.removeEventListener("click", click);
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", drag); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel); el.removeEventListener("click", stopClick, true);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); wtex.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradesKey, postOpen]);

  if (fallback) return <WorldMap letters={letters} grades={grades} isUnlocked={isUnlocked} onOpen={onOpen} postOpen={postOpen} onPost={onPost} />;

  return (
    <div className={`world3d ${interactive ? "" : "off"}`} ref={wrap}>
      {letters.map((l, i) => {
        const locked = !isUnlocked(i), g = grades[l.id];
        const label = locked ? "앞선 편지를 먼저" : g ? `${GRADE_NAME[g]} · 이어짐` : "배달 대기";
        const stars = g === "perfect" ? 3 : g === "safe" ? 2 : g ? 1 : 0;
        // 글자 대신 아이콘: 관계 아이콘, 장 번호, 배달 등급(별), 잠김(자물쇠). 글자는 마우스를 올리거나 포커스했을 때만 뜬다.
        return (
          <button key={l.id} ref={(n) => (labels.current[i] = n)} className={`pin ${i === target ? "target" : ""} ${locked ? "locked" : ""} ${g ? "done" : ""}`}
            disabled={locked} onClick={() => onOpen(l)} aria-label={`${l.chapter}장 ${l.title}, ${l.people}, ${l.from}에서 ${l.to}로, ${label}`}>
            <span className="pin-ico">{!locked && <Icon name={RELATION_ICON[l.relation] || "star"} size={17} />}</span>
            {!locked && <span className="pin-tip">{l.chapter}장 · {l.title}<small>{l.who}{stars ? ` · ${"★".repeat(stars)}` : ""}</small></span>}
          </button>
        );
      })}
      {/* 편지섬: 내 편지를 쓰는 곳. 닫혀 있어도 마우스를 올리면 어떻게 여는지 알려 준다. */}
      <button ref={(n) => (labels.current[letters.length] = n)} className={`pin post ${postOpen ? "target" : "locked"}`} disabled={!postOpen} onClick={() => onPost?.()}
        aria-label={postOpen ? "편지섬: 내 편지 쓰기" : "편지섬: 네 통의 편지를 모두 전하면 열려요"}>
        <span className="pin-ico"><Icon name={postOpen ? "pen" : "lock"} size={postOpen ? 22 : 13} /></span>
      </button>
    </div>
  );
}
