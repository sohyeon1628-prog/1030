import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ISLANDS, POST_ISLAND, buildIsland, makeBridge, makePostman, animatePostman, makeFog, waterTexture } from "../three/parts.js";

// 첫 화면(3D): 구름 위를 해무와 내가 날아다니고, 그 아래로 마음의 섬들이 펼쳐져 보인다.
// 아래쪽 버튼을 누르면 로그인(처음 온 사람) 또는 시작(이미 들어온 적 있는 사람)으로 넘어간다. 자동으로 넘어가지 않는다.
export default function SplashScene({ label = "시작하기", onLeave, onDone }) {
  const wrap = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const [fail, setFail] = useState(false);
  const go = () => { if (leaving) return; setLeaving(true); onLeave?.(); setTimeout(onDone, 500); };   // 사라지기 시작할 때 아래에 게임을 먼저 띄워 자연스럽게 이어 준다

  useEffect(() => {
    const el = wrap.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFail(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.prepend(renderer.domElement); renderer.domElement.className = "w3d-canvas";
    const scene = new THREE.Scene();
    const SKY = new THREE.Color("#9fd8ee");
    scene.background = SKY; scene.fog = new THREE.Fog(SKY, 22, 70);
    const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 200); scene.add(cam);
    scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x4aa3cf, 1.15));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.set(-8, 16, 10); scene.add(sun);

    // 바다와 섬들(지도와 같은 섬), 섬 사이의 다리
    const wtex = waterTexture();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2; scene.add(sea);
    const world = new THREE.Group(); scene.add(world);
    ISLANDS.forEach((s, k) => world.add(buildIsland({ x: s.x, z: s.z, style: k, roof: k === 0 ? "#e8553a" : "#d9d2c3", arch: k === 0, home: k === 0, stop: -1 })));
    world.add(buildIsland({ x: POST_ISLAND.x, z: POST_ISLAND.z, style: "post", stop: 99 }));
    for (let i = 0; i < ISLANDS.length - 1; i++) world.add(makeBridge(ISLANDS[i], ISLANDS[i + 1]).group);          // 지도에서 이어진 다리
    world.add(makeBridge(ISLANDS[4], POST_ISLAND).group);

    // 구름: 날아다니는 높이에 떠서 천천히 흐른다(섬 위로 지나가며 아래를 살짝 가린다)
    const clouds = Array.from({ length: 9 }, (_, i) => {                       // 날아다니는 두 사람 뒤쪽과 가장자리에만 둬서, 사람이 구름에 가려 흐려지지 않게 한다
      const c = makeFog(i, 0.42 + (i % 3) * 0.08); c.scale.set(7 + (i % 4) * 2.4, 3.2 + (i % 3), 1);
      c.position.set(-7 + (i * 3.1) % 24, 3.6 + (i % 4) * 0.8, i % 2 ? -5 - (i % 3) * 2 : 0.5 - (i % 3)); scene.add(c); return { c, sp: 0.1 + (i % 5) * 0.03, x0: c.position.x };
    });

    // 해무(초록 모자)와 나(빨간 모자): 서로 다른 큰 고리를 돌며 가끔 가까이 스친다. 날갯짓과 함께 몸을 기울인다.
    const haemu = makePostman({ elder: true }), me = makePostman();
    haemu.scale.setScalar(1.55); me.scale.setScalar(1.55);
    scene.add(haemu, me);
    const trail = (color) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })); l.frustumCulled = false; scene.add(l); return l; };
    const trails = [trail("#ffd166"), trail("#ffffff")];
    const pathOf = (t, who) => {                                                 // 섬들 위를 도는 8자 모양 길. who 0 = 해무, 1 = 나
      const a = t * (who ? 0.42 : 0.33) + (who ? 2.1 : 0);
      return new THREE.Vector3(4.6 + Math.sin(a) * (who ? 6.2 : 7.2), 3.2 + Math.sin(a * 2 + who) * 0.7 + who * 0.4, 7.5 + Math.sin(a * 2) * (who ? 3.4 : 3.0) * (who ? -1 : 1) + Math.cos(a) * 1.2);
    };
    const hist = [[], []];

    const resize = () => { const w = el.clientWidth, h = el.clientHeight || 1; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 0.8 ? 62 : 46; cam.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(el);

    const look = new THREE.Vector3(), tmp = new THREE.Vector3();
    let raf, T0 = performance.now();
    const frame = (now) => {
      const t = (now - T0) / 1000;
      // 카메라: 높은 하늘에서 아래를 내려다보며 천천히 옆으로 흐른다(섬들이 발아래로 펼쳐진다)
      cam.position.set(4.6 + Math.sin(t * 0.12) * 3.2, 9.6 + Math.sin(t * 0.17) * 0.5, 19.5 + Math.cos(t * 0.1) * 1.2);
      look.set(4.4 + Math.sin(t * 0.12) * 1.2, 0.8, 6.6); cam.lookAt(look);
      wtex.offset.set(t * 0.02, t * 0.012);
      clouds.forEach(({ c, sp, x0 }) => { c.position.x = ((x0 + t * sp * 6 + 10) % 24) - 8; });
      [haemu, me].forEach((pm, who) => {
        const p = pathOf(t, who), q = pathOf(t + 0.05, who);
        pm.position.copy(p);
        const yaw = Math.atan2(-(q.z - p.z), q.x - p.x);
        pm.rotation.set(0, yaw, 0); pm.rotateX(Math.sin(t * 1.3 + who) * 0.12);                  // 방향 전환에서 몸이 살짝 기운다
        animatePostman(pm, t + who * 0.7, 0.9);
        const h = hist[who]; h.unshift(p.clone().add(tmp.set(-0.3, 0.1, 0))); if (h.length > 40) h.pop();   // 꼬리 궤적
        const pos = trails[who].geometry.attributes.position; for (let i = 0; i < 40; i++) { const v = h[Math.min(i, h.length - 1)] || p; pos.setXYZ(i, v.x, v.y, v.z); } pos.needsUpdate = true;
        trails[who].material.opacity = 0.5;
      });
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); wtex.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return (
    <div className={`splash3d ${leaving ? "leave" : ""} ${fail ? "nogl" : ""}`} ref={wrap}>
      <div className="splash3d-veil" aria-hidden="true" />
      <header className="splash3d-title">
        <h1>나루 우체국</h1>
        <p>편지가 오가는 동안에만 열리는 바람길</p>
      </header>
      <button className="splash3d-btn" onClick={go} autoFocus>{label}</button>
    </div>
  );
}
