import React, { useEffect, useRef, useState } from "react";
import { W, H } from "../game/constants.js";
import { createFlight, stepFlight, computeGrade, orbsCollected } from "../game/engine.js";
import { drawFlight } from "../game/render.js";
import { warmSprites } from "../game/sprites3d.js";
import { audioStart, audioStop, audioUpdate, fx } from "../game/audio.js";
import Icon from "./Icon.jsx";
import { VolumeControls } from "./VolumePanel.jsx";
import { touchAction } from "../touchControl.js";

// 비행 단계: 높이를 위·가운데·아래 세 줄 중에서 한 줄씩 옮겨 날아간다.
// 키보드 ↑↓(W/S, 스페이스는 위로) · 화면 위/아래 탭 · 위/아래 스와이프 · 화면 오른쪽의 ▲▼ 버튼.
export default function FlightScreen({ letter, practice = false, tutorialSeen, onTutorialSeen, onFinish, onExit }) {
  const canvasRef = useRef(null);
  const movesRef = useRef([]);          // 줄 옮기기 입력 대기열(+1 위, -1 아래)
  const pausedRef = useRef(false);
  const startRef = useRef(null);        // 포인터를 누른 위치(스와이프 판별)
  const braceRef = useRef(0);           // 비바람 버티기: Enter(또는 버튼)를 누른 횟수
  const [braceOn, setBraceOn] = useState(false);   // 비바람 버티기 중인가(이때 왼쪽 아래에 큰 버튼이 나온다)
  const touch = useRef(typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches).current;
  const [zones, setZones] = useState(true);   // 처음 몇 초 동안 위·아래 터치 영역을 옅게 보여 준다
  useEffect(() => { const t = setTimeout(() => setZones(false), 7000); return () => clearTimeout(t); }, []);
  const [paused, setPaused] = useState(false);

  const setPause = (v) => { pausedRef.current = v; movesRef.current.length = 0; braceRef.current = 0; setPaused(v); };
  const move = (d) => { if (!pausedRef.current) movesRef.current.push(d); };

  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d");
    // 화면 비율에 맞춰 논리 폭을 늘린다(높이 600 고정). 양옆 여백 없이 전체 화면에 하늘과 바다가 그려진다.
    const fit = () => {
      const vw = innerWidth, vh = innerHeight, aspect = vw / vh;
      const lw = Math.min(1500, Math.max(W, Math.round(H * aspect)));
      if (cvs.width !== lw) cvs.width = lw;
      const la = lw / H;
      cvs.style.width = (aspect > la ? vh * la : vw) + "px";
      cvs.style.height = (aspect > la ? vh : vw / la) + "px";
    };
    fit();
    addEventListener("resize", fit);
    try { warmSprites(); } catch { /* WebGL이 없으면 2D 그림으로 */ }
    const F = createFlight(letter, tutorialSeen, practice); F.touch = touch;
    let raf, last = performance.now(), seenMarked = false, braceShown = false;
    audioStart();

    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        F.viewW = cvs.width;
        while (movesRef.current.length) F.moves.push(movesRef.current.shift());
        F.braceTaps += braceRef.current; braceRef.current = 0;
        if (F.brace.on !== braceShown) { braceShown = F.brace.on; setBraceOn(braceShown); }
        stepFlight(F, dt, fx);
        audioUpdate(F.thrust);
        if (!seenMarked && F.mode === "fly" && !practice) { seenMarked = true; onTutorialSeen(); }
        if (F.finished) {
          audioStop();
          onFinish({ grade: computeGrade(F.fails, F.totalHits), orbs: orbsCollected(F) });
          return;
        }
      }
      drawFlight(ctx, F);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const down = (e) => {
      if (e.repeat) return;
      if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") { move(1); e.preventDefault(); }
      else if (e.code === "ArrowDown" || e.code === "KeyS") { move(-1); e.preventDefault(); }
      else if (e.code === "Enter" || e.code === "NumpadEnter") { if (!pausedRef.current) braceRef.current++; e.preventDefault(); }   // 비바람 버티기
      else if (e.code === "Escape") setPause(!pausedRef.current);
    };
    const blur = () => setPause(true);
    addEventListener("keydown", down);
    addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(raf);
      audioStop();
      removeEventListener("resize", fit);
      removeEventListener("keydown", down);
      removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);

  // 화면 조작(터치·마우스): 위·아래로 40px 넘게 쓸면 그 방향으로 한 줄. 가볍게 누르면 화면 위쪽 절반은 위로, 아래쪽 절반은 아래로.
  // 비바람 버티기는 왼쪽 아래의 큰 "버티기" 버튼을 연타한다(Enter 키도 된다).
  const onDown = (e) => { if (e.button === 0) { startRef.current = { y: e.clientY }; audioStart(); } };
  const onUp = (e) => {
    const s = startRef.current; startRef.current = null;
    if (!s || pausedRef.current) return;
    move(touchAction(e.clientY - s.y, e.clientY / innerHeight).dir);
  };
  const stop = (e) => e.stopPropagation();

  return (
    <div className="stage" onPointerDown={onDown} onPointerUp={onUp} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} width={W} height={H} />
      {braceOn && <button className="brace-btn" onPointerDown={(e) => { stop(e); braceRef.current++; }} onPointerUp={stop} aria-label="버티기">{touch ? "연타!" : "버티기"}<small>{touch ? "버티기" : "Enter"}</small></button>}
      {zones && !paused && (
        <div className="zones" aria-hidden="true"><span className="zone up"><Icon name="up" size={30} />{touch ? "여기를 누르면 위로" : "위쪽을 누르면 위로"}</span><span className="zone down"><Icon name="down" size={30} />{touch ? "여기를 누르면 아래로" : "아래쪽을 누르면 아래로"}</span></div>
      )}
      {!paused && (
        <div className="udbtns">
          <button onPointerDown={(e) => { stop(e); audioStart(); if (!pausedRef.current) move(1); }} onPointerUp={stop} aria-label="위로"><Icon name="up" size={30} /></button>
          <button onPointerDown={(e) => { stop(e); audioStart(); if (!pausedRef.current) move(-1); }} onPointerUp={stop} aria-label="아래로"><Icon name="down" size={30} /></button>
        </div>
      )}
      <button className="pause-btn" onPointerDown={stop} onPointerUp={stop} onClick={() => setPause(true)} aria-label="일시정지">Ⅱ</button>
      {paused && (
        <div className="overlay" onPointerDown={stop} onPointerUp={stop}>
          <div className="panel">
            <h2>잠시 멈춤</h2>
            <VolumeControls />
            <button className="btn" onClick={() => setPause(false)}>이어서 날기</button>
            {practice && <button className="btn ghost" onClick={() => onFinish({ skipped: true })}>연습 마치고 진짜 편지로</button>}
            <button className="btn ghost" onClick={onExit}>지도로 돌아가기</button>
          </div>
        </div>
      )}
    </div>
  );
}
