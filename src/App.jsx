import React, { useState, useCallback, useMemo, useEffect } from "react";
import World3D from "./components/World3D.jsx";
import FlightScreen from "./components/FlightScreen.jsx";
import StoryScreen from "./components/StoryScreen.jsx";
import Intro3D from "./components/Intro3D.jsx";
import WriteScreen from "./components/WriteScreen.jsx";
import MailboxScreen from "./components/MailboxScreen.jsx";
import NoteScreen from "./components/NoteScreen.jsx";
import HowToScreen from "./components/HowToScreen.jsx";
import SetupScreen from "./components/SetupScreen.jsx";
import NicknameScreen from "./components/NicknameScreen.jsx";
import Icon from "./components/Icon.jsx";
import ShareBox from "./components/ShareBox.jsx";
import { createLetter, letterUrl } from "./api.js";
import { GRADE_NAME } from "./data/letters.js";
import { DEFAULT_PROFILE, buildLetters, buildEpilogue } from "./data/profile.js";
import { FLIGHT_BY_GAP, FLIGHT_COMMON, DELAYS, pickReply } from "./data/story.js";
import { loadState, saveState, recordDelivery, addMine } from "./storage.js";
import { setMuted } from "./game/audio.js";
import { saveVoice, deleteVoice } from "./party/audio.js";
import { fmtWhen } from "./party/config.js";

// 나의 이야기 → 3D 오프닝 → 지도 → [편지 읽기] → 비행 조작 → [도착] → (에필로그) → 내 편지 쓰기 · 편지함
// 바다 지도는 비행 화면을 뺀 모든 화면의 전체 배경이다.
export default function App() {
  const [state, setState] = useState(() => {
    const s = loadState();
    setMuted(s.muted);
    return s;
  });
  const home = !(state.setupDone || state.storySeen) ? "intro" : state.storySeen ? "map" : "intro";
  const [screen, setScreen] = useState(state.nickname ? home : "nickname");   // 닉네임이 없으면 먼저 정한다
  const [nickFrom, setNickFrom] = useState(null);   // 이야기 노트에서 닉네임을 바꾸러 왔는가
  const [howto, setHowto] = useState(state.storySeen && !state.howtoSeen);   // 처음 온 사람에게 자동으로 안내
  const [letter, setLetter] = useState(null);
  const [grade, setGrade] = useState(null);
  const [epilogue, setEpilogue] = useState(false);   // 방금 마지막 편지(l4)를 처음 배달했는가
  const [share, setShare] = useState(null);       // 링크로 보낸 편지의 업로드 결과 { status, url }
  const [orbsGot, setOrbsGot] = useState(0);     // 방금 비행에서 모은 기억 구슬
  const [due, setDue] = useState(null);          // 파티 편지가 막 도착했을 때 알림 { id, to }
  const [focusId, setFocusId] = useState(null);   // 편지함이 열자마자 파티를 보여 줄 편지
  const [practice, setPractice] = useState(false);   // 지금 하는 비행이 연습인가
  const [run, setRun] = useState(0);                 // 비행 시작마다 증가 → 비행 화면 새로 시작

  const update = useCallback((fn) => setState((prev) => { const next = fn(prev); saveState(next); return next; }), []);
  const [editing, setEditing] = useState(false);   // 이야기 노트에서 나의 이야기를 고치는 중인가
  // 나의 이야기(프로필) → 편지 네 통. 예시 구성이 기본값이라 그대로 시작해도 된다.
  const profile = useMemo(() => state.profile ?? { ...DEFAULT_PROFILE, name: state.nickname || "" }, [state.profile, state.nickname]);
  const letters = useMemo(() => buildLetters(profile), [profile]);
  // 처음 날 때(아직 이야기 편지를 하나도 전하지 못했고 연습도 안 했을 때)는 연습 비행부터 시작한다
  const firstTime = !state.practiceDone && Object.keys(state.grade).length === 0;
  // 닉네임: 로그인이 생기기 전까지 쓰는 이름. 바꾸면 나의 이야기의 "나" 이름도 같이 바뀐다.
  const submitNick = (n) => {
    update((s) => ({ ...s, nickname: n, profile: s.profile ? { ...s.profile, name: n } : s.profile }));
    if (nickFrom) { setNickFrom(null); setScreen("note"); } else setScreen(home);
  };
  // 테스트용 초기화: 저장된 진행(이야기·편지함·녹음·닉네임)을 모두 지우고 처음 상태로 다시 연다.
  const resetAll = () => {
    if (!window.confirm("저장된 진행을 모두 지우고 처음부터 시작할까요? 편지함과 녹음도 함께 지워져요.")) return;
    try { Object.keys(localStorage).filter((k) => k.startsWith("last-postal-wing") || k.startsWith("wing-voice:")).forEach((k) => localStorage.removeItem(k)); } catch { /* 저장소 사용 불가 */ }
    location.replace("/");
  };
  const fly = () => { setPractice(firstTime); setRun((r) => r + 1); setScreen("flight"); };
  const startPractice = () => { setPractice(true); setRun((r) => r + 1); setScreen("flight"); };
  const finishPractice = () => { update((s) => ({ ...s, practiceDone: true, tutorialSeen: true })); setPractice(false); setScreen("practiceEnd"); };
  const open = (l) => { setLetter(l); setScreen("read"); };
  const closeHowto = () => { setHowto(false); update((s) => ({ ...s, howtoSeen: true })); };

  // 링크로 보낼 편지를 서버에 올린다. 성공하면 편지함 항목에 링크 정보(id, 회수용 secret)를 붙인다.
  const upload = (entry) =>
    createLetter({ from: entry.fromName, to: entry.to, body: entry.body, paper: entry.paper, grade: entry.grade, gap: entry.gap, expireDays: entry.expireDays })
      .then((r) => {
        update((s) => ({ ...s, mine: s.mine.map((m) => (m.id === entry.id ? { ...m, share: { id: r.id, secret: r.secret, expiresAt: r.expiresAt } } : m)) }));
        return { status: "done", url: letterUrl(r.id) };
      })
      .catch((e) => ({ status: "error", code: e.status, entry }));
  const patchMine = (id, patch) => update((s) => ({ ...s, mine: s.mine.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

  const finish = ({ grade: g, orbs = 0 }) => {
    setOrbsGot(orbs);
    if (letter.custom) {
      const now = Date.now();
      const entry = {
        id: letter.id, to: letter.to, body: letter.body.join("\n"), paper: letter.paper, gap: letter.gap,
        createdAt: now, openAt: letter.mode === "link" ? now : now + letter.delay, grade: g, reply: letter.reply,
        mode: letter.mode || "future", fromName: letter.fromName, expireDays: letter.expireDays,
      };
      if (letter.mode === "party") {
        entry.openAt = now + letter.delay; entry.party = letter.party; entry.hasVoice = !!letter.voice;
        if (letter.voice && !saveVoice(entry.id, letter.voice.url)) entry.hasVoice = false;   // 저장 공간이 모자라면 기본 노래로
      }
      update((s) => ({ ...addMine(s, entry), orbExtra: (s.orbExtra || 0) + orbs }));
      if (letter.mode === "link") { setShare({ status: "sending" }); upload(entry).then(setShare); }
    } else {
      setEpilogue(letter.id === "l4" && !state.delivered.l4);
      update((s) => ({ ...recordDelivery(s, letter.id, g), orbs: { ...s.orbs, [letter.id]: Math.max(s.orbs?.[letter.id] || 0, orbs) } }));
    }
    setGrade(g);
    setScreen("arrive");
  };

  const submitMine = ({ mode, fromName, expireDays, to, gap, paper, delay, body, party, voice }) => {
    const id = `m${Date.now()}`;
    if (mode === "party" && "Notification" in window && Notification.permission === "default") Notification.requestPermission();   // 도착 알림
    setLetter({
      id, custom: true, mode, party, voice, fromName, expireDays, from: "나", to, title: `${to}에게`, gap, paper, delay,
      body: body.split("\n"), reply: pickReply(gap, id),
      flight: { ...FLIGHT_BY_GAP[gap], ...FLIGHT_COMMON },
    });
    fly();
  };

  // 파티 편지 도착 확인: 열려 있는 동안 5초마다 본다(앱 푸시는 아직 없고 브라우저 알림만)
  useEffect(() => {
    const check = () => {
      const m = state.mine.find((x) => x.mode === "party" && !x.notified && Date.now() >= x.openAt);
      if (!m) return;
      patchMine(m.id, { notified: true }); setDue({ id: m.id, to: m.to });
      try { if ("Notification" in window && Notification.permission === "granted") new Notification("파티 편지가 도착했어요", { body: `${m.to}에게 쓴 편지의 파티가 열렸어요.` }); } catch { /* 알림 불가 */ }
    };
    check(); const t = setInterval(check, 5000); return () => clearInterval(t);
  }, [state.mine]);   // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => { setMuted(!state.muted); update((s) => ({ ...s, muted: !s.muted })); };
  const isUnlocked = (i) => i === 0 || !!state.grade[letters[i - 1].id];
  const storyDone = !!state.delivered.l4;
  const orbsTotal = Object.values(state.orbs || {}).reduce((a, b) => a + b, 0) + (state.orbExtra || 0);   // 모은 기억 구슬 전부
  const pathCount = Object.keys(state.grade).length + state.mine.length;
  const idx = letter ? letters.findIndex((l) => l.id === letter.id) : -1;
  const next = idx >= 0 ? letters[idx + 1] : null;

  // 3D 오프닝: 세계관과 해무의 마지막 근무일을 보여 준다. 끝나면(또는 건너뛰면) 지도와 도움말로.
  if (screen === "intro") {
    return (
      <div className="app">
        {/* 처음에는 해무가 묻고 내가 답하는 대화형 오프닝, 다시 볼 때는 정해 둔 이야기로 재생 */}
        <Intro3D
          interactive={!(state.setupDone || state.storySeen)}
          profile={profile}
          nickname={state.nickname}
          onDone={(pr) => { update((s) => ({ ...s, profile: pr || s.profile, setupDone: true, storySeen: true })); setHowto(!state.howtoSeen); setScreen("map"); }}
        />
      </div>
    );
  }

  if (screen === "flight" && letter) {
    return (
      <div className="app">
        <FlightScreen
          key={run}
          letter={letter}
          practice={practice}
          tutorialSeen={state.tutorialSeen}
          onTutorialSeen={() => update((s) => ({ ...s, tutorialSeen: true }))}
          onFinish={practice ? finishPractice : finish}
          onExit={() => setScreen("map")}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <div className={`bg ${screen === "map" ? "" : "dim"}`}>
        <World3D letters={letters} grades={state.grade} isUnlocked={isUnlocked} onOpen={open} interactive={screen === "map" && !howto} />
      </div>

      {screen === "setup" && (
        <SetupScreen
          initial={profile}
          editing={editing}
          lockedCount={editing ? letters.filter((l) => state.grade[l.id]).length : 0}
          onBack={editing ? () => { setEditing(false); setScreen("note"); } : undefined}
          onSubmit={(pr) => {
            update((s) => ({ ...s, profile: pr, setupDone: true }));
            if (editing) { setEditing(false); setScreen("note"); } else setScreen("intro");
          }}
        />
      )}

      {screen === "nickname" && <NicknameScreen initial={state.nickname} onSubmit={submitNick} onBack={nickFrom ? () => { setNickFrom(null); setScreen("note"); } : undefined} onReset={nickFrom ? undefined : resetAll} />}

      {screen === "practiceEnd" && letter && (
        <main className="screen center">
          <article className="paper">
            <h2>연습 끝!</h2>
            <p>줄 옮기기, 구슬과 아이템, 위험이 닥치는 자리를 모두 만나 봤어요. 진짜 편지에서는 하트가 다 닳면 가까운 체크포인트에서 다시 시작해요.</p>
          </article>
          <div className="row">
            <button className="btn" onClick={() => { setPractice(false); setRun((r) => r + 1); setScreen("flight"); }}>진짜 편지 날리기</button>
            <button className="btn ghost" onClick={startPractice}>한 번 더 연습</button>
          </div>
        </main>
      )}

      {screen === "epilogue" && <StoryScreen lines={buildEpilogue(profile)} doneLabel="지도로" onDone={() => setScreen("map")} />}

      {screen === "map" && (
        <main className="screen map-ui">
          <header>
            <button className="icon-btn left" onClick={() => setHowto(true)} aria-label="도움말" title="도움말"><Icon name="help" size={22} /></button>
            <h1>나루 우체국</h1>
            {/* 진행도: 글자 대신 이어진 바람길 네 칸 */}
            <div className="progress" role="img" aria-label={`이어진 바람길 ${Math.min(pathCount, 4)} / 4`}>
              {[0, 1, 2, 3].map((k) => <span key={k} className={k < pathCount ? "on" : ""} />)}
            </div>
            <button className="icon-btn right" onClick={toggleMute} aria-label={state.muted ? "소리 켜기" : "소리 끄기"} title={state.muted ? "소리 켜기" : "소리 끄기"}><Icon name={state.muted ? "mute" : "sound"} size={22} /></button>
          </header>
          <div className="row dock">
            <button className={`dock-btn primary ${storyDone ? "glow" : ""}`} disabled={!storyDone} onClick={() => setScreen("write")} aria-label={storyDone ? "내 편지 쓰기" : "내 편지 쓰기 (네 통을 전하면 열려요)"} title="내 편지 쓰기">
              <Icon name="pen" size={26} />{!storyDone && <span className="dock-lock"><Icon name="lock" size={13} /></span>}
            </button>
            <button className="dock-btn" onClick={() => setScreen("mailbox")} aria-label={`편지함${state.mine.length ? ` ${state.mine.length}통` : ""}`} title="편지함">
              <Icon name="mail" size={26} />{state.mine.length > 0 && <span className="dock-badge">{state.mine.length}</span>}
            </button>
            <button className="dock-btn" onClick={() => setScreen("note")} aria-label="이야기 노트" title="이야기 노트"><Icon name="book" size={26} /></button>
          </div>
        </main>
      )}

      {screen === "write" && <WriteScreen myName={profile.name} orbsTotal={orbsTotal} onSubmit={submitMine} onBack={() => setScreen("map")} />}
      {screen === "mailbox" && <MailboxScreen focusId={focusId} onDeleteVoice={(m) => { deleteVoice(m.id); patchMine(m.id, { hasVoice: false }); }} onRetry={(m) => upload(m).then((r) => { if (r.status === "error") window.alert("아직 서버에 닿지 못했어요."); })} onPatch={patchMine} orbsTotal={orbsTotal} mine={state.mine} grades={state.grade} onBack={() => { setFocusId(null); setScreen("map"); }} />}
      {screen === "note" && <NoteScreen nickname={state.nickname} onNick={() => { setNickFrom(true); setScreen("nickname"); }} onReset={resetAll} letters={letters} grades={state.grade} isUnlocked={isUnlocked} onBack={() => setScreen("map")} onReplay={() => setScreen("intro")} onEdit={() => { setEditing(true); setScreen("setup"); }} />}

      {screen === "read" && letter && (
        <main className="screen center">
          <p className="chapter">{letter.chapter}장 · {letter.people}</p>
          <aside className="recap">
            <b>이야기 배경</b>
            <p>{letter.context}</p>
            {idx > 0 && <p className="prev"><b>지난 이야기</b> {letters[idx - 1].reply}</p>}
          </aside>
          <p className="memo">우체부 해무: {letter.memo}</p>
          <article className="paper">
            <h2>{letter.title}</h2>
            <div className="route">{letter.from} → {letter.to}</div>
            {letter.body.map((line, i) => <p key={i}>{line}</p>)}
          </article>
          {!state.tutorialSeen && (
            <aside className="recap tip">
              <b>날기 전에</b>
              <p>높이는 세 줄이에요. <strong>↑ ↓ 키나 화면 위·아래 탭, 쓸어 넘기기</strong>로 한 줄씩 옮기세요. 경고가 뜬 줄을 피하고 반짝이는 구슬을 모아 보세요. 부딪혀도 이야기는 끊기지 않아요.</p>
            </aside>
          )}
          <div className="row">
            <button className="btn" onClick={fly}>날아가기</button>
            <button className="btn ghost" onClick={startPractice}>연습 비행</button>
            <button className="btn ghost" onClick={() => setScreen("map")}>돌아가기</button>
          </div>
        </main>
      )}

      {screen === "arrive" && letter && (
        <main className="screen center">
          <article className="paper">
            <div className="route">{letter.from} → {letter.to}</div>
            {/* 서사 편지의 도착 반응은 등급과 무관하게 동일. 내 편지의 답장은 도착 날 편지함에서 열린다 */}
            <p>{letter.custom
              ? (letter.mode === "party" ? `편지가 바람길에 올랐습니다. ${fmtWhen(Date.now() + letter.delay)}, 항구에서 파티가 열려요.` : letter.mode === "link" ? "편지가 바람길에 올랐습니다. 아래 링크를 받는 사람에게 전해 주세요." : `편지가 바람길에 올랐습니다. ${DELAYS.find((d) => d.ms === letter.delay)?.label.replace(" (체험용)", "")} 편지함에 도착합니다.`)
              : letter.reply}</p>
            {!letter.custom && orbsGot >= 3 && letter.memory && <p className="memory">{letter.memory[0]}{orbsGot >= 7 && <> {letter.memory[1]}</>}</p>}
          </article>
          <div className={`grade ${grade}`}>{GRADE_NAME[grade]}</div>
          <div className="orbs-row" role="img" aria-label={`기억 구슬 ${orbsGot} / 9`}>{Array.from({ length: 9 }, (_, k) => <span key={k} className={k < orbsGot ? "on" : ""} />)}</div>
          {letter.custom && letter.mode === "link" && <ShareBox share={share} onRetry={() => { const e = share?.entry; if (!e) return; setShare({ status: "sending" }); upload(e).then(setShare); }} />}
          <p className="sub">
            {letter.custom ? "우표가 한 장 모였습니다." : "바람길이 이어졌습니다. 부표가 사라지고 금빛 바람이 흐릅니다."}
          </p>
          {!letter.custom && next && <p className="sub next">다음 이야기가 열렸어요 — {next.chapter}장 「{next.title}」 ({next.people})</p>}
          <div className="row">
            {epilogue
              ? <button className="btn" onClick={() => { setEpilogue(false); setScreen("epilogue"); }}>이야기의 끝으로</button>
              : <button className="btn" onClick={() => setScreen(letter.custom ? "mailbox" : "map")}>{letter.custom ? "편지함으로" : "지도로"}</button>}
            {!letter.custom && !epilogue && <button className="btn ghost" onClick={fly}>다시 날기</button>}
          </div>
        </main>
      )}

      {due && screen !== "flight" && (
        <button className="toast" onClick={() => { setFocusId(due.id); setDue(null); setScreen("mailbox"); }}>
          <Icon name="party" size={20} />파티 편지가 도착했어요 — {due.to}에게
        </button>
      )}

      {howto && <HowToScreen onClose={closeHowto} />}
    </div>
  );
}
