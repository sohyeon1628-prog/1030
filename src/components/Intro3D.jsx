import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { INTRO_END } from "../data/story.js";
import { introWorld, introTail, buildIntro, exampleProfile } from "../data/profile.js";
import DialogueFlow from "./DialogueFlow.jsx";
import { ISLANDS, CENTER, buildIsland, buoy, boat, makePostman, animatePostman, makeEnvelope, waterTexture } from "../three/parts.js";

// 3D 오프닝 하나로 이어지는 이야기: 세계관 → 해무 → (해무가 묻고 내가 답하는 대화) → 편지가 사랑하는 사람의 섬으로 날아감.
// interactive=false 이면(다시 보기) 대화 없이 정해 둔 이야기로 처음부터 끝까지 재생한다.
// 모든 장면은 시간 T의 함수라서 건너뛰어도 어긋나지 않고, 대화 중에는 T를 멈춘 채 A(idle 시계)로만 움직인다.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const backOut = (t) => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// 카메라 키프레임: [시각, 위치, 바라보는 곳]
const KEYS = [
  [0, [32, 28, 38], [4.5, 0, 6.5]],
  [7, [24, 16, 28], [4.5, 0, 6.5]],
  [13.5, [20, 12, 22], [4, 0, 5]],
  [15.5, [5.6, 3.0, 6.0], [0, 1.5, 0.5]],
  [21.4, [4.6, 2.7, 5.4], [0, 1.7, 0.6]],
  [27, [5.0, 3.2, 5.2], [0.2, 1.9, 0.8]],
  [34, [5.6, 3.8, 5.8], [0, 2.2, 0.6]],
  [35, [11, 5.7, 7.5], [6.5, 1.5, 1.5]],
  [37.6, [7.5, 5.4, 12.5], [2.5, 1.5, 6.5]],
  [40.2, [13.5, 5.6, 14], [9, 1.5, 8.5]],
  [42.8, [9, 5.6, 18.5], [4.5, 1.5, 13]],
  [46, [28, 22, 30], [4.5, 0, 7]],
  [90, [28, 22, 30], [4.5, 0, 7]],
];
const LAUNCH = [35.0, 37.6, 40.2, 42.8];     // 편지가 서랍에서 날아오르는 시각
const FLY = 2.4;                              // 편지가 섬까지 가는 데 걸리는 시간
const PAUSE_T = 29.2;                         // 대화가 시작되는 시각(편지 네 장이 해무 곁에 떠오른 뒤)
const RESUME_T = 34.0;                        // 대화가 끝나면 편지가 날아가는 장면으로
const HOME_POST = new THREE.Vector3(1.0, 2.15, 1.0);

const DAY = { sky: new THREE.Color("#bfe6f5"), hemiSky: new THREE.Color("#e4f6ff"), hemiGround: new THREE.Color("#4aa3cf"), sun: new THREE.Color("#fff4e0") };
const DUSK = { sky: new THREE.Color("#f6b48c"), hemiSky: new THREE.Color("#ffd2a8"), hemiGround: new THREE.Color("#5aa6d6"), sun: new THREE.Color("#ffdcb8") };

export default function Intro3D({ interactive = false, profile, nickname = "", onDone }) {
  const wrap = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const timeRef = useRef(0);
  const phaseRef = useRef(interactive ? "story1" : "story");   // story1 → dialogue → story
  const profileRef = useRef(interactive ? null : profile);
  const initialCaps = useMemo(() => (interactive ? introWorld() : buildIntro(profile)), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const capsRef = useRef(initialCaps);
  const focusRef = useRef(0);                                  // 대화 중 카메라가 비추는 섬(0 = 해무의 집)
  const pulseRef = useRef({});                                 // 섬 번호 → 고리가 번지기 시작한 A 시각
  const aRef = useRef(0);
  const tagRefs = useRef([]);
  const [phase, setPhase] = useState(phaseRef.current);
  const [idx, setIdx] = useState(-1);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState(false);
  const [fail, setFail] = useState(false);
  const [named, setNamed] = useState([]);                      // 대화로 정한 사람들(섬 위 이름표)

  // 다음 자막 장면으로 건너뛰기(대화 중에는 건너뛰지 않는다)
  const advance = () => {
    if (phaseRef.current === "dialogue") return;
    const T = timeRef.current;
    const next = capsRef.current.find((c) => c.t > T + 0.6);
    timeRef.current = next ? next.t - 0.3 : Math.max(T, INTRO_END + 0.1);
  };

  // 대화가 끝나면 이야기를 이어서 재생한다(편지가 날아가는 장면)
  const finishDialogue = (pr) => {
    profileRef.current = pr;
    capsRef.current = [...introWorld(), ...introTail(pr)];
    phaseRef.current = "story"; setPhase("story");
    timeRef.current = RESUME_T;
  };

  useEffect(() => {
    const el = wrap.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFail(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(renderer.domElement);
    renderer.domElement.className = "w3d-canvas";

    const scene = new THREE.Scene();
    scene.background = DAY.sky.clone();
    scene.fog = new THREE.Fog(DAY.sky.clone(), 40, 130);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

    const hemi = new THREE.HemisphereLight(0xe4f6ff, 0x4aa3cf, 1.1);
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
    sun.shadow.radius = 5; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    sun.target.position.copy(CENTER);
    scene.add(hemi, sun, sun.target);

    const wtex = waterTexture();
    const seaMat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, transparent: true, opacity: 0.9 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), seaMat);
    sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true;
    const world = new THREE.Group(); scene.add(world, sea);

    const isl = ISLANDS.map((s, k) => {
      const g = buildIsland({ x: s.x, z: s.z, roof: k === 0 ? "#e8553a" : "#d9d2c3", arch: k === 0, home: k === 0, style: k });
      world.add(g);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 56), new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.08, s.z); world.add(ring);
      return { g, ring };
    });

    // 바람길 4구간(섬 → 섬): 금빛 입자와 부표
    const curves = [0, 1, 2, 3].map((i) => {
      const a = ISLANDS[i], b = ISLANDS[i + 1];
      return new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, 1.0, a.z), new THREE.Vector3((a.x + b.x) / 2, 2.6, (a.z + b.z) / 2), new THREE.Vector3(b.x, 1.0, b.z));
    });
    const segs = curves.map((cv) => {
      const m = new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.95 });
      const dots = Array.from({ length: 14 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m); world.add(d); return d; });
      const p = cv.getPoint(0.86);
      const bg = new THREE.Group();
      [-0.5, 0, 0.5].forEach((o) => bg.add(buoy(p.x + o * 0.9, p.z - o * 0.9)));
      bg.scale.setScalar(0.001); world.add(bg);
      return { cv, m, dots, bg };
    });

    const boats = [["#e8553a", 0.1], ["#5aa3d4", 0.6]].map(([c, ph]) => { const b = boat(c); world.add(b); return { b, ph }; });
    const pm = makePostman({ elder: true }); pm.position.copy(HOME_POST); world.add(pm);
    const envs = [0, 1, 2, 3].map(() => { const e = makeEnvelope(); e.scale.setScalar(0.001); world.add(e); return e; });
    const launched = [null, null, null, null];     // 편지가 서랍을 떠난 위치(날아가기 시작할 때의 위치를 기억)

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    const orbit = (k, A) => {
      const a = A * 0.8 + (k * Math.PI) / 2;
      return new THREE.Vector3(HOME_POST.x + Math.cos(a) * 0.95, HOME_POST.y + 0.55 + Math.sin(A * 2 + k) * 0.1, HOME_POST.z + Math.sin(a) * 0.95);
    };
    const tmp = new THREE.Vector3(), look = new THREE.Vector3(), tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), proj = new THREE.Vector3();
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    let camInit = false;

    let raf, last = performance.now(), lastIdx = -2, lastReady = false, lastTitle = false;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      aRef.current += dt; const A = aRef.current;
      if (phaseRef.current !== "dialogue") timeRef.current += dt;
      if (phaseRef.current === "story1" && timeRef.current >= PAUSE_T) {   // 편지 네 장이 떠오르면, 해무가 말을 건다
        timeRef.current = PAUSE_T; phaseRef.current = "dialogue"; setPhase("dialogue");
      }
      const T = timeRef.current;

      // 카메라: 이야기 중에는 키프레임을, 대화 중에는 지금 정하는 사람의 섬을 부드럽게 따라간다
      if (phaseRef.current === "dialogue") {
        const f = focusRef.current;
        if (f === 0) { tPos.set(5.4, 3.4, 5.6); tLook.set(0.2, 2.0, 0.8); }
        else { const s = ISLANDS[f]; tPos.set(s.x + 4.6, 3.8, s.z + 5.6); tLook.set(s.x, 1.3, s.z); }
      } else {
        let i = 0; while (i < KEYS.length - 2 && T >= KEYS[i + 1][0]) i++;
        const [t0, p0, l0] = KEYS[i], [t1, p1, l1] = KEYS[i + 1];
        const u = smooth((T - t0) / (t1 - t0));
        tPos.set(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u));
        tLook.set(lerp(l0[0], l1[0], u), lerp(l0[1], l1[1], u), lerp(l0[2], l1[2], u));
      }
      if (!camInit) { camPos.copy(tPos); camLook.copy(tLook); camInit = true; }
      const kf = 1 - Math.exp(-dt * (phaseRef.current === "dialogue" ? 2.6 : 8));
      camPos.lerp(tPos, kf); camLook.lerp(tLook, kf);
      cam.position.copy(camPos); look.copy(camLook); cam.lookAt(look);

      // 빛과 하늘: 낮 → (바람길이 닫히고) 노을 → 편지가 닿으며 다시 밝아짐
      const d = smooth((T - 12) / 5) * (1 - smooth((T - 35) / 10));
      scene.background.copy(DAY.sky).lerp(DUSK.sky, d); scene.fog.color.copy(scene.background);
      hemi.color.copy(DAY.hemiSky).lerp(DUSK.hemiSky, d); hemi.groundColor.copy(DAY.hemiGround).lerp(DUSK.hemiGround, d);
      hemi.intensity = lerp(1.1, 0.9, d);
      sun.color.copy(DAY.sun).lerp(DUSK.sun, d); sun.intensity = lerp(2.2, 2.0, d);
      sun.position.set(CENTER.x - 5, lerp(18, 9, d), CENTER.z + 9);
      seaMat.color.setRGB(1, lerp(1, 0.86, d), lerp(1, 0.9, d));
      wtex.offset.set(A * 0.02, A * 0.012);

      // 바람길: 처음엔 금빛으로 흐르다가 8~12초에 꺼지고, 편지가 닿으면 다시 켜진다
      segs.forEach((s, k) => {
        const arrive = LAUNCH[k] + FLY;
        let dim = T < 8 ? 0 : smooth((T - 8) / 4);
        if (T >= arrive) dim = 1 - smooth((T - arrive) / 0.8);
        s.m.color.set("#ffd166").lerp(new THREE.Color("#dfe8ee"), dim);
        s.m.opacity = lerp(0.95, 0.4, dim);
        s.dots.forEach((dot, j) => dot.position.copy(s.cv.getPoint(dim >= 1 ? j / 13 : ((A / 8) + j / 14) % 1)));
        let pop = backOut((T - 11) / 1.6); if (T < 11) pop = 0;
        if (T >= arrive) pop *= 1 - smooth((T - arrive) / 0.6);
        s.bg.scale.setScalar(Math.max(0.001, pop));
        s.bg.children.forEach((b, j) => { b.position.y = Math.sin(A * 1.8 + j + k) * 0.06; });
      });

      // 섬: 천천히 흔들리고, 편지가 닿거나 사람을 정하면 금빛 고리가 번진다
      isl.forEach(({ g, ring }, k) => {
        g.position.y = Math.sin(A * 1.3 + k * 1.7) * 0.05;
        const foam = g.getObjectByName("foam");
        if (foam) foam.scale.setScalar(1 + Math.sin(A * 1.6 + k) * 0.05);
        let q = -1;
        const arr = k > 0 ? LAUNCH[k - 1] + FLY : 1e9;
        if (T >= arr) q = (T - arr) / 1.4;
        const pa = pulseRef.current[k]; if (pa !== undefined && q < 0) q = (A - pa) / 1.4;
        if (q >= 0 && q <= 1) { ring.material.opacity = 0.9 * (1 - q); ring.scale.setScalar(1 + q * 1.1); } else ring.material.opacity = 0;
      });

      // 해무: 집 앞에 떠서 날개를 퍼덕인다
      pm.position.set(HOME_POST.x, HOME_POST.y + Math.sin(A * 2) * 0.1, HOME_POST.z);
      pm.rotation.set(0, 0.5, 0);
      animatePostman(pm, A);

      // 서랍 속 편지 네 통: 해무 곁을 돌다가 차례로 사랑하는 사람의 섬으로 날아간다
      envs.forEach((e, k) => {
        const appear = backOut((T - 27.5 - k * 0.25) / 0.9);
        const L = LAUNCH[k], arrive = L + FLY;
        if (T < 27.5) { e.scale.setScalar(0.001); launched[k] = null; return; }
        if (T < L) { e.position.copy(orbit(k, A)); e.rotation.y = A * 1.2 + k; e.scale.setScalar(Math.max(0.001, appear)); launched[k] = null; return; }
        if (!launched[k]) launched[k] = orbit(k, A);
        if (T < arrive) {
          const q = smooth((T - L) / FLY);
          const b = new THREE.Vector3(ISLANDS[k + 1].x, 1.7, ISLANDS[k + 1].z);
          tmp.copy(launched[k]).lerp(b, q); tmp.y += Math.sin(q * Math.PI) * 3.2;
          e.position.copy(tmp); e.rotation.y = A * 3 + k; e.rotation.z = Math.sin(A * 5) * 0.3; e.scale.setScalar(1);
          return;
        }
        e.scale.setScalar(Math.max(0.001, 1 - smooth((T - arrive) / 0.4)));
      });

      boats.forEach(({ b, ph }) => {
        const a = (A / 26 + ph) * Math.PI * 2;
        b.position.set(CENTER.x + Math.cos(a) * 13, Math.sin(A * 2 + ph * 9) * 0.04 + 0.05, CENTER.z + Math.sin(a) * 11.5);
        b.rotation.y = -Math.atan2(Math.cos(a) * 11.5, -Math.sin(a) * 13);
      });

      renderer.render(scene, cam);

      // 정한 사람의 섬 위 이름표
      const w = el.clientWidth, h = el.clientHeight;
      tagRefs.current.forEach((node, i) => {
        if (!node) return;
        const s = ISLANDS[i + 1];
        proj.set(s.x, 2.7, s.z).project(cam);
        const vis = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05;
        node.style.display = vis ? "" : "none";
        node.style.transform = `translate(${(proj.x * 0.5 + 0.5) * w}px, ${(-proj.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      });

      // 자막 / 버튼 상태
      let ci = -1;
      if (phaseRef.current !== "dialogue") capsRef.current.forEach((c, n) => { if (T >= c.t && T < c.end) ci = n; });
      if (ci !== lastIdx) { lastIdx = ci; setIdx(ci); }
      const rd = phaseRef.current === "story" && T >= INTRO_END; if (rd !== lastReady) { lastReady = rd; setReady(rd); }
      const ti = phaseRef.current === "story" && T >= 46; if (ti !== lastTitle) { lastTitle = ti; setTitle(ti); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const key = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight") { e.preventDefault(); advance(); }
    };
    addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("keydown", key);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); wtex.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // WebGL을 쓸 수 없으면 오프닝을 건너뛰고 예시 이야기로 시작한다
  useEffect(() => { if (fail) doneRef.current(profileRef.current || profile || exampleProfile("나")); }, [fail]);   // eslint-disable-line react-hooks/exhaustive-deps

  const cap = capsRef.current[idx];
  const onExample = (name, about) => finishDialogue(exampleProfile(name, about));
  const skipAll = () => doneRef.current(profileRef.current || profile || exampleProfile("나"));
  const finish = () => doneRef.current(profileRef.current || profile);

  return (
    <div className="intro" ref={wrap} onPointerDown={advance}>
      <div className="letterbox top" /><div className="letterbox bottom" />
      <button className="pill intro-skip" onPointerDown={(e) => e.stopPropagation()} onClick={phase === "story1" ? () => { timeRef.current = Math.max(timeRef.current, PAUSE_T); } : skipAll}>{phase === "story" ? "건너뛰기" : phase === "story1" ? "바로 선택하기" : "예시로 건너뛰기"}</button>
      {named.map((p, i) => <span key={i} ref={(n) => (tagRefs.current[i] = n)} className="island-tag fade">{p.name}</span>)}
      {title && <h1 className="intro-title fade">나루 우체국</h1>}
      {/* 사람 이름표는 한 줄씩 바뀌어 금방 지나가지 않도록, 나올 때마다 위에 쌓아 두고 함께 보여 준다 */}
      {cap && (cap.tag
        ? <div key="tags" className="intro-tags" aria-live="polite">{capsRef.current.filter((c, n) => c.tag && n <= idx).map((c) => <span key={c.text} className="intro-cap tag fade">{c.text}</span>)}</div>
        : <p key={idx} className="intro-cap fade" aria-live="polite">{cap.text}</p>)}
      {phase !== "dialogue" && !ready && <p className="intro-hint">화면을 누르면 다음 장면</p>}
      {phase === "dialogue" && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <DialogueFlow
            nickname={nickname}
            onFocus={(f) => { focusRef.current = f; }}
            onPerson={(k, p) => { setNamed((n) => [...n, p]); pulseRef.current[k + 1] = aRef.current; }}
            onFinish={finishDialogue}
            onExample={onExample}
          />
        </div>
      )}
      {ready && <button className="btn intro-start fade" onPointerDown={(e) => e.stopPropagation()} onClick={finish}>마지막 배달 시작하기</button>}
    </div>
  );
}
