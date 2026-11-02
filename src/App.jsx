import React, { useState, useCallback, useMemo, useEffect } from "react";
import World3D from "./components/World3D.jsx";
import FlightScreen from "./components/FlightScreen.jsx";
import Epilogue3D from "./components/Epilogue3D.jsx";
import Bottle3D from "./components/Bottle3D.jsx";
import Intro3D from "./components/Intro3D.jsx";
import WriteScreen from "./components/WriteScreen.jsx";
import MailboxScreen from "./components/MailboxScreen.jsx";
import NoteScreen from "./components/NoteScreen.jsx";
import HowToScreen from "./components/HowToScreen.jsx";
import NicknameScreen from "./components/NicknameScreen.jsx";
import ResetScreen from "./components/ResetScreen.jsx";
import AccountScreen from "./components/AccountScreen.jsx";
import ChooseNick from "./components/ChooseNick.jsx";
import { getToken, setToken, getMe, pushState, logout as apiLogout, mergeStates } from "./auth.js";
import Icon from "./components/Icon.jsx";
import HaemuSay from "./components/HaemuSay.jsx";
import ShareBox from "./components/ShareBox.jsx";
import { NAME_TOKEN } from "./components/WriteScreen.jsx";
import { uploadLetters } from "./share.js";
import { GRADE_NAME } from "./data/letters.js";
import { buildLetters } from "./data/chapters.js";
import { FLIGHT_BY_GAP, FLIGHT_COMMON, DELAYS, pickReply } from "./data/story.js";
import { loadState, saveState, recordDelivery, addMine, completeAll, TEST_NICK } from "./storage.js";
import { setMuted } from "./game/audio.js";
import { saveVoice, deleteVoice } from "./party/audio.js";
import { fmtWhen } from "./party/config.js";

// 3D 오프닝(해무 이야기) → 지도 → [편지 읽기] → 비행 조작 → [도착] → (에필로그) → 편지섬(내 편지 쓰기) · 편지함
// 바다 지도는 비행 화면을 뺀 모든 화면의 전체 배경이다.
export default function App() {
  // 주소로 돌아오는 것들: 소셜 로그인 토큰(#social=), 비밀번호 재설정 링크(?pwreset=), 이메일 인증 결과(?emailverified=, ?socialerror=)
  const [entry] = useState(() => {
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#/, ""));
    const out = { pwreset: q.get("pwreset") || "", notice: q.get("emailverified") === "1" ? "이메일 인증이 끝났어요." : q.get("emailverified") === "0" ? "인증 링크가 만료됐거나 이미 썼어요." : q.has("socialerror") ? "소셜 로그인에 실패했어요. 다시 시도해 주세요." : "" };
    const tok = h.get("social");
    if (tok && /^[A-Za-z0-9_-]{20,}$/.test(tok)) { setToken(tok); }
    if (out.pwreset || out.notice || tok || [...q.keys()].some((k) => ["pwreset", "emailverified", "socialerror"].includes(k))) history.replaceState(null, "", location.pathname);
    return out;
  });
  const [notice, setNotice] = useState(entry.notice);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(t); }, [notice]);
  const [state, setState] = useState(() => {
    let s = loadState();
    if (s.nickname === TEST_NICK && !s.delivered.l4) { s = completeAll(s); saveState(s); }   // 테스트 닉네임이면 퀘스트를 모두 완료한 상태로
    setMuted(s.muted);
    return s;
  });
  const home = state.storySeen ? "map" : "intro";
  const [screen, setScreen] = useState(entry.pwreset ? "pwreset" : state.nickname ? home : "nickname");   // 재설정 링크면 새 비밀번호 화면, 닉네임이 없으면 먼저 정한다
  const [nickFrom, setNickFrom] = useState(null);   // 이야기 노트에서 닉네임을 바꾸러 왔는가
  const [account, setAccount] = useState(getToken() ? { nick: "", providers: [] } : null);   // 로그인한 계정(토큰이 있으면 서버에서 확인한다)
  const [sync, setSync] = useState("idle");           // idle | saving | saved | offline
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

  // 이 기기와 서버의 기록을 합쳐 쓴다(로그인 직후, 그리고 앱을 열 때)
  const adoptServer = useCallback((nick, serverState) => {
    setState((prev) => {
      let next = mergeStates({ ...prev, nickname: nick }, serverState ? { ...serverState, nickname: nick } : null);
      next = { ...next, nickname: nick };
      if (nick === TEST_NICK && !next.delivered.l4) next = completeAll(next);
      saveState(next); return next;
    });
  }, []);
  // 앱을 열 때 토큰이 있으면 서버에서 내 기록을 가져온다. 토큰이 만료됐으면 로그아웃 처리한다.
  useEffect(() => {
    if (!getToken()) return;
    getMe().then((r) => { setAccount(r.user); adoptServer(r.user.nick, r.state); const seen = mergeStates(loadState(), r.state || null).storySeen; setScreen((sc) => (r.user.needsNick && sc !== "pwreset" ? "choosenick" : sc === "nickname" ? (seen ? "map" : "intro") : sc)); })   // 소셜로 처음 왔으면 닉네임부터 직접 정한다
      .catch((e) => { if (e.status === 401) { setToken(""); setAccount(null); } else setSync("offline"); });
  }, [adoptServer]);
  // 기록이 바뀌면 잠시 뒤 서버에 보관한다(로그인한 경우에만). 네트워크가 끊겨도 이 기기에는 이미 저장되어 있다.
  useEffect(() => {
    if (!account?.nick || !getToken()) return;   // 로그인한 경우에만
    setSync("saving");
    const t = setTimeout(() => pushState(state).then(() => setSync("saved")).catch((e) => { if (e.status === 401) { setToken(""); setAccount(null); } setSync("offline"); }), 1500);
    return () => clearTimeout(t);
  }, [state, account?.nick]);   // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((fn) => setState((prev) => { const next = fn(prev); saveState(next); return next; }), []);
  // 고정된 이야기의 편지 네 통
  const letters = useMemo(() => buildLetters(), []);
  // 처음 날 때(아직 이야기 편지를 하나도 전하지 못했고 연습도 안 했을 때)는 연습 비행부터 시작한다
  const firstTime = !state.practiceDone && Object.keys(state.grade).length === 0;
  // 닉네임: 로그인이 생기기 전까지 쓰는 이름. 해무가 부르는 이름이자 내 편지의 보내는 사람 이름이다.
  const onAuth = (r) => {
    setToken(r.token); setAccount(r.user); adoptServer(r.user.nick, r.state);
    if (nickFrom) { setNickFrom(null); setScreen("note"); } else setScreen(state.storySeen || r.state?.storySeen ? "map" : "intro");
  };
  const doLogout = async () => {
    if (!window.confirm("로그아웃할까요? 이 기기에 남은 기록은 지우고, 다시 로그인하면 서버의 기록을 불러와요.")) return;
    await apiLogout(); setToken("");
    try { Object.keys(localStorage).filter((k) => k.startsWith("last-postal-wing") || k.startsWith("wing-voice:")).forEach((k) => localStorage.removeItem(k)); } catch { /* 저장소 사용 불가 */ }
    location.replace("/");
  };
  const submitNick = (n) => {
    update((s) => (n === TEST_NICK ? completeAll({ ...s, nickname: n }) : { ...s, nickname: n }));
    if (nickFrom) { setNickFrom(null); setScreen("note"); } else setScreen(home);
  };
  // 테스트용 초기화: 저장된 진행(이야기·편지함·녹음·닉네임)을 모두 지우고 처음 상태로 다시 연다.
  const resetAll = () => {
    if (!window.confirm("저장된 진행을 모두 지우고 처음부터 시작할까요? 편지함과 녹음도 함께 지워져요.")) return;
    try { Object.keys(localStorage).filter((k) => k.startsWith("last-postal-wing") || k.startsWith("wing-voice:") || k === "naru-token").forEach((k) => localStorage.removeItem(k)); } catch { /* 저장소 사용 불가 */ }   // 토큰도 지워서, 서버의 기록이 다시 내려오지 않는다
    location.replace("/");
  };
  const fly = () => { setPractice(firstTime); setRun((r) => r + 1); setScreen("flight"); };
  const startPractice = () => { setPractice(true); setRun((r) => r + 1); setScreen("flight"); };
  const finishPractice = () => { update((s) => ({ ...s, practiceDone: true, tutorialSeen: true })); setPractice(false); setScreen("practiceEnd"); };
  const open = (l) => { setLetter(l); setScreen("read"); };
  const closeHowto = () => { setHowto(false); update((s) => ({ ...s, howtoSeen: true })); };

  // 링크로 보낼 편지를 서버에 올린다(여러 사람이면 한 번에). 성공하면 편지함 항목마다 링크 정보(id, 회수용 secret)를 붙인다.
  // 편지를 올리고(share.js), 성공하면 편지함 항목마다 링크 정보(id, 회수용 secret)를 붙인다.
  const upload = async (entries) => {
    const list = [].concat(entries);
    try {
      const { rs, links } = await uploadLetters(list);
      const byId = Object.fromEntries(list.map((e, i) => [e.id, rs[i]]));
      update((s) => ({ ...s, mine: s.mine.map((m) => (byId[m.id] ? { ...m, share: { id: byId[m.id].id, secret: byId[m.id].secret, expiresAt: byId[m.id].expiresAt } } : m)) }));
      return { status: "done", links };
    } catch (e) {
      return { status: "error", code: e.status, entries: list };
    }
  };
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
      if (letter.mode === "link") {                                // 도착 장면과 녹음(올리기 전까지 기기에 둔다. 여러 명이면 한 사본을 함께 쓴다)
        entry.scene = letter.scene || "island"; entry.voiceKey = entry.id;
        if (letter.voice && saveVoice(entry.id, letter.voice.url)) entry.hasVoice = true;
      }
      if (letter.mode === "party") {
        entry.openAt = now + letter.delay; entry.party = letter.party; entry.hasVoice = !!letter.voice;
        if (letter.voice && !saveVoice(entry.id, letter.voice.url)) entry.hasVoice = false;   // 저장 공간이 모자라면 기본 노래로
      }
      // 링크로 여러 사람에게: 받는 사람마다 편지함 항목을 따로 만든다(읽음 확인·회수를 사람별로). {이름}은 그 사람 이름으로 바꾼다.
      const tos = letter.mode === "link" && letter.tos?.length > 1 ? letter.tos : null;
      const entries = tos ? tos.map((to, i) => ({ ...entry, id: `${entry.id}-${i}`, to, body: entry.body.split(NAME_TOKEN).join(to) })) : [{ ...entry, body: entry.body.split(NAME_TOKEN).join(entry.to) }];
      update((s) => ({ ...entries.reduceRight(addMine, s), orbExtra: (s.orbExtra || 0) + orbs }));
      if (letter.mode === "link") { setShare({ status: "sending" }); upload(entries).then(setShare); }
    } else {
      setEpilogue(letter.id === "l4" && !state.delivered.l4);
      update((s) => ({ ...recordDelivery(s, letter.id, g), orbs: { ...s.orbs, [letter.id]: Math.max(s.orbs?.[letter.id] || 0, orbs) } }));
    }
    setGrade(g);
    setScreen("arrive");
  };

  const submitMine = ({ mode, fromName, expireDays, to, tos, gap, paper, delay, body, party, voice, scene }) => {
    const id = `m${Date.now()}`;
    if (mode === "party" && "Notification" in window && Notification.permission === "default") Notification.requestPermission();   // 도착 알림
    setLetter({
      id, custom: true, mode, party, voice, scene, fromName, expireDays, from: "나", to, tos, title: `${to}에게`, gap, paper, delay,
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
  const idx = letter ? letters.findIndex((l) => l.id === letter.id) : -1;
  const next = idx >= 0 ? letters[idx + 1] : null;

  // 3D 오프닝: 세계관과 해무의 마지막 근무일을 보여 준다. 끝나면(또는 건너뛰면) 지도와 도움말로.
  if (screen === "intro") {
    return (
      <div className="app">
        <Intro3D
          nickname={state.nickname}
          onDone={() => { update((s) => ({ ...s, storySeen: true })); setHowto(!state.howtoSeen); setScreen("map"); }}
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
        <World3D letters={letters} grades={state.grade} isUnlocked={isUnlocked} onOpen={open} postOpen={storyDone} onPost={() => setScreen("write")} interactive={screen === "map" && !howto} />
      </div>

      {screen === "nickname" && <NicknameScreen initial={state.nickname} onGuest={submitNick} onAuth={onAuth} onBack={nickFrom ? () => { setNickFrom(null); setScreen("note"); } : undefined} onReset={nickFrom ? undefined : resetAll} />}

      {screen === "choosenick" && account?.nick && (
        <ChooseNick user={account} onDone={(u) => { setAccount(u); update((s) => ({ ...s, nickname: u.nick })); setScreen(loadState().storySeen ? "map" : "intro"); }} />
      )}
      {screen === "pwreset" && <ResetScreen token={entry.pwreset} onDone={() => { setToken(""); setAccount(null); setScreen("nickname"); }} />}
      {screen === "account" && account?.nick && (
        <AccountScreen user={account} sync={sync} onBack={() => setScreen("note")} onLogout={doLogout}
          onUser={(u) => { setAccount(u); if (u.nick !== state.nickname) update((s) => ({ ...s, nickname: u.nick })); }}
          onDeleted={() => { setToken(""); try { Object.keys(localStorage).filter((k) => k.startsWith("last-postal-wing") || k.startsWith("wing-voice:")).forEach((k) => localStorage.removeItem(k)); } catch { /* 저장소 사용 불가 */ } location.replace("/"); }} />
      )}
      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}</button>}

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

      {screen === "bottle" && <Bottle3D nickname={state.nickname} onDone={() => { update((s) => ({ ...s, bottleSeen: true })); setScreen(state.mine.length ? "mailbox" : "map"); }} />}
      {screen === "epilogue" && <Epilogue3D nickname={state.nickname} orbsTotal={orbsTotal} onSubmit={submitMine} onBack={() => setScreen("map")} />}

      {screen === "map" && (
        <main className="screen map-ui">
          <header>
            <button className="icon-btn left" onClick={() => setHowto(true)} aria-label="도움말" title="도움말"><Icon name="help" size={22} /></button>
            <h1>나루 우체국</h1>
            <button className="icon-btn right" onClick={toggleMute} aria-label={state.muted ? "소리 켜기" : "소리 끄기"} title={state.muted ? "소리 켜기" : "소리 끄기"}><Icon name={state.muted ? "mute" : "sound"} size={22} /></button>
          </header>
          <div className="row dock">
            <button className="dock-btn" onClick={() => setScreen("mailbox")} aria-label={`편지함${state.mine.length ? ` ${state.mine.length}통` : ""}`} title="편지함">
              <Icon name="mail" size={26} />{state.mine.length > 0 && <span className="dock-badge">{state.mine.length}</span>}
            </button>
            <button className="dock-btn" onClick={() => setScreen("note")} aria-label="이야기 노트" title="이야기 노트"><Icon name="book" size={26} /></button>
          </div>
        </main>
      )}

      {screen === "write" && <WriteScreen myName={state.nickname} orbsTotal={orbsTotal} onSubmit={submitMine} onBack={() => setScreen("map")} />}
      {screen === "mailbox" && <MailboxScreen focusId={focusId} onDeleteVoice={(m) => { deleteVoice(m.id); patchMine(m.id, { hasVoice: false }); }} onRetry={(m) => upload(m).then((r) => { if (r.status === "error") window.alert("아직 서버에 닿지 못했어요."); })} onPatch={patchMine} orbsTotal={orbsTotal} mine={state.mine} grades={state.grade} onBack={() => { setFocusId(null); setScreen("map"); }} />}
      {screen === "note" && <NoteScreen storyDone={storyDone} nickname={state.nickname} account={account} sync={sync} onAccount={() => setScreen("account")} onNick={() => { setNickFrom(true); setScreen("nickname"); }} onReset={resetAll} letters={letters} grades={state.grade} isUnlocked={isUnlocked} onBack={() => setScreen("map")} onReplay={() => setScreen("intro")} onReplayEpilogue={() => setScreen("epilogue")} bottleSeen={state.bottleSeen} onReplayBottle={() => setScreen("bottle")} />}

      {screen === "read" && letter && (
        <main className="screen center">
          <p className="chapter">{letter.chapter}장 · {letter.people}</p>
          <aside className="recap">
            <b>이야기 배경</b>
            <p>{letter.context}</p>
            {idx > 0 && <p className="prev"><b>지난 이야기</b> {letters[idx - 1].reply}</p>}
          </aside>
          <HaemuSay text={letter.memo} />
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
              ? (letter.mode === "party" ? `편지가 바람길에 올랐습니다. ${fmtWhen(Date.now() + letter.delay)}, 항구에서 파티가 열려요.` : letter.mode === "link" ? `편지가 바람길에 올랐습니다. 아래 링크를 ${letter.tos?.length > 1 ? "사람마다 하나씩" : "받는 사람에게"} 전해 주세요.` : `편지가 바람길에 올랐습니다. ${DELAYS.find((d) => d.ms === letter.delay)?.label.replace(" (체험용)", "")} 편지함에 도착합니다.`)
              : letter.reply}</p>
            {!letter.custom && orbsGot >= 3 && letter.memory && <p className="memory">{letter.memory[0]}{orbsGot >= 7 && <> {letter.memory[1]}</>}</p>}
          </article>
          <div className={`grade ${grade}`}>{GRADE_NAME[grade]}</div>
          <div className="orbs-row" role="img" aria-label={`기억 구슬 ${orbsGot} / 9`}>{Array.from({ length: 9 }, (_, k) => <span key={k} className={k < orbsGot ? "on" : ""} />)}</div>
          {letter.custom && letter.mode === "link" && <ShareBox share={share} onRetry={() => { const e = share?.entries; if (!e) return; setShare({ status: "sending" }); upload(e).then(setShare); }} />}
          <p className="sub">
            {letter.custom ? "우표가 한 장 모였습니다." : "바람길이 이어졌습니다. 부표가 사라지고 금빛 바람이 흐릅니다."}
          </p>
          {!letter.custom && next && <p className="sub next">다음 이야기가 열렸어요 — {next.chapter}장 「{next.title}」 ({next.people})</p>}
          <div className="row">
            {epilogue
              ? <button className="btn" onClick={() => { setEpilogue(false); setScreen("epilogue"); }}>이야기의 끝으로</button>
              : letter.custom && !state.bottleSeen
                ? <><button className="btn" onClick={() => setScreen("bottle")}>바다를 바라본다</button><button className="btn ghost" onClick={() => setScreen("mailbox")}>편지함으로</button></>
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
