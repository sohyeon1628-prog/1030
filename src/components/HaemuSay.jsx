import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { makePostman, animatePostman } from "../three/parts.js";

// 해무가 말을 전하는 모습: 작은 3D 해무가 날개를 퍼덕이며 떠 있고, 옆의 말풍선에 말이 한 글자씩 나타난다.
// WebGL을 쓸 수 없으면 말풍선만 보인다.
export default function HaemuSay({ text }) {
  const box = useRef(null);
  const [shown, setShown] = useState(0);
  useEffect(() => { setShown(0); const id = setInterval(() => setShown((n) => (n >= text.length ? (clearInterval(id), n) : n + 1)), 28); return () => clearInterval(id); }, [text]);

  useEffect(() => {
    const el = box.current; let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(120, 120, false);
    el.prepend(renderer.domElement); renderer.domElement.className = "hs-canvas";
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(34, 1, 0.1, 50); cam.position.set(0.2, 0.7, 4.3); cam.lookAt(0, 0.35, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8fb3cf, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d8, 2.2); sun.position.set(-3, 5, 5); scene.add(sun);
    const pm = makePostman({ elder: true }); pm.scale.setScalar(1.15); scene.add(pm);
    let raf, t0 = performance.now();
    const frame = (now) => {
      const T = (now - t0) / 1000;
      pm.position.set(Math.sin(T * 0.9) * 0.08, Math.sin(T * 2.2) * 0.1 - 0.15, 0);
      pm.rotation.set(0, -0.5 + Math.sin(T * 0.8) * 0.12, Math.sin(T * 1.6) * 0.03);
      animatePostman(pm, T, 0.7);
      renderer.render(scene, cam); raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); renderer.dispose(); renderer.domElement.remove(); };
  }, []);

  return (
    <div className="haemu-say" role="note" aria-label="우체부 해무의 말">
      <div className="hs-fig" ref={box}><span className="hs-wind" aria-hidden="true"><i /><i /><i /></span></div>
      <div className="hs-bubble">
        <b>우체부 해무</b>
        <p>{text.slice(0, shown)}<span className="hs-ghost">{text.slice(shown)}</span></p>
      </div>
    </div>
  );
}
