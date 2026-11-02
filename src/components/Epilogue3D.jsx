import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildEpilogueScript, sentences, EPILOGUE_PLAYBACK } from "../data/chapters.js";
import { ISLANDS, CENTER, POST_ISLAND, buildIsland, boat, makePostman, animatePostman, makeEnvelope, makeBridge, makeExtras, waterTexture } from "../three/parts.js";
import WriteScreen from "./WriteScreen.jsx";

// 3D 에필로그: 네 섬을 마친 내가 4번째 섬에 서 있고 → 해무가 바람길을 따라 날아와 내려앉음 → 이십 년 묵은 편지의 이유를 털어놓음 → 나에게 건네는 깨달음 → 카메라가 옆의 편지섬으로 줌인 → 그 장면 위에서 편지를 쓴다.
// 오프닝(Intro3D)과 같은 방식이다. 모든 장면은 시간 T의 함수라서 자막 단위로 건너뛰거나 되돌려도 어긋나지 않는다. 자막은 data/chapters.js의 buildEpilogueScript.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const backOut = (t) => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// 무대: 4번째 섬(ISLANDS[4]) 위. 나는 섬 위에 떠 있고, 해무는 자기 집(HOME_POST)에서 날아와 내 왼쪽 위에 내려앉는다.
const HOME_POST = new THREE.Vector3(1.0, 2.15, 1.0);
const ME_POS = new THREE.Vector3(5.4, 2.15, 13.9);
const HAEMU_POS = new THREE.Vector3(3.6, 2.35, 12.6);
// 내가 편지섬에 착륙하는 자리(우체국 앞 잔디)와 그곳으로 가는 길
const LAND_POS = new THREE.Vector3(POST_ISLAND.x + 0.55, 1.08, POST_ISLAND.z + 0.95);
const LANDING = new THREE.CatmullRomCurve3([ME_POS, new THREE.Vector3(3.2, 3.7, 14.4), new THREE.Vector3(1.2, 2.6, 14.9), LAND_POS]);
// 해무가 날아오는 길: 집에서 출발해 네 섬을 잇는 바람길을 따라 내려온다
// 해무는 섬을 따라 돌지 않고, 자기 집에서 내게로 섬들 위를 가로질러 곧게 날아온다(위에서 보면 직선, 도중에 섬 지붕을 넘도록 가운데만 살짝 높다)
const FLIGHT = new THREE.CatmullRomCurve3([HOME_POST, HOME_POST.clone().lerp(HAEMU_POS, 0.5).setY(3.7), HAEMU_POS], false, "centripetal");

// 카메라 키프레임: [시각, 위치, 바라보는 곳]. 시각은 대본(buildEpilogueScript)의 기준 시각(at)에서 정해진다.
// 날아오는 동안에는 해무를 따라가고(아래 follow), 그 뒤에는 말하는 사람을 번갈아 비춘다.
// 마지막 키는 편지섬을 정중앙에 두는 클로즈업이다.
const makeKeys = (at) => [
  [0, [24, 20, 30], [3.5, 0, 6.5]],
  [at.flightFrom, [22, 17, 28], [3.5, 0, 6.5]],
  [at.flightTo + 0.5, [9.3, 3.8, 18.7], [4.5, 2.2, 13.25]],                         // 둘이 함께 보이는 구도
  [at.speakT + 1.0, [1.7, 3.0, 16.0], [4.0, 2.3, 12.9]],                            // 해무가 말하는 동안: 해무의 왼쪽 앞에서 비춘다(내가 화면 앞을 가리지 않고, 둘 다 보인다)
  [(at.speakT + at.meShotT) / 2, [2.0, 3.1, 16.3], [4.0, 2.35, 13.0]],
  [at.meShotT - 2, [1.8, 3.0, 16.0], [4.0, 2.3, 12.9]],
  [at.meShotT, [7.4, 3.3, 20.0], [4.6, 2.3, 13.4]],                                 // 해무가 나를 돌아본 뒤로는 나를 중심으로 둘을 함께 비춘다
  [at.pullT - 2, [7.8, 3.5, 20.6], [4.7, 2.3, 13.4]],
  [at.pullT, [9.5, 5.0, 20.5], [2.0, 1.2, 13.2]],                                   // 뒤로 물러서며 옆의 편지섬 쪽으로 돌아선다
  [at.arriveT, [2.5, 2.8, 17.4], [-0.6, 1.0, 13.2]],                                // 편지섬을 화면 정중앙에 두고 클로즈업(내가 그 앞에 착륙한다)
  [at.arriveT + 100, [2.5, 2.8, 17.4], [-0.6, 1.0, 13.2]],
];
const PLAYBACK = EPILOGUE_PLAYBACK;           // 재생 속도(오프닝과 같다). 대본의 시간이 이 속도 기준이다.

const DAY = { sky: new THREE.Color("#bfe6f5"), hemiSky: new THREE.Color("#e4f6ff"), hemiGround: new THREE.Color("#4aa3cf"), sun: new THREE.Color("#fff4e0") };
const DAWN = { sky: new THREE.Color("#f9d6a8"), hemiSky: new THREE.Color("#ffe3bd"), hemiGround: new THREE.Color("#5aa6d6"), sun: new THREE.Color("#ffd9a8") };

export default function Epilogue3D({ nickname = "", orbsTotal = 0, onSubmit, onBack }) {
  const wrap = useRef(null);
  const timeRef = useRef(0);
  const zoomedRef = useRef(false);
  const scriptRef = useRef(null);
  if (!scriptRef.current) scriptRef.current = buildEpilogueScript(nickname.trim() || "자네");
  const capsRef = { current: scriptRef.current.caps };
  const AT = scriptRef.current.at;
  const [idx, setIdx] = useState(-1);
  const [zoomed, setZoomed] = useState(false);       // 줌인이 끝나면 편지 쓰기 화면이 나온다
  const [fail, setFail] = useState(false);

  // 이전 자막으로: 현재 자막을 1.2초 넘게 봤으면 그 자막의 처음으로, 막 시작했으면 앞 자막으로
  const back = () => {
    if (zoomedRef.current) return;
    const T = timeRef.current, caps = capsRef.current;
    let cur = -1; caps.forEach((c, n) => { if (c.t <= T) cur = n; });
    if (cur >= 0 && T - caps[cur].t > 1.2) timeRef.current = caps[cur].t + 0.05;
    else timeRef.current = cur > 0 ? caps[cur - 1].t + 0.05 : 0;
  };
  const advance = () => {
    if (zoomedRef.current) return;
    const T = timeRef.current;
    const next = capsRef.current.find((c) => c.t > T + 0.6);
    timeRef.current = next ? next.t - 0.3 : AT.zoomT;
  };
  const skipToWrite = () => { timeRef.current = AT.zoomT; };

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
    scene.background = DAWN.sky.clone();
    scene.fog = new THREE.Fog(DAWN.sky.clone(), 40, 130);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    const hemi = new THREE.HemisphereLight(0xe4f6ff, 0x4aa3cf, 1.1);
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
    sun.shadow.radius = 5; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    sun.target.position.copy(CENTER);
    // 편지섬 창가의 불: 마지막 장면에서 켜진다
    const lamp = new THREE.PointLight(0xffd9a0, 0, 8);
    lamp.position.set(POST_ISLAND.x - 0.1, 1.7, POST_ISLAND.z + 1.0);
    scene.add(hemi, sun, sun.target, lamp);

    const KEYS = makeKeys(AT);
    const wtex = waterTexture();
    const seaMat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, transparent: true, opacity: 0.9 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), seaMat);
    sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true;
    const world = new THREE.Group(); scene.add(world, sea);

    // 이야기를 마친 세계: 네 섬은 땅이 넓어지고 다리로 이어져 있다(지도와 같은 모습)
    const isl = ISLANDS.map((s, k) => {
      const g = buildIsland({ x: s.x, z: s.z, roof: k === 0 ? "#e8553a" : "#5ec9a7", arch: k === 0, home: k === 0, style: k, grade: k > 0 });
      world.add(g);
      if (k > 0) { const ex = makeExtras(); ex.position.set(s.x, 0, s.z); world.add(ex); }
      if (k < ISLANDS.length - 1) world.add(makeBridge(s, ISLANDS[k + 1]).group);
      return g;
    });
    const me = makePostman();                                // 내가 서 있는 곳: 4번째 섬 위
    me.position.copy(ME_POS); world.add(me);
    const post = buildIsland({ x: POST_ISLAND.x, z: POST_ISLAND.z, style: "post", stop: -1 });
    world.add(post);
    const postBridge = makeBridge(ISLANDS[4], POST_ISLAND);
    postBridge.items.forEach((m) => m.scale.setScalar(0.001)); world.add(postBridge.group);
    const postEnv = makeEnvelope(); postEnv.scale.setScalar(0.001); world.add(postEnv);      // 편지섬 위에 떠서 도는 봉투

    const boats = [["#e8553a", 0.1], ["#5aa3d4", 0.6]].map(([c, ph]) => { const b = boat(c); world.add(b); return { b, ph }; });
    const pm = makePostman({ elder: true }); pm.position.copy(HOME_POST); world.add(pm);      // 해무
    // 해무가 이십 년 동안 부치지 못한 편지: 누렇게 바랜 봉투
    const old = makeEnvelope();
    old.traverse((o) => {
      if (!o.material?.color) return;
      o.material = o.material.clone();                       // 다른 편지 봉투와 재질을 나눠 쓰지 않는다
      o.material.color.lerp(new THREE.Color("#d9b85a"), 0.65);
    });
    old.scale.setScalar(0.001); world.add(old);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    const orbit = (A) => {                                    // 해무 곁을 도는 편지의 자리
      const a = A * 0.28;                                  // 천천히 한 바퀴를 돈다(예전엔 너무 빨랐다)
      return new THREE.Vector3(HAEMU_POS.x + Math.cos(a) * 1.1, HAEMU_POS.y + 0.7 + Math.sin(A * 1.1) * 0.08, HAEMU_POS.z + Math.sin(a) * 1.1);
    };
    const chest = new THREE.Vector3(HAEMU_POS.x + 0.2, HAEMU_POS.y + 0.25, HAEMU_POS.z + 0.1);
    const bag = new THREE.Vector3(ME_POS.x - 0.2, ME_POS.y + 0.3, ME_POS.z);       // 내 가방 위치(편지가 올라오는 곳)
    const yawTo = (a, b) => Math.atan2(-(b.z - a.z), b.x - a.x);                   // a에서 b를 바라보는 방향(우체부는 +x를 보고 날아간다)
    const tmp = new THREE.Vector3(), look = new THREE.Vector3(), tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), fp = new THREE.Vector3();
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    let camInit = false, raf, last = performance.now(), A = 0, lastIdx = -2, lastZoom = false;

    const frame = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);   // 첫 프레임의 시각이 시계보다 앞서도 음수가 되지 않게 last = now;
      A += dt;
      timeRef.current += dt * PLAYBACK;
      const T = timeRef.current;

      // 카메라: 키프레임 사이를 부드럽게 이동한다. 편지 쓰는 동안에는 살짝 흔들려 살아 있는 화면처럼 보인다.
      let i = 0; while (i < KEYS.length - 2 && T >= KEYS[i + 1][0]) i++;
      const [t0, p0, l0] = KEYS[i], [t1, p1, l1] = KEYS[i + 1];
      const u = smooth((T - t0) / (t1 - t0));
      tPos.set(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u));
      tLook.set(lerp(l0[0], l1[0], u), lerp(l0[1], l1[1], u), lerp(l0[2], l1[2], u));
      if (T >= AT.arriveT) { const sw = smooth((T - AT.arriveT) / 3); tPos.x += Math.sin(A * 0.5) * 0.25 * sw; tPos.y += Math.sin(A * 0.7) * 0.08 * sw; tPos.z += Math.cos(A * 0.45) * 0.2 * sw; }
      // 해무가 날아오는 동안에는 그를 뒤쪽 위에서 따라간다(키프레임과 부드럽게 섞는다)
      const fw = smooth((T - AT.flightFrom) / 1.0) * (1 - smooth((T - (AT.flightTo - 0.5)) / 1.0));
      if (fw > 0) {
        FLIGHT.getPoint(smooth((T - AT.flightFrom) / (AT.flightTo - AT.flightFrom)), fp);
        tPos.lerp(tmp.set(fp.x + 4.8, fp.y + 2.4, fp.z + 5.2), fw);
        tLook.lerp(fp, fw);
      }
      if (!camInit) { camPos.copy(tPos); camLook.copy(tLook); camInit = true; }
      const kf = 1 - Math.exp(-dt * 8);
      camPos.lerp(tPos, kf); camLook.lerp(tLook, kf);
      cam.position.copy(camPos); look.copy(camLook); cam.lookAt(look);

      // 빛과 하늘: 새벽의 금빛에서 환한 아침으로
      const d = 1 - smooth(T / 26);
      scene.background.copy(DAY.sky).lerp(DAWN.sky, d); scene.fog.color.copy(scene.background);
      hemi.color.copy(DAY.hemiSky).lerp(DAWN.hemiSky, d); hemi.groundColor.copy(DAY.hemiGround).lerp(DAWN.hemiGround, d);
      sun.color.copy(DAY.sun).lerp(DAWN.sun, d);
      sun.position.set(CENTER.x - 5, lerp(18, 10, d), CENTER.z + 9);
      lamp.intensity = 3.2 * smooth((T - AT.lampT) / 4);
      seaMat.color.setRGB(1, lerp(1, 0.92, d), lerp(1, 0.9, d));
      wtex.offset.set(A * 0.02, A * 0.012);

      isl.forEach((g, k) => { g.position.y = Math.sin(A * 1.3 + k * 1.7) * 0.05; const f = g.getObjectByName("foam"); if (f) f.scale.setScalar(1 + Math.sin(A * 1.6 + k) * 0.05); });
      post.position.y = Math.sin(A * 1.3 + 8.5) * 0.05;
      const pf = post.getObjectByName("foam"); if (pf) pf.scale.setScalar(1 + Math.sin(A * 1.6 + 5) * 0.05);
      postBridge.items.forEach((m, j) => m.scale.setScalar(Math.max(0.001, backOut((T - AT.bridgeT - j * 0.07) / 0.5))));
      const pe = backOut((T - AT.bridgeT) / 1.2);
      postEnv.scale.setScalar(Math.max(0.001, pe * 1.8)); postEnv.position.set(POST_ISLAND.x - 0.15, 2.9 + Math.sin(A * 2) * 0.14, POST_ISLAND.z - 0.1); postEnv.rotation.y = A * 1.2;

      // 나: 4번째 섬 위에 떠서 해무가 오는 쪽을 바라본다. 해무가 내려앉은 뒤에는 그를 바라본다.
      if (T < AT.landFrom) {
        me.position.set(ME_POS.x, ME_POS.y + Math.sin(A * 2 + 1) * 0.1, ME_POS.z);
        me.rotation.set(0, yawTo(ME_POS, HAEMU_POS), 0);
        animatePostman(me, A);
      } else {                                                    // 편지섬으로 날아가 우체국 앞에 내려앉는다
        const lu = smooth((T - AT.landFrom) / (AT.landTo - AT.landFrom));
        LANDING.getPoint(lu, fp); me.position.copy(fp);
        const tg = LANDING.getTangent(Math.min(lu, 0.97));
        const yaw = Math.atan2(-tg.z, tg.x), settle = smooth((lu - 0.9) / 0.1);
        me.rotation.set(0, lerp(yaw, yawTo(LAND_POS, POST_ISLAND), settle), 0);
        animatePostman(me, A, lerp(0.9, 0.2, settle));
      }

      // 해무: 처음에는 집 앞에 떠 있다가 바람길을 따라 날아와 내 곁에 내려앉는다. 도착하면 나를 마주 본다.
      const fu = smooth((T - AT.flightFrom) / (AT.flightTo - AT.flightFrom));
      FLIGHT.getPoint(fu, fp);
      pm.position.set(fp.x, fp.y + Math.sin(A * 2) * 0.1, fp.z);
      if (T < AT.flightFrom) pm.rotation.set(0, 0.5, 0);
      else {
        const yaw = Math.atan2(-FLIGHT.getTangent(Math.min(fu, 0.98)).z, FLIGHT.getTangent(Math.min(fu, 0.98)).x);
        pm.rotation.set(0, lerp(yaw, yawTo(HAEMU_POS, ME_POS), smooth((fu - 0.85) / 0.15)), 0);
      }
      animatePostman(pm, A, T >= AT.flightFrom && T < AT.flightTo ? 0.9 : 0.6);

      // 이십 년 묵은 편지: 내 가방 맨 밑 주머니에서 올라와 해무에게 건너가 곁을 돌다가, 마음을 정하면 품에 들어간다
      if (T < AT.envT) old.scale.setScalar(0.001);
      else if (T < AT.tuckT) {
        const q = smooth((T - AT.envT) / 2.5);
        tmp.copy(bag).lerp(orbit(A), q); tmp.y += Math.sin(q * Math.PI) * 1.1;
        old.position.copy(tmp); old.rotation.set(0, A * 0.45, Math.sin(A * 0.9) * 0.08);
        old.scale.setScalar(Math.max(0.001, backOut((T - AT.envT) / 1.2) * 1.25));
      } else {
        const q = smooth((T - AT.tuckT) / 1.4);
        tmp.copy(orbit(A)).lerp(chest, q); old.position.copy(tmp); old.rotation.set(0, A * 0.45 * (1 - q), 0);
        old.scale.setScalar(Math.max(0.001, 1.25 * (1 - q)));
      }

      boats.forEach(({ b, ph }) => {
        const a = (A / 26 + ph) * Math.PI * 2;
        b.position.set(CENTER.x + Math.cos(a) * 13, Math.sin(A * 2 + ph * 9) * 0.04 + 0.05, CENTER.z + Math.sin(a) * 11.5);
        b.rotation.y = -Math.atan2(Math.cos(a) * 11.5, -Math.sin(a) * 13);
      });

      renderer.render(scene, cam);

      let ci = -1;
      capsRef.current.forEach((c, n) => { if (T >= c.t && T < c.end) ci = n; });
      if (ci !== lastIdx) { lastIdx = ci; setIdx(ci); }
      const z = T >= AT.zoomT; if (z !== lastZoom) { lastZoom = z; zoomedRef.current = z; setZoomed(z); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const key = (e) => {
      if (zoomedRef.current || e.target.tagName === "BUTTON") return;                  // 편지를 쓰는 동안에는 키를 가로채지 않는다
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight") { e.preventDefault(); advance(); }
      else if (e.code === "ArrowLeft" || e.code === "Backspace") { e.preventDefault(); back(); }
    };
    addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("keydown", key);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); wtex.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // WebGL을 쓸 수 없으면 영상 없이 바로 편지 쓰기로
  useEffect(() => { if (fail) { zoomedRef.current = true; setZoomed(true); } }, [fail]);

  const cap = capsRef.current[idx];
  return (
    <div className={`intro epi ${zoomed ? "zoomed" : ""}`} ref={wrap} onPointerDown={zoomed ? undefined : advance}>
      {!zoomed && (
        <>
          <div className="letterbox top" /><div className="letterbox bottom" />
          <button className="pill intro-back" onPointerDown={(e) => e.stopPropagation()} onClick={back}>‹ 이전</button>
          <button className="pill intro-skip" onPointerDown={(e) => e.stopPropagation()} onClick={skipToWrite}>건너뛰고 편지 쓰기</button>
          {cap && (cap.who
            ? <div key={idx} className="intro-cap say fade" aria-live="polite"><span className="who">우체부 {cap.who}</span><p>{sentences(cap.text).map((x, i) => <span key={i} className="cap-s">{x}</span>)}</p></div>
            : <p key={idx} className="intro-cap narr fade" aria-live="polite">{sentences(cap.text).map((x, i) => <span key={i} className="cap-s">{x}</span>)}</p>)}
          <p className="intro-hint">화면을 누르면 다음 장면 · ← 키로 이전 장면</p>
        </>
      )}
      {zoomed && (
        <div className="epi-write">
          <WriteScreen myName={nickname} orbsTotal={orbsTotal} onSubmit={onSubmit} onBack={onBack} />
        </div>
      )}
    </div>
  );
}
