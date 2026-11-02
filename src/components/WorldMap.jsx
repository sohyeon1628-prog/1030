import React from "react";
import { GRADE_NAME } from "../data/letters.js";

// 장난감 같은 아이소메트릭 세계. 길 위의 바리케이드 = 아직 끊겨 있는 바람길(배달하면 치워진다).
const S = 38;
const P = (x, y, z = 0) => [(x - y) * S * 0.866, (x + y) * S * 0.5 - z * S * 0.62];
const pt = (a) => a.map(([x, y, z = 0]) => P(x, y, z).join(",")).join(" ");
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const COLORS = {
  red: ["#e8553a", "#d9452c", "#b8341f"], teal: ["#6fd6b4", "#5ec9a7", "#43a88a"],
  sand: ["#ecd9bd", "#e3cdaa", "#cfb48c"], blue: ["#a8c6e6", "#8fb4dc", "#6f97c4"],
  green: ["#a9c441", "#8fae33", "#789528"], cream: ["#faf3e6", "#efe3cd", "#dccbb0"],
  orange: ["#f59a4a", "#f08a3c", "#d9712f"], rust: ["#e8703a", "#d9532c", "#bf4122"],
};

// 둥근 모서리의 3면 슬래브 (윗면 / 왼쪽면 / 오른쪽면). 같은 색 stroke로 모서리를 둥글린다.
function Slab({ x, y, z = 0, w, d, h, c, rd = 7, shine = true }) {
  const t = z + h, [top, left, right] = c;
  const sp = { strokeLinejoin: "round", strokeWidth: rd };
  const T = [[x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]];
  return (
    <g>
      <polygon points={pt([[x, y + d, t], [x + w, y + d, t], [x + w, y + d, z], [x, y + d, z]])} fill={left} stroke={left} {...sp} />
      <polygon points={pt([[x + w, y, t], [x + w, y + d, t], [x + w, y + d, z], [x + w, y, z]])} fill={right} stroke={right} {...sp} />
      <polygon points={pt(T)} fill={top} stroke={top} {...sp} />
      {shine && <polygon points={pt(T)} fill="url(#shine)" />}
    </g>
  );
}

function Cone({ x, y }) {
  const A = P(x + 0.02, y + 0.34, 0.07), B = P(x + 0.34, y + 0.34, 0.07), Cc = P(x + 0.34, y + 0.02, 0.07), T = P(x + 0.18, y + 0.18, 0.58);
  const band = (a, b) => [mix(a, T, 0.38), mix(b, T, 0.38), mix(b, T, 0.62), mix(a, T, 0.62)].map((p) => p.join(",")).join(" ");
  return (
    <g>
      <Slab x={x} y={y} w={0.36} d={0.36} h={0.07} c={["#f7a45a", "#f08a3c", "#d9712f"]} rd={5} shine={false} />
      <polygon points={`${A} ${B} ${T}`} fill="#f58a3a" stroke="#f58a3a" strokeWidth="4" strokeLinejoin="round" />
      <polygon points={`${B} ${Cc} ${T}`} fill="#d9702c" stroke="#d9702c" strokeWidth="4" strokeLinejoin="round" />
      <polygon points={band(A, B)} fill="#faf3e6" />
      <polygon points={band(B, Cc)} fill="#e6d8c0" />
    </g>
  );
}

// 길을 막은 줄무늬 바리케이드 (윗 차선만 막아서 아랫 차선 자동차는 지나간다)
function Barricade({ x }) {
  const y = 2.05, d = 0.75, z = 0.35, h = 0.4, wx = 0.16, t = z + h;
  const stripes = [0, 1, 2].map((i) => {
    const a = y + 0.08 + i * 0.24;
    return <polygon key={i} points={pt([[x + wx, a, t], [x + wx, a + 0.12, t], [x + wx, a + 0.12, z], [x + wx, a, z]])} fill="#faf3e6" />;
  });
  return (
    <g>
      <Slab x={x + 0.02} y={y + 0.05} w={0.12} d={0.1} h={z} c={COLORS.cream} rd={4} shine={false} />
      <Slab x={x + 0.02} y={y + d - 0.15} w={0.12} d={0.1} h={z} c={COLORS.cream} rd={4} shine={false} />
      <Slab x={x} y={y} z={z} w={wx} d={d} h={h} c={["#f7a45a", "#f08a3c", "#e2742f"]} rd={6} />
      {stripes}
    </g>
  );
}

function Cactus({ x, y, z = 0, s = 1 }) {
  const [px, py] = P(x, y, z);
  return (
    <g transform={`translate(${px} ${py}) scale(${s})`}>
      <ellipse cx="6" cy="2" rx="12" ry="4" fill="rgba(150,55,25,.22)" />
      <rect x="-6" y="-34" width="12" height="36" rx="6" fill="#5f9a45" />
      <rect x="-13" y="-24" width="7" height="14" rx="3.5" fill="#5f9a45" /><rect x="6" y="-28" width="7" height="14" rx="3.5" fill="#6aa64e" />
      <rect x="-3" y="-32" width="3" height="28" rx="1.5" fill="#fff" opacity=".22" />
    </g>
  );
}

function Bush({ x, y, z = 0, s = 1 }) {
  const [px, py] = P(x, y, z);
  return (
    <g transform={`translate(${px} ${py}) scale(${s})`}>
      <ellipse cx="6" cy="3" rx="22" ry="6" fill="rgba(80,70,10,.25)" />
      <circle cx="-8" cy="-6" r="11" fill="#6b9a2a" /><circle cx="8" cy="-8" r="13" fill="#7aab33" /><circle cx="0" cy="-14" r="10" fill="#86b83a" />
      <circle cx="-3" cy="-17" r="4" fill="#fff" opacity=".22" />
    </g>
  );
}

function Car({ y = 0, body, cabin, wheelY = 0.72, parcels }) {
  const w = 1.6, d = 0.72;
  const win = (face) => face;
  const L = pt([[0.42, y + d - 0.01, 0.82], [1.04, y + d - 0.01, 0.82], [1.04, y + d - 0.01, 0.56], [0.42, y + d - 0.01, 0.56]]);
  void win;
  return (
    <g>
      <Slab x={-0.05} y={y - 0.04} w={w + 0.1} d={d + 0.08} h={0.14} c={COLORS.cream} rd={5} shine={false} />
      <Slab x={0} y={y} z={0.14} w={w} d={d} h={0.4} c={body} rd={8} />
      <Slab x={0.3} y={y + 0.03} z={0.54} w={0.95} d={d - 0.06} h={0.38} c={cabin} rd={8} />
      <polygon points={L} fill="#3b5f86" stroke="#3b5f86" strokeWidth="3" strokeLinejoin="round" />
      <polygon points={pt([[1.245, y + 0.12, 0.84], [1.245, y + d - 0.1, 0.84], [1.245, y + d - 0.1, 0.58], [1.245, y + 0.12, 0.58]])} fill="#4a7098" stroke="#4a7098" strokeWidth="3" strokeLinejoin="round" />
      {parcels && <Slab x={0.4} y={y + 0.1} z={0.92} w={0.7} d={0.5} h={0.25} c={COLORS.teal} rd={6} />}
      {[0.34, 1.26].map((wx) => {
        const [cx, cy] = P(wx, y + wheelY, 0.14);
        return <g key={wx}><circle cx={cx} cy={cy} r="7" fill="#3a2a2a" /><circle cx={cx} cy={cy} r="2.6" fill="#e3d6c0" /></g>;
      })}
    </g>
  );
}

// 편지 가방을 멘 채 둥실 떠 있는 우체부 (배달 대기 중인 섬 위)
function FlyingPostman({ cx, cy, z }) {
  const [px, py] = P(cx, cy, z);
  return (
    <g transform={`translate(${px} ${py})`}>
      <ellipse cx="4" cy="56" rx="22" ry="6" fill="rgba(150,55,25,.25)" filter="url(#blur4)" />
      <g className="bob"><g transform="scale(.95) rotate(8)">
        {[0.6, 1].map((o, k) => (
          <g key={k} className="wing wl" opacity={o} transform={`translate(${-4 + (k ? 0 : 6)} -22) rotate(-31)`}>
            <path d="M0 0 C-8 -26 -34 -40 -50 -18 C-34 -20 -18 -10 0 6 Z" fill="#fff" />
            <path d="M-2 -2 C-10 -18 -28 -26 -40 -16 C-28 -14 -16 -8 -2 2 Z" fill="#efe3cd" />
          </g>
        ))}
        <g transform="translate(-12 6) rotate(163)"><rect y="-4.5" width="20" height="9" rx="4.5" fill="#58392b" /><rect x="16" y="-6" width="11" height="12" rx="5" fill="#3d2a22" /></g>
        <g transform="translate(-12 6) rotate(177)"><rect y="-4.5" width="20" height="9" rx="4.5" fill="#6b4a3a" /><rect x="16" y="-6" width="11" height="12" rx="5" fill="#3d2a22" /></g>
        <rect x="-17" y="-11" width="33" height="22" rx="10" fill="#7ea6d4" />
        <rect x="-17" y="-11" width="33" height="9" rx="9" fill="#fff" opacity=".18" />
        <rect x="-17" y="3" width="33" height="5" rx="2.5" fill="#3d2a22" />
        <g transform="translate(-2 -12) rotate(-7)">
          <rect x="-2" y="-9" width="13" height="6" rx="2" fill="#faf3e6" />
          <rect x="-12" y="-4" width="26" height="19" rx="6" fill="#c98a4b" />
          <rect x="-12" y="-4" width="26" height="8" rx="6" fill="#a56d33" /><circle cx="1" cy="6" r="2.2" fill="#faf3e6" />
        </g>
        <line x1="10" y1="-10" x2="-10" y2="7" stroke="#8a5a2b" strokeWidth="4" strokeLinecap="round" />
        <g transform="translate(10 -5) rotate(-8)"><rect y="-4.5" width="22" height="9" rx="4.5" fill="#7ea6d4" /><circle cx="24" r="5" fill="#faf3e6" /></g>
        <circle cx="24" cy="-6" r="10.5" fill="#f6d2b0" />
        <rect x="14" y="-20" width="20" height="11" rx="5" fill="#d9452c" /><rect x="14" y="-12" width="20" height="3.5" rx="1.5" fill="#faf3e6" />
        <rect x="27" y="-11" width="11" height="4" rx="2" fill="#b8341f" />
        <circle cx="31" cy="-4" r="2.4" fill="#f0b894" /><circle cx="27" cy="-7" r="1.4" fill="#3d2a22" />
        <rect x="27" y="-1" width="9" height="3" rx="1.5" fill="#6b4a3a" />
      </g></g>
    </g>
  );
}

const SPOTS = [{ x: 1, y: -1.6 }, { x: 4.6, y: 4.6 }, { x: 8, y: -1.6 }, { x: 11.4, y: 4.6 }];
const BLOCK = 2.6;

function Stop({ i, letter, grade, locked, target, onOpen }) {
  const { x, y } = SPOTS[i];
  const roof = grade ? COLORS.teal : target ? COLORS.red : COLORS.sand;
  const label = locked ? "앞선 편지를 먼저" : grade ? `${GRADE_NAME[grade]} · 이어짐` : "배달 대기";
  const act = () => !locked && onOpen();
  const [lx, ly] = P(x + BLOCK / 2, y + BLOCK + 0.5, 0);
  return (
    <g
      className={`stop ${locked ? "locked" : ""}`} role="button" tabIndex={locked ? -1 : 0} aria-disabled={locked}
      aria-label={`${letter.title}, ${letter.from}에서 ${letter.to}로, ${label}`}
      onClick={act} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && act()}
    >
      <g filter={locked ? "url(#desat)" : undefined}>
        <polygon points={pt([[x + 0.7, y + 0.4, 0], [x + BLOCK + 1.8, y + 0.4, 0], [x + BLOCK + 1.8, y + BLOCK + 0.1, 0], [x + 0.7, y + BLOCK + 0.1, 0]])}
          fill="rgba(150,55,25,.26)" filter="url(#blur6)" />
        <Slab x={x} y={y} w={BLOCK} d={BLOCK} h={0.55} c={COLORS.rust} rd={14} />
        <Slab x={x + 0.1} y={y + 0.1} z={0.55} w={BLOCK - 0.2} d={BLOCK - 0.2} h={0.5} c={COLORS.orange} rd={14} />
        <Slab x={x + 0.05} y={y + 0.05} z={1.05} w={BLOCK - 0.1} d={BLOCK - 0.1} h={0.28} c={COLORS.green} rd={12} />
        <Bush x={x + 0.45} y={y + 2.0} z={1.33} /><Cactus x={x + 2.05} y={y + 0.6} z={1.33} />
        <Slab x={x + 0.8} y={y + 0.75} z={1.33} w={1.0} d={1.0} h={0.75} c={COLORS.cream} rd={8} />
        <polygon points={pt([[x + 1.0, y + 1.75, 1.33 + 0.4], [x + 1.28, y + 1.75, 1.33 + 0.4], [x + 1.28, y + 1.75, 1.33], [x + 1.0, y + 1.75, 1.33]])} fill="#b8341f" stroke="#b8341f" strokeWidth="3" strokeLinejoin="round" />
        <Slab x={x + 0.7} y={y + 0.65} z={2.08} w={1.2} d={1.2} h={0.32} c={roof} rd={9} />
        {grade && <Slab x={x + 1.9} y={y + 1.6} z={1.33} w={0.4} d={0.4} h={0.32} c={COLORS.teal} rd={6} />}
        {i === 0 && (
          <g>
            <Slab x={x + 0.1} y={y + 2.2} z={1.33} w={0.14} d={0.14} h={1.1} c={COLORS.cream} rd={4} shine={false} />
            <Slab x={x + 0.1} y={y + 0.2} z={1.33} w={0.14} d={0.14} h={1.1} c={COLORS.cream} rd={4} shine={false} />
            <Slab x={x + 0.04} y={y + 0.12} z={2.3} w={0.26} d={2.2} h={0.42} c={COLORS.red} rd={7} />
            <text x={P(x + 0.3, y + 1.22, 2.55)[0]} y={P(x + 0.3, y + 1.22, 2.55)[1] + 2} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" transform="rotate(26)" style={{ transformBox: "fill-box" }}>START</text>
          </g>
        )}
        {target && <FlyingPostman cx={x + 1.3} cy={y + 1.3} z={3.4} />}
      </g>
      <g transform={`translate(${lx} ${ly})`}>
        <rect x="-80" y="-17" width="160" height="42" rx="21" fill="#faf3e6" />
        <rect x="-80" y="-17" width="160" height="42" rx="21" fill="none" stroke="rgba(150,55,25,.12)" strokeWidth="2" />
        <text y="-1" textAnchor="middle" fontSize="14" fontWeight="800" fill={target ? "#d9452c" : "#6b2f1f"}>{letter.title}</text>
        <text y="16" textAnchor="middle" fontSize="10.5" fill="#9a6a52">{letter.from} → {letter.to} · {label}</text>
      </g>
    </g>
  );
}

// 편지섬(대체 지도): 내 편지를 쓰는 곳. 네 통을 모두 전하기 전에는 흐릿하게 잠겨 있다.
const POST_SPOT = { x: 11.4, y: -1.6 };
function PostStop({ open, onOpen }) {
  const { x, y } = POST_SPOT, act = () => open && onOpen();
  return (
    <g className={`stop ${open ? "" : "locked"}`} role="button" tabIndex={open ? 0 : -1} aria-disabled={!open}
      aria-label={open ? "편지섬: 내 편지 쓰기" : "편지섬: 네 통의 편지를 모두 전하면 열려요"}
      onClick={act} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && act()}>
      <g filter={open ? undefined : "url(#desat)"}>
        <Slab x={x} y={y} w={BLOCK} d={BLOCK} h={0.55} c={COLORS.rust} rd={14} />
        <Slab x={x + 0.1} y={y + 0.1} z={0.55} w={BLOCK - 0.2} d={BLOCK - 0.2} h={0.5} c={COLORS.orange} rd={14} />
        <Slab x={x + 0.05} y={y + 0.05} z={1.05} w={BLOCK - 0.1} d={BLOCK - 0.1} h={0.28} c={COLORS.green} rd={12} />
        <Slab x={x + 0.7} y={y + 0.6} z={1.33} w={1.2} d={1.1} h={0.8} c={COLORS.cream} rd={8} />
        <Slab x={x + 0.6} y={y + 0.5} z={2.13} w={1.4} d={1.3} h={0.34} c={COLORS.red} rd={9} />
        <Slab x={x + 2.0} y={y + 1.7} z={1.33} w={0.4} d={0.36} h={0.7} c={COLORS.red} rd={6} />
      </g>
    </g>
  );
}

export default function WorldMap({ letters, grades, isUnlocked, onOpen, postOpen = false, onPost }) {
  const target = letters.findIndex((l) => !grades[l.id]);
  const anyDone = Object.keys(grades).length > 0;
  const road = "M" + P(0, 2.8, 0.02).join(" ") + " L" + P(13, 2.8, 0.02).join(" ");
  const V = (L) => ({ "--dx": `${(L * S * 0.866).toFixed(1)}px`, "--dy": `${(L * S * 0.5).toFixed(1)}px` });

  // 깊이 정렬: 길 위쪽(y<2)에 있는 것 → 길 → 길 아래쪽(y>3.6)에 있는 것
  const back = [
    { d: 5, el: <g key="pond"><Slab x={4.8} y={-2.9} z={0} w={2.6} d={1.3} h={0.08} c={["#6fb4e0", "#5aa3d4", "#4a8cb8"]} rd={8} /></g> },
    ...SPOTS.map((s, i) => s.y < 2 && { d: s.x + s.y, el: <Stop key={`s${i}`} i={i} letter={letters[i]} grade={grades[letters[i].id]} locked={!isUnlocked(i)} target={i === target} onOpen={() => onOpen(letters[i])} /> }),
    { d: POST_SPOT.x + POST_SPOT.y, el: <PostStop key="post" open={postOpen} onOpen={() => onPost?.()} /> },
    { d: 4, el: <Cactus key="c1" x={3.4} y={0.2} /> }, { d: 12, el: <Cactus key="c2" x={11.6} y={-2.5} s={1.1} /> },
  ].filter(Boolean).sort((a, b) => a.d - b.d);

  const front = [
    ...SPOTS.map((s, i) => s.y > 3.6 && { d: s.x + s.y, el: <Stop key={`s${i}`} i={i} letter={letters[i]} grade={grades[letters[i].id]} locked={!isUnlocked(i)} target={i === target} onOpen={() => onOpen(letters[i])} /> }),
    { d: 7, el: <g key="field"><Slab x={-1.4} y={5.6} z={0} w={3.2} d={2.8} h={0.14} c={["#a9c441", "#8fae33", "#789528"]} rd={12} /></g> },
    { d: 8, el: <Bush key="b1" x={0.2} y={7.0} z={0.14} /> }, { d: 8.6, el: <Bush key="b2" x={1.1} y={7.4} z={0.14} s={0.8} /> },
    { d: 9, el: <Cactus key="c3" x={7.2} y={6.4} /> },
  ].filter(Boolean).sort((a, b) => a.d - b.d);

  return (
    <svg className="town" viewBox="-400 -150 1040 620" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".32" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7b36e" /><stop offset="1" stopColor="#ec8a45" /></linearGradient>
        <linearGradient id="roadg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c9715a" /><stop offset="1" stopColor="#b85d47" /></linearGradient>
        <filter id="blur6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="blur4"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="desat"><feColorMatrix type="saturate" values="0.35" /></filter>
        <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .25  0 0 0 0 .1  0 0 0 .09 0" /></filter>
      </defs>

      {/* 바닥 판: 디오라마처럼 두께가 있는 모래빛 땅 */}
      <Slab x={-2} y={-3} z={-0.6} w={16} d={12} h={0.6} c={["url(#ground)", "#e07a3a", "#c9642a"]} rd={16} shine={false} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <polygon key={k} points={pt([[-1.5 + k * 2.4, 7.5, 0.01], [-0.6 + k * 2.4, 7.5, 0.01], [3.2 + k * 2.4, -2.5, 0.01], [2.3 + k * 2.4, -2.5, 0.01]])} fill="#fff" opacity=".05" />
      ))}

      {/* 길: 테라코타 아스팔트 + 차선 */}
      <Slab x={-2} y={2} z={0} w={16} d={1.6} h={0.1} c={["url(#roadg)", "#a5503c", "#8e4130"]} rd={4} shine={false} />
      <polygon points={pt([[-2, 2.8, 0.11], [14, 2.8, 0.11], [14, 2.84, 0.11], [-2, 2.84, 0.11]])} fill="#e9a584" opacity=".85" />
      <polygon points={pt([[-2, 2.12, 0.11], [14, 2.12, 0.11], [14, 2.15, 0.11], [-2, 2.15, 0.11]])} fill="#e9a584" opacity=".5" />
      <polygon points={pt([[-2, 3.5, 0.11], [14, 3.5, 0.11], [14, 3.53, 0.11], [-2, 3.53, 0.11]])} fill="#e9a584" opacity=".5" />

      {back.map((b) => b.el)}

      {/* 길 위: 바리케이드(미배달 구간), 러버콘, 지나가는 자동차 */}
      {SPOTS.map((s, i) => !grades[letters[i].id] && (
        <g key={`bar${i}`}><Barricade x={s.x - 0.1} /><Cone x={s.x - 0.9} y={2.1} /><Cone x={s.x + 0.7} y={2.35} /></g>
      ))}
      <g transform={`translate(${P(0, 2.9)})`}><g className="drive" style={{ ...V(13), "--dur": "16s", "--del": "-2s" }}><Car body={COLORS.blue} cabin={COLORS.blue} /></g></g>
      <g transform={`translate(${P(0, 2.9)})`}><g className="drive" style={{ ...V(13), "--dur": "20s", "--del": "-11s" }}><Car body={COLORS.green} cabin={COLORS.green} /></g></g>
      <g transform={`translate(${P(0, 2.9)})`}><g className="drive" style={{ ...V(13), "--dur": "14s", "--del": "-7s" }}><Car body={COLORS.red} cabin={COLORS.red} parcels /></g></g>

      {/* 이어진 길에는 금빛 입자가 천천히 흐른다 */}
      {anyDone && [0, 1, 2, 3, 4].map((k) => (
        <circle key={k} r="2.6" fill="#ffd166" opacity=".9" filter="url(#blur4)">
          <animateMotion dur="10s" begin={`${-k * 2}s`} repeatCount="indefinite" path={road} />
        </circle>
      ))}

      {front.map((b) => b.el)}
      <rect x="-400" y="-150" width="1040" height="620" filter="url(#grain)" pointerEvents="none" />
    </svg>
  );
}
