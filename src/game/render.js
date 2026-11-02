import { WALK_TOP } from "./constants.js";
import { H, SX, LEN, ISLAND, LANE_Y, MAX_HITS, JUMP_T, JUMP_SPAN, START_TOP, GRASS, FOOT } from "./constants.js";
import { lerp, clamp } from "./level.js";
import { getSprite } from "./sprites3d.js";

// 참고 이미지 팔레트: 석양빛 오렌지 + 크림 + 올리브 그린 + 포인트(빨강/민트/하늘)
export const C = {
  skyTop: "#a9dcf2", skyLow: "#e6f6fb",
  orange: "#e8d3a0", orangeLt: "#f4e6bd", rust: "#b9a58a", rustDeep: "#8c7a63",
  cream: "#faf3e6", creamDeep: "#efe3cd",
  grass: "#a9c441", grassDeep: "#789528",
  red: "#d9452c", redLt: "#ee6a4c", teal: "#5ec9a7",
  dust: "#9fb3c6", dustDeep: "#7f95aa",
  ink: "#1f4a63", shadow: "rgba(20,80,120,.24)",
};
const SANS = '"Jua", "Noto Sans KR", sans-serif';

const path = (ctx, f) => { ctx.beginPath(); f(); };
function rr(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  path(ctx, () => ctx.roundRect(x, y, w, h, r));
  ctx.fill();
}
// 위→아래 세로 그라디언트 (볼륨감)
function vg(ctx, y, h, a, b) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, a); g.addColorStop(1, b);
  return g;
}
function blob(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  path(ctx, () => ctx.arc(x, y, r, 0, Math.PI * 2));
  ctx.fill();
}

// 통통한 크림 구름 (아랫면은 따뜻한 음영)
function puffCloud(ctx, x, y, s, a, b, blur) {
  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  blob(ctx, x + 14 * s, y + 10 * s, 26 * s, b); blob(ctx, x - 26 * s, y + 10 * s, 22 * s, b);
  blob(ctx, x - 30 * s, y + 2 * s, 24 * s, a); blob(ctx, x, y - 12 * s, 32 * s, a); blob(ctx, x + 30 * s, y, 26 * s, a);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  path(ctx, () => ctx.ellipse(x - 6 * s, y - 26 * s, 14 * s, 6 * s, -0.3, 0, Math.PI * 2)); ctx.fill();
  ctx.restore();
}

function cactus(ctx, x, base, s) {          // 야자수 (옵션 키 이름은 cactus 그대로 사용)
  ctx.fillStyle = "rgba(20,80,120,.18)";
  path(ctx, () => ctx.ellipse(x + 12 * s, base, 20 * s, 4 * s, 0, 0, Math.PI * 2)); ctx.fill();
  ctx.save(); ctx.translate(x, base); ctx.rotate(0.12);
  rr(ctx, -4 * s, -46 * s, 8 * s, 46 * s, 4 * s, "#b88a5a");
  ctx.restore();
  for (let i = 0; i < 5; i++) {
    ctx.save(); ctx.translate(x + 5 * s, base - 46 * s); ctx.rotate(-1.2 + i * 0.6);
    rr(ctx, 0, -4 * s, 30 * s, 8 * s, 4 * s, i % 2 ? "#5fae45" : "#6dbb4d");
    ctx.restore();
  }
}
function bush(ctx, x, base, s) {
  ctx.fillStyle = "rgba(80,70,10,.22)";
  path(ctx, () => ctx.ellipse(x + 6 * s, base, 24 * s, 5 * s, 0, 0, Math.PI * 2)); ctx.fill();
  blob(ctx, x - 9 * s, base - 8 * s, 12 * s, "#6b9a2a"); blob(ctx, x + 9 * s, base - 10 * s, 14 * s, "#7aab33"); blob(ctx, x, base - 17 * s, 11 * s, "#86b83a");
  blob(ctx, x - 3 * s, base - 21 * s, 4 * s, "rgba(255,255,255,.22)");
}
function house(ctx, x, base, w, h, roof) {
  rr(ctx, x, base - h, w, h, 9, vg(ctx, base - h, h, C.cream, C.creamDeep));
  rr(ctx, x - 5, base - h - 14, w + 10, 22, 11, roof);
  rr(ctx, x + w / 2 - 6, base - 20, 12, 20, 6, C.rustDeep);
}

// 층층이 쌓인 둥근 테라스형 섬
function island(ctx, x, top, w, opts = {}) {
  const y = H - top;
  ctx.fillStyle = C.shadow;                                       // 길게 번지는 그림자
  ctx.save(); ctx.filter = "blur(8px)";
  path(ctx, () => ctx.ellipse(x + w / 2 + 24, y + 40, w / 2, 26, 0, 0, Math.PI * 2)); ctx.fill();
  ctx.restore();
  rr(ctx, x + 14, y + 14, w - 28, H - y + 60, 26, vg(ctx, y + 14, 90, C.rust, C.rustDeep));   // 아래층
  rr(ctx, x + 6, y - 4, w - 12, 36, 16, vg(ctx, y - 4, 36, C.orangeLt, C.orange));            // 가운데층
  rr(ctx, x, y - 14, w, 24, 12, vg(ctx, y - 14, 24, "#b8d24a", C.grass));                     // 잔디
  rr(ctx, x + 12, y - 12, w - 24, 5, 3, "rgba(255,255,255,.35)");
  for (const [tx, s] of opts.cactus || []) cactus(ctx, x + tx, y - 12, s);
  for (const [tx, s] of opts.bushes || []) bush(ctx, x + tx, y - 12, s);
  for (const [hx, hw, hh] of opts.houses || []) house(ctx, x + hx, y - 12, hw, hh, opts.roof || C.red);
  if (opts.arch) {
    const ax = x + opts.arch;
    rr(ctx, ax, y - 86, 9, 76, 4, C.creamDeep); rr(ctx, ax + 91, y - 86, 9, 76, 4, C.creamDeep);
    rr(ctx, ax - 6, y - 112, 112, 32, 16, vg(ctx, y - 112, 32, C.redLt, C.red));
    ctx.fillStyle = "#fff"; ctx.font = `20px ${SANS}`; ctx.textAlign = "center";
    ctx.fillText("START", ax + 50, y - 90);
  }
}

// 편지 가방을 메고 날아가는 우체부 (오른쪽을 보고 날아간다). 큰 둥근 머리, 앞으로 숙인 자세, 등의 우편 날개가 퍼덕인다.
function postman(ctx, F, sy) {
  const thrust = F.thrust;
  // 섬 위에 서 있을 때(stand=1): 똑바로 서서 다리를 아래로, 날개는 접은 채 이륙이 다가올수록 들썩인다. 발을 떼면 금방 비행 자세로.
  const stand = Math.max(clamp(1 - F.lift * 3, 0, 1), F.land, F.walkK);             // 착륙하면, 하늘길을 걸을 때도 서 있는 자세로
  const ready = F.mode === "count" ? clamp(1 - F.cd / 2, 0, 1) : 1;
  const flap = Math.sin(F.t * (14 - 6 * stand)) * (0.2 + 0.4 * thrust) * (1 - stand * (1 - 0.6 * ready));
  const walkSwing = F.walkK > 0.5 ? (F.jumpT > 0 ? 0.4 : Math.sin(F.t * 12) * 0.55) : null;                   // 하늘길: 걷는 다리, 뛰는 중엔 접는다
  const swing = walkSwing ?? Math.sin(F.t * (9 + 9 * stand)) * (F.lift > 0 && F.lift < 0.25 ? 0.6 : 0.18 * (1 - stand));   // 도움닫기 중엔 다리를 크게 휘젓는다
  const crouch = F.mode === "count" && F.cd < 0.35 && stand ? 0.1 : 0;                                // 뛰기 직전 몸을 웅크린다
  const jacket = F.rev > 0 ? "#a63a28" : "#4f7fb5", jacketLt = F.rev > 0 ? "#c4503a" : "#6f9bd0";
  const skin = "#f6d2b0", pants = "#6b4a3a", boot = "#3d2a22", leather = "#c98a4b", leatherDk = "#a56d33";

  ctx.save();
  ctx.translate(SX, sy + crouch * FOOT);                                                // 웅크려도 발은 그 자리에
  ctx.rotate((clamp(-F.vy / 300, -0.5, 0.5) + 0.3) * (1 - stand));   // 앞으로 숙인 비행 자세(서 있을 땐 똑바로)
  ctx.scale(0.95, 0.95 * (1 - crouch));

  // 우편 날개: 등 위쪽에서 퍼덕인다 (먼 쪽은 옅게)
  for (const [alpha, off] of [[0.6, 5], [1, 0]]) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(-8 + off, -10);
    ctx.rotate(-1.0 - flap + stand * 0.5);
    ctx.fillStyle = "#fff";
    path(ctx, () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -22, -24, -34, -38, -14); ctx.bezierCurveTo(-24, -14, -12, -6, 0, 5); });
    ctx.fill();
    ctx.fillStyle = C.creamDeep;
    path(ctx, () => { ctx.moveTo(-2, -2); ctx.bezierCurveTo(-8, -14, -22, -22, -32, -13); ctx.bezierCurveTo(-22, -11, -12, -6, -2, 2); });
    ctx.fill();
    ctx.restore();
  }

  // 다리: 뒤로 휘날린다
  for (const [sw, col] of [[-swing, "#58392b"], [swing, pants]]) {
    ctx.save();
    ctx.translate(-3, 12);
    ctx.rotate(Math.PI - 0.55 + sw - stand * (Math.PI / 2 - 0.55));   // 서 있을 땐 아래로 곧게
    rr(ctx, 0, -4.5, 19, 9, 4.5, col);
    rr(ctx, 15, -6, 11, 12, 5, boot);
    ctx.restore();
  }

  // 편지 가방: 등 뒤에 매달린다. 어깨끈이 몸통을 가로지른다
  ctx.save();
  ctx.translate(-12, 2); ctx.rotate(0.25);
  rr(ctx, -7, -9, 14, 5, 2, C.cream);                     // 삐죽 나온 편지
  rr(ctx, -10, -5, 20, 20, 6, vg(ctx, -5, 20, leather, leatherDk));
  rr(ctx, -10, -5, 20, 8, 6, "#a56d33");
  blob(ctx, 0, 6, 2.2, "#ffd166");
  ctx.restore();

  // 몸통
  rr(ctx, -11, -13, 24, 28, 11, vg(ctx, -13, 28, jacketLt, jacket));
  rr(ctx, -11, 5, 24, 4, 2, "#3d2a22");
  ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  path(ctx, () => { ctx.moveTo(6, -12); ctx.lineTo(-9, 10); }); ctx.stroke();
  rr(ctx, -4, -17, 14, 6, 3, "#e8553a");                  // 스카프

  // 팔: 앞으로 쭉 뻗는다 (누르는 동안 더 위로)
  ctx.save();
  ctx.translate(6, -7);
  ctx.rotate(-0.15 - thrust * 0.5);
  rr(ctx, 0, -4.5, 21, 9, 4.5, jacket);
  blob(ctx, 23, 0, 5, C.cream);
  ctx.restore();

  // 머리: 큰 둥근 얼굴 + 우체부 모자(챙이 앞) + 눈, 코, 볼, 콧수염
  const hx = 5, hy = -28;
  blob(ctx, hx, hy, 14, skin);
  ctx.save();
  path(ctx, () => ctx.arc(hx, hy - 2, 15, Math.PI, 0)); ctx.fillStyle = vg(ctx, hy - 17, 15, C.redLt, C.red); ctx.fill();
  ctx.restore();
  rr(ctx, hx - 15, hy - 5, 30, 5, 2, C.cream);            // 모자 띠
  rr(ctx, hx + 8, hy - 6, 14, 5, 2.5, C.rustDeep);        // 챙
  blob(ctx, hx + 2, hy - 12, 2.6, "#ffd166");             // 모자 배지
  blob(ctx, hx + 10, hy + 1, 2.2, "#2b1d1a");             // 눈
  blob(ctx, hx + 11, hy, 0.7, "#fff");
  blob(ctx, hx + 15, hy + 4, 3, "#f0b894");               // 코
  ctx.globalAlpha = 0.45; blob(ctx, hx + 7, hy + 7, 3.4, "#f08a6a"); ctx.globalAlpha = 1;
  rr(ctx, hx + 8, hy + 8, 9, 3, 1.5, "#6b4a3a");          // 콧수염
  ctx.restore();
}

// ───── 장애물 그리기: 바다에서 솟구치는 상어·고래, 하늘의 새와 비행기, 먹구름·번개·회오리, 비 ─────
const pr = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

function splash(ctx, x, y, t) {                                  // 물보라
  path(ctx, () => ctx.ellipse(x, y + 2, 36, 7, 0, 0, Math.PI * 2)); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI;
    blob(ctx, x + Math.cos(a) * (24 + (i % 3) * 4), y - Math.sin(a) * (8 + (i % 3) * 7) + Math.sin(t * 4 + i) * 2, 5 + ((i * 7) % 5), "rgba(255,255,255,.85)");
  }
}

// 호를 그리며 뛰어오르는 상어/고래: 원점이 몸통 중심, 머리가 +x를 본다. 그리는 쪽에서 진행 방향으로 돌린다.
function jumper(ctx, kind, t) {
  const sp = getSprite(kind, t * 9 / (Math.PI * 2));                           // 3D 스프라이트(몸통 중심이 원점, 머리가 +x)
  if (sp) { ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2, sp.w, sp.h); return; }
  const whale = kind === "whale";
  const [L, T] = whale ? [124, 44] : [100, 34];
  const [c0, c1] = whale ? ["#5b8bc2", "#3f6ea5"] : ["#8ea4ba", "#6c8299"];
  const wag = Math.sin(t * 9) * 0.18;                                          // 꼬리를 흔든다
  ctx.fillStyle = c1;
  ctx.save(); ctx.translate(-L * 0.4, 0); ctx.rotate(wag);                     // 꼬리지느러미
  path(ctx, () => {
    if (whale) { ctx.moveTo(4, 0); ctx.bezierCurveTo(-8, -6, -26, -26, -30, -22); ctx.bezierCurveTo(-24, -12, -18, -4, -14, 0); ctx.bezierCurveTo(-18, 4, -24, 12, -30, 22); ctx.bezierCurveTo(-26, 26, -8, 6, 4, 0); }
    else { ctx.moveTo(4, 0); ctx.lineTo(-20, -T * 0.8); ctx.lineTo(-12, 0); ctx.lineTo(-18, T * 0.55); ctx.closePath(); }
  });
  ctx.fill(); ctx.restore();
  path(ctx, () => {                                                            // 등지느러미
    if (whale) { ctx.moveTo(-L * 0.08, -T * 0.42); ctx.quadraticCurveTo(-L * 0.16, -T * 0.72, -L * 0.22, -T * 0.36); }
    else { ctx.moveTo(L * 0.02, -T * 0.44); ctx.lineTo(-L * 0.12, -T * 1.1); ctx.lineTo(-L * 0.2, -T * 0.4); }
  });
  ctx.fill();
  ctx.fillStyle = vg(ctx, -T / 2, T, c0, c1);                                  // 몸통
  path(ctx, () => {
    if (whale) { ctx.moveTo(L * 0.5, 0); ctx.bezierCurveTo(L * 0.5, -T * 0.62, -L * 0.1, -T * 0.66, -L * 0.42, -T * 0.08); ctx.lineTo(-L * 0.42, T * 0.08); ctx.bezierCurveTo(-L * 0.1, T * 0.56, L * 0.5, T * 0.6, L * 0.5, 0); }
    else { ctx.moveTo(L * 0.5, 2); ctx.bezierCurveTo(L * 0.34, -T * 0.58, -L * 0.2, -T * 0.6, -L * 0.42, -T * 0.08); ctx.lineTo(-L * 0.42, T * 0.08); ctx.bezierCurveTo(-L * 0.2, T * 0.5, L * 0.3, T * 0.52, L * 0.5, 2); }
  });
  ctx.fill();
  ctx.fillStyle = "#eef2f6";                                                   // 배
  path(ctx, () => { ctx.moveTo(L * 0.46, 5); ctx.bezierCurveTo(L * 0.3, T * 0.5, -L * 0.15, T * 0.44, -L * 0.36, T * 0.07); ctx.bezierCurveTo(-L * 0.1, T * 0.2, L * 0.25, T * 0.18, L * 0.46, 5); });
  ctx.fill();
  ctx.fillStyle = c1;                                                          // 가슴지느러미
  path(ctx, () => { ctx.moveTo(L * 0.12, T * 0.28); ctx.quadraticCurveTo(L * 0.02, T * 0.95, -L * 0.08, T * 0.8); ctx.quadraticCurveTo(-L * 0.02, T * 0.5, -L * 0.04, T * 0.3); });
  ctx.fill();
  blob(ctx, L * 0.3, -T * 0.12, 3.4, "#1f2d3a"); blob(ctx, L * 0.31, -T * 0.15, 1.1, "#fff");   // 눈
  if (whale) {
    ctx.strokeStyle = "rgba(63,110,165,.35)"; ctx.lineWidth = 2; ctx.lineCap = "round";        // 배 주름
    for (let i = 0; i < 4; i++) path(ctx, () => { ctx.moveTo(L * (0.36 - i * 0.1), T * 0.3); ctx.lineTo(L * (0.2 - i * 0.1), T * 0.36); }), ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(61,74,88,.45)"; ctx.lineWidth = 1.6;                                 // 아가미
    for (let i = 0; i < 3; i++) path(ctx, () => { ctx.moveTo(L * (0.17 - i * 0.04), -T * 0.18); ctx.quadraticCurveTo(L * (0.14 - i * 0.04), 0, L * (0.17 - i * 0.04), T * 0.16); }), ctx.stroke();
    ctx.strokeStyle = "#3d4a58"; ctx.lineWidth = 2.2;                                           // 입과 이빨
    path(ctx, () => { ctx.moveTo(L * 0.46, 7); ctx.quadraticCurveTo(L * 0.36, 12, L * 0.26, 8); }); ctx.stroke();
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 4; i++) path(ctx, () => { const x0 = L * 0.28 + i * 5; ctx.moveTo(x0, 9); ctx.lineTo(x0 + 4, 9.5); ctx.lineTo(x0 + 2, 14); }), ctx.fill();
  }
}

const BIRD = { blue: ["#7b93ab", "#56708a", "#6b86a0"], dark: ["#4a4657", "#2e2b38", "#3b3847"] };   // 검은 새 떼는 도중에 줄을 바꾼다
function bird(ctx, x, y, s, t, dir = -1, tone = "blue") {       // 날갯짓하는 새(기본 오른쪽, dir=-1이면 왼쪽을 본다)
  const sp = getSprite(`bird:${tone}`, t * 10 / (Math.PI * 2));
  if (sp) { ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore(); return; }
  const f = Math.sin(t * 10) * 0.8, [c1, c2, body] = BIRD[tone];
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  for (const [a, col] of [[-0.3, c1], [0, c2]]) {
    ctx.save(); ctx.translate(-2, -3); ctx.rotate(-f * 0.9 + a); ctx.fillStyle = col;
    path(ctx, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -16, -20, -12); ctx.quadraticCurveTo(-10, -4, 0, 3); }); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = body; path(ctx, () => ctx.ellipse(0, 1, 11, 6, 0, 0, Math.PI * 2)); ctx.fill();
  path(ctx, () => { ctx.moveTo(-9, 0); ctx.lineTo(-18, -2); ctx.lineTo(-17, 4); }); ctx.fill();         // 꼬리
  blob(ctx, 10, -2, 5, body);
  ctx.fillStyle = "#f4a63a"; path(ctx, () => { ctx.moveTo(14, -3); ctx.lineTo(20, -1); ctx.lineTo(14, 0); }); ctx.fill();
  blob(ctx, 11.5, -3.5, 1.2, "#1f2d3a");
  ctx.restore();
}

function plane(ctx, x, y, s, dir = 1, angle = 0) {              // 작은 비행기(기본 오른쪽을 본다)
  const sp = getSprite("plane", (performance.now() / 160) % 1);
  if (sp) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(dir * s, s); ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore(); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(dir * s, s);
  ctx.fillStyle = "#d9e2ea"; path(ctx, () => { ctx.moveTo(-8, -3); ctx.lineTo(-30, -16); ctx.lineTo(-22, -16); ctx.lineTo(0, -3); }); ctx.fill();   // 꼬리날개
  rr(ctx, -32, -7, 64, 14, 7, vg(ctx, -7, 14, "#ffffff", "#dfe7ee"));                                                                        // 동체
  path(ctx, () => { ctx.moveTo(26, -7); ctx.quadraticCurveTo(40, 0, 26, 7); }); ctx.fillStyle = C.red; ctx.fill();                          // 기수
  rr(ctx, -30, -1, 52, 3, 1.5, C.red);
  ctx.fillStyle = "#b9c7d4"; path(ctx, () => { ctx.moveTo(-6, 4); ctx.lineTo(-22, 22); ctx.lineTo(-12, 22); ctx.lineTo(8, 4); }); ctx.fill(); // 날개
  for (let i = 0; i < 4; i++) blob(ctx, -14 + i * 9, -3, 2, "#7ea6d4");
  ctx.restore();
}

function tornado(ctx, x, y, r, t) {                              // 회오리: 위가 넓고 아래가 좁은 깔때기
  const sp = getSprite("tornado", t * 0.8);
  if (sp) { const k = r / 55; ctx.drawImage(sp.img, x - (sp.w * k) / 2, y - 0.45 * r - (sp.h * k) / 2, sp.w * k, sp.h * k); return; }
  const top = y - r * 1.9, bot = y + r * 1.0;
  for (let i = 0; i < 9; i++) {
    const u = i / 8, yy = top + (bot - top) * u, w = r * (1.1 - 0.85 * u);
    ctx.fillStyle = `rgba(${108 + i * 4},${118 + i * 4},${134 + i * 3},.65)`;
    path(ctx, () => ctx.ellipse(x + Math.sin(t * 4 + i * 0.9) * r * 0.12 * (1 - u * 0.3), yy, w, r * 0.16, 0, 0, Math.PI * 2)); ctx.fill();
  }
  for (let k = 0; k < 10; k++) { const a = t * 5 + k * 0.9; blob(ctx, x + Math.cos(a) * r * (0.5 + 0.3 * Math.sin(k)), y + (k - 5) * r * 0.28, 2.4, "#8a6a4a"); }
}

// 먹구름: 3D 스프라이트(없으면 2D 구름)
function stormCloud(ctx, x, y, s) {
  const sp = getSprite("storm");
  if (sp) { ctx.drawImage(sp.img, x - (sp.w * s) / 2, y - (sp.h * s) / 2, sp.w * s, sp.h * s); return; }
  puffCloud(ctx, x, y, s, "#6f7d8f", "#56627a", 0.8);
}

function boltShape(ctx, x, top, bot, seed) {
  let cx = x, y = top;
  ctx.moveTo(cx, y);
  while (y < bot) { y += 36; cx = x + (pr(seed + y) - 0.5) * 38; ctx.lineTo(cx, y); }
}

// ───── 아이템: 기억 구슬, 깃털 방패, 심장, 순풍 리본, 우산 ─────
function heartPath(ctx, x, y, r) {
  path(ctx, () => { ctx.moveTo(x, y + r * 0.9); ctx.bezierCurveTo(x - r * 1.5, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45); ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.5, y - r * 0.2, x, y + r * 0.9); });
}
function drawItem(ctx, kind, x, y, t) {
  y += Math.sin(t * 3 + x * 0.02) * 4;
  if (kind === "orb") {
    const g = ctx.createRadialGradient(x, y, 2, x, y, 28);
    g.addColorStop(0, "rgba(255,226,140,.95)"); g.addColorStop(1, "rgba(255,226,140,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 28, y - 28, 56, 56);
    blob(ctx, x, y, 9 + Math.sin(t * 5 + x) * 0.8, "#ffd166"); blob(ctx, x - 3, y - 3, 3, "#fff");
  } else if (kind === "shield") {
    blob(ctx, x, y, 20, "rgba(190,225,245,.42)");
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.5; path(ctx, () => ctx.arc(x, y, 20, 0, Math.PI * 2)); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.7);
    ctx.fillStyle = "#fff"; path(ctx, () => ctx.ellipse(0, 0, 5.5, 13, 0, 0, Math.PI * 2)); ctx.fill();
    ctx.strokeStyle = "#b9c7d4"; ctx.lineWidth = 1.6; path(ctx, () => { ctx.moveTo(0, -12); ctx.lineTo(0, 15); }); ctx.stroke();
    ctx.restore();
  } else if (kind === "heart") {
    ctx.fillStyle = "rgba(255,120,120,.35)"; blob(ctx, x, y, 22, "rgba(255,120,120,.3)");
    ctx.fillStyle = C.red; heartPath(ctx, x, y, 12); ctx.fill();
    blob(ctx, x - 5, y - 5, 2.6, "rgba(255,255,255,.7)");
  } else if (kind === "ribbon") {
    blob(ctx, x, y, 22, "rgba(130,200,240,.3)");
    ctx.lineCap = "round"; ctx.lineWidth = 7;
    ctx.strokeStyle = "#7ec8ee"; path(ctx, () => { ctx.moveTo(x - 16, y + 8); ctx.bezierCurveTo(x - 6, y - 14, x + 4, y + 16, x + 16, y - 8); }); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = "#e6f6fd"; path(ctx, () => { ctx.moveTo(x - 16, y + 6); ctx.bezierCurveTo(x - 6, y - 14, x + 4, y + 14, x + 16, y - 10); }); ctx.stroke();
  } else if (kind === "umbrella") {
    blob(ctx, x, y, 22, "rgba(255,150,130,.25)");
    ctx.fillStyle = C.red; path(ctx, () => { ctx.moveTo(x - 17, y + 2); ctx.quadraticCurveTo(x, y - 24, x + 17, y + 2); ctx.quadraticCurveTo(x + 9, y - 3, x, y + 2); ctx.quadraticCurveTo(x - 9, y - 3, x - 17, y + 2); }); ctx.fill();
    ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; path(ctx, () => { ctx.moveTo(x, y + 1); ctx.lineTo(x, y + 14); ctx.quadraticCurveTo(x, y + 19, x - 5, y + 17); }); ctx.stroke();
  }
}

function outlined(ctx, text, x, y) {
  ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(31,74,99,.6)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = C.cream; ctx.fillText(text, x, y);
}

const ITEM_NAME = { orb: "구슬", shield: "깃털 방패", heart: "심장", ribbon: "순풍 리본", umbrella: "우산" };
// 연습 비행: 아이템 이름표와, 위험이 닥칠 자리(이름 + 붉은 영역)를 화면에 적어 준다.
function practiceLabels(ctx, F, camX, sy) {
  const W = ctx.canvas.width;
  ctx.save(); ctx.textAlign = "center"; ctx.font = `17px ${SANS}`;
  const tag = (t, x, y) => outlined(ctx, t, x, y);
  for (const it of F.lv.items) {
    if (it.taken) continue;
    const x = it.x - camX; if (x < -40 || x > W + 40) continue;
    tag(ITEM_NAME[it.kind], x, sy(it.y ?? LANE_Y[it.lane]) + 40);
  }
  for (const c of F.lv.clouds) { const x = c.x - camX; if (x > -90 && x < W + 90) tag("먹구름: 닿으면 아파요", x, sy(c.y) + 52); }
  for (const v of F.lv.vortices) { const x = v.x - camX; if (x > -100 && x < W + 100) tag("회오리: 위아래 반대", x, sy(v.y) + v.r + 20); }
  for (const b of F.lv.bolts) {
    const x = b.x - camX; if (x < -60 || x > W + 60 || (b.state !== "warn" && b.state !== "strike")) continue;
    tag("번개 자리", x, sy(LANE_Y[b.lane]) + 106);
  }
  for (const ev of F.lv.events) {
    if (ev.state !== "tele") continue;
    const breach = ev.kind === "shark" || ev.kind === "whale";
    if (breach) {                                                               // 뛰어오를 때 닿는 줄을 붉게 칠한다
      const x = ev.x - camX, l = ev.peak > 220 ? 1 : 0;
      ctx.fillStyle = "rgba(232,85,58,.22)";
      ctx.fillRect(x - 60, sy(LANE_Y[l]) - 48, 120, 96);
      tag(`${ev.kind === "shark" ? "상어" : "고래"} 점프! ${l ? "가운데" : "아래"} 줄이 위험`, x, sy(LANE_Y[l]) - 62);
    } else tag(`${ev.kind === "birds" ? "새" : "비행기"}: 이 줄이 위험!`, W - 150, sy(ev.y) - 36);
  }
  ctx.restore();
}

// 하늘길: 구름으로 이어진 길. 구멍 자리는 끊겨 있고, 낮은 먹구름 덩어리가 놓여 있다.
// 귀여운 해적: 구름 길을 이쪽으로 뛰어온다. 큰 머리에 검은 모자, 눈가리개, 줄무늬 옷, 칼. 뛰어서 넘어야 한다.
function pirate(ctx, cx, baseY, t) {
  const ph = t * 13 + cx * 0.05, bob = Math.abs(Math.sin(ph)) * 7, y = baseY - bob;
  ctx.save();
  ctx.fillStyle = "rgba(20,80,120,.18)"; path(ctx, () => ctx.ellipse(cx, baseY + 4, 30, 6, 0, 0, Math.PI * 2)); ctx.fill();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#3b2a22"; ctx.lineWidth = 8;                                                                       // 달리는 다리
  for (const k of [0, Math.PI]) { const sw = Math.sin(ph + k), lift = Math.max(0, Math.cos(ph + k)) * 6; path(ctx, () => { ctx.moveTo(cx + 2, baseY - 20 - bob * 0.3); ctx.lineTo(cx - 4 - sw * 14, baseY - 3 - lift); }); ctx.stroke(); }
  rr(ctx, cx - 22, y - 46, 40, 32, 12, "#fff6e6"); ctx.strokeStyle = "#3b2a22"; ctx.lineWidth = 2.5; path(ctx, () => ctx.roundRect(cx - 22, y - 46, 40, 32, 12)); ctx.stroke();   // 몸통
  ctx.fillStyle = "#4a7cc9"; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 21, y - 40 + i * 9, 38, 4);                         // 줄무늬
  ctx.strokeStyle = "#e8b04a"; ctx.lineWidth = 6; path(ctx, () => { ctx.moveTo(cx - 14, y - 36); ctx.lineTo(cx - 36, y - 52 - Math.sin(ph) * 5); }); ctx.stroke();   // 칼을 든 팔
  ctx.strokeStyle = "#cfd8e2"; ctx.lineWidth = 4; path(ctx, () => { ctx.moveTo(cx - 36, y - 52 - Math.sin(ph) * 5); ctx.lineTo(cx - 44, y - 74 - Math.sin(ph) * 5); }); ctx.stroke();
  ctx.strokeStyle = "#f2c9a0"; ctx.lineWidth = 6; path(ctx, () => { ctx.moveTo(cx + 12, y - 38); ctx.lineTo(cx + 24, y - 28 + Math.sin(ph) * 6); }); ctx.stroke();            // 반대쪽 팔
  blob(ctx, cx - 4, y - 62, 21, "#f2c9a0"); ctx.strokeStyle = "#3b2a22"; ctx.lineWidth = 2.5; path(ctx, () => ctx.arc(cx - 4, y - 62, 21, 0, Math.PI * 2)); ctx.stroke();     // 머리
  ctx.fillStyle = "#222a3a"; path(ctx, () => { ctx.moveTo(cx - 28, y - 70); ctx.quadraticCurveTo(cx - 4, y - 104, cx + 20, y - 70); ctx.quadraticCurveTo(cx - 4, y - 78, cx - 28, y - 70); ctx.closePath(); }); ctx.fill();   // 삼각 모자
  blob(ctx, cx - 4, y - 84, 4, "#ffffff");                                                                                   // 해골 표시
  ctx.fillStyle = "#222a3a"; ctx.beginPath(); ctx.arc(cx - 12, y - 63, 6.5, 0, Math.PI * 2); ctx.fill();                             // 눈가리개
  ctx.strokeStyle = "#222a3a"; ctx.lineWidth = 2; path(ctx, () => { ctx.moveTo(cx - 24, y - 70); ctx.lineTo(cx - 6, y - 58); }); ctx.stroke();
  blob(ctx, cx + 4, y - 63, 3.4, "#222a3a"); blob(ctx, cx + 5, y - 64, 1.1, "#ffffff");                                              // 눈
  ctx.globalAlpha = 0.55; blob(ctx, cx - 18, y - 53, 4.5, "#f59ab0"); blob(ctx, cx + 10, y - 53, 4.5, "#f59ab0"); ctx.globalAlpha = 1;   // 볼
  ctx.strokeStyle = "#7a3b2e"; ctx.lineWidth = 2.2; path(ctx, () => ctx.arc(cx - 3, y - 54, 6, 0.15, Math.PI - 0.15)); ctx.stroke();      // 웃는 입
  ctx.restore();
}

function skyRoad(ctx, F, camX, sy, W) {
  const w = F.lv.walk; if (!w) return;
  const a = w.a - 220 - camX, b = w.b + 160 - camX;
  if (b < -60 || a > W + 60) return;
  const top = sy(WALK_TOP);
  const gaps = w.obs.filter((o) => o.kind === "gap").map((o) => [o.x - o.w / 2 - camX, o.x + o.w / 2 - camX]).sort((p, q) => p[0] - q[0]);
  const segs = []; let s = a;
  for (const [g0, g1] of gaps) { if (g0 > s) segs.push([s, g0]); s = Math.max(s, g1); }
  segs.push([s, b]);
  for (const [s0, e0] of segs) {
    const x0 = Math.max(s0, -50), x1 = Math.min(e0, W + 50);
    if (x1 <= x0) continue;
    const gr = ctx.createLinearGradient(0, top, 0, top + 52); gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#cfe6f4");
    rr(ctx, x0, top + 6, x1 - x0, 44, 20, gr);
    for (let x = Math.ceil((x0 + 8) / 30) * 30; x < x1 - 8; x += 30) blob(ctx, x, top + 8 + Math.sin(x * 0.07) * 2, 17 + ((x / 30) % 3) * 3, "#ffffff");   // 길 윗면의 둥근 구름 결
  }
  for (const [g0, g1] of gaps) {                                              // 구멍 가장자리의 흩날리는 구름 조각
    if (g1 < -20 || g0 > W + 20) continue;
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (const gx of [g0 - 6, g1 + 6]) { path(ctx, () => { ctx.moveTo(gx, top + 14); ctx.lineTo(gx + (gx === g0 - 6 ? -4 : 4), top + 40); }); ctx.stroke(); }
    ctx.restore();
  }
  for (const o of w.obs) {                                                     // 해적: 뛰어서 넘는다
    if (o.kind !== "pirate") continue;
    const x = o.x - camX; if (x < -90 || x > W + 90) continue;
    pirate(ctx, x, sy(WALK_TOP), F.t);
  }
  // 다가오는 장애물 위에 "점프!" 표시: 뛰어야 할 때(약 0.5초 전)부터 깜빡이며 위아래로 흔들린다
  if (F.mode === "fly") for (const o of w.obs) {
    const ahead = o.x - F.x;
    if (ahead < 40 || ahead > 340 || o.passed) continue;
    const x = o.x - camX, bob = Math.sin(F.t * 9) * 4, hot = o.kind === "pirate" ? ahead < 250 : ahead < 210;       // 이때부터 누르면 된다
    ctx.save(); ctx.globalAlpha = hot ? 0.95 : 0.55; ctx.textAlign = "center";
    const y = sy(WALK_TOP + (o.kind === "pirate" ? o.h + 30 : 8)) - 46 + bob;
    path(ctx, () => { ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 14); ctx.closePath(); }); ctx.fillStyle = hot ? "#e8553a" : "#ffffff"; ctx.fill();
    ctx.font = `20px ${SANS}`; outlined(ctx, "점프!", x, y - 6);
    ctx.restore();
  }
}

export function drawFlight(ctx, F) {
  const W = ctx.canvas.width;
  const camX = F.x - SX;
  const sy = (y) => H - y;
  const shake = F.shake > 0 ? (Math.random() - 0.5) * 6 : 0;

  ctx.save();
  ctx.translate(shake, shake);

  ctx.fillStyle = vg(ctx, 0, H, C.skyTop, C.skyLow);
  ctx.fillRect(-10, -10, W + 20, H + 20);
  const sun = ctx.createRadialGradient(W * 0.82, 70, 10, W * 0.82, 70, 260);
  sun.addColorStop(0, "rgba(255,244,200,.85)"); sun.addColorStop(1, "rgba(255,244,200,0)");
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

  // 배경에는 구름을 두지 않는다: 길·장애물(먹구름)과 헷갈리지 않도록 하늘만 보인다

  island(ctx, -camX - 140, START_TOP, 340, { arch: 0, cactus: [[310, 1.1]], bushes: [[24, 1]] });
  island(ctx, 0.9 * LEN - camX, ISLAND, 0.1 * LEN + 560, {
    cactus: [[60, 1], [640, 1.2]], bushes: [[110, 0.9], [600, 1]],
    houses: [[260, 58, 42], [350, 50, 36]], roof: C.teal,
  });

  // 바다: 섬의 아랫부분이 물속에 잠기고, 겹겹의 물결이 서로 다른 빠르기로 일렁인다(멀수록 느리고 옅다). 수면(seaY)은 상어·고래가 뛰어오르는 기준이다.
  const seaY = H - 24;
  const WAVES = [
    { y: -2, amp: 5, f: 0.017, sp: 0.9, k: 0.45, col: "rgba(150,214,238,.75)" },
    { y: 5, amp: 6, f: 0.026, sp: 1.5, k: 0.7, col: "rgba(82,181,222,.9)" },
    { y: 13, amp: 5, f: 0.036, sp: 2.2, k: 1.0, col: "rgba(48,146,198,.96)" },
    { y: 22, amp: 4, f: 0.05, sp: 2.9, k: 1.3, col: "rgba(34,122,178,1)" },
  ];
  WAVES.forEach((w, n) => {
    const yy = (x) => seaY + w.y + Math.sin((x + camX * w.k) * w.f + F.t * w.sp + n) * w.amp + Math.sin((x + camX * w.k) * w.f * 2.3 - F.t * w.sp * 0.7) * w.amp * 0.35;
    path(ctx, () => { ctx.moveTo(-10, H + 10); for (let x = -10; x <= W + 10; x += 8) ctx.lineTo(x, yy(x)); ctx.lineTo(W + 10, H + 10); });
    ctx.fillStyle = w.col; ctx.fill();
    if (n === 1 || n === 2) {                                           // 물마루의 흰 거품
      ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${n === 1 ? 0.55 : 0.8})`; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      path(ctx, () => { for (let x = -10; x <= W + 10; x += 8) { const y = yy(x); x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } }); ctx.stroke();
      ctx.restore();
    }
  });
  ctx.fillStyle = "rgba(255,255,255,.55)";                              // 반짝이는 물비늘
  for (let i = 0; i < 9; i++) { const x = (((i * 137 - camX * 1.1 + F.t * 18) % (W + 80)) + W + 80) % (W + 80) - 40; const y = seaY + 8 + ((i * 53) % 18) + Math.sin(F.t * 2 + i) * 2; rr(ctx, x, y, 12 + (i % 3) * 6, 2.5, 1.2, "rgba(255,255,255,.55)"); }

  // 세 줄 안내선: 위·가운데·아래 줄이 어디인지 옅은 점선으로 보인다
  if (F.mode !== "done") {
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.setLineDash([6, 14]);
    for (const ly of LANE_Y) path(ctx, () => { ctx.moveTo(0, sy(ly)); ctx.lineTo(W, sy(ly)); }), ctx.stroke();
    ctx.restore();
  }

  skyRoad(ctx, F, camX, sy, W);

  // 갑자기 일어나는 사건: 경고 → 발생
  const lane = (F.mode === "fly") ? 1 : 0;
  for (const ev of F.lv.events) {
    const breach = ev.kind === "shark" || ev.kind === "whale";
    if (ev.state === "tele") {
      const k = 1 - ev.t / ev.warn;                                             // 0 → 1
      if (breach) {
        const x = ev.x + JUMP_SPAN - camX;                                       // 뛰어오를 자리
        if (x < -90 || x > W + 90) continue;
        ctx.fillStyle = `rgba(20,60,110,${0.2 + 0.3 * k})`;                      // 물속에 비치는 커다란 그림자
        path(ctx, () => ctx.ellipse(x, seaY + 9, 30 + 16 * k, 8, 0, 0, Math.PI * 2)); ctx.fill();
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {                                           // 번져 나가는 물결
          const r = 14 + ((k * 46 + i * 18) % 54);
          ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - r / 72)})`;
          path(ctx, () => ctx.ellipse(x, seaY + 4, r * 1.6, r * 0.34, 0, 0, Math.PI * 2)); ctx.stroke();
        }
        ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(F.t * 18);
        rr(ctx, x - 13, seaY - 46, 26, 26, 8, "#ffd166"); ctx.fillStyle = C.ink; ctx.font = `19px ${SANS}`; ctx.textAlign = "center"; ctx.fillText("!", x, seaY - 26);
        ctx.restore();
      } else if (lane) {
        const y = sy(ev.y), pulse = 0.14 + 0.12 * Math.sin(F.t * 16);
        const lg = ctx.createLinearGradient(SX + 70, 0, W, 0);                                       // 날아올 길: 오른쪽일수록 진하다
        lg.addColorStop(0, "rgba(232,85,58,0)"); lg.addColorStop(1, `rgba(232,85,58,${pulse + 0.16})`);
        ctx.fillStyle = lg; ctx.fillRect(SX + 70, y - 26, W - SX - 70, 52);
        ctx.save(); ctx.globalAlpha = 0.65 + 0.35 * Math.sin(F.t * 18);
        path(ctx, () => { ctx.moveTo(W - 70, y); ctx.lineTo(W - 40, y - 20); ctx.lineTo(W - 40, y + 20); }); ctx.fillStyle = ev.dive != null ? "#3b3847" : "#e8553a"; ctx.fill();
        const col = ev.dive != null ? "#3b3847" : "#e8553a";
        rr(ctx, W - 40, y - 20, 34, 40, 9, col); ctx.fillStyle = "#fff"; ctx.font = `24px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(ev.dive != null ? "?" : "!", W - 23, y + 9);
        ctx.restore();
      }
    } else if (ev.state === "act") {
      if (breach) {
        const x = ev.bx - camX, u = ev.t / JUMP_T, t = F.t + ev.seed;
        if (x < -160 || x > W + 160) continue;
        // 물을 박차고 나오는 자리와 다시 잠기는 자리에 물보라
        if (u < 0.3) { ctx.save(); ctx.globalAlpha = 1 - u / 0.3; splash(ctx, ev.x + JUMP_SPAN - camX, seaY, t); ctx.restore(); }
        if (u > 0.7) { ctx.save(); ctx.globalAlpha = Math.min(1, (u - 0.7) / 0.15); splash(ctx, ev.x - JUMP_SPAN - camX, seaY, t); ctx.restore(); }
        ctx.save();
        path(ctx, () => ctx.rect(-10, -10, W + 20, seaY + 14)); ctx.clip();      // 물속에 잠긴 부분은 가린다
        ctx.translate(x, sy(ev.by)); ctx.scale(-1, 1);                          // 왼쪽을 보고, 진행 방향으로 기운다
        ctx.rotate(Math.atan2(-ev.vy, -ev.vx));
        jumper(ctx, ev.kind, t);
        ctx.restore();
        if (ev.kind === "whale" && u > 0.38 && u < 0.62) {                    // 정점 근처에서 물을 뿜는다
          for (let i = 0; i < 4; i++) blob(ctx, x - 22 + Math.sin(t * 5 + i) * 5, sy(ev.by) - 28 - i * 9, 3.4 - i * 0.5, "rgba(200,230,255,.9)");
        }
      } else {
        const x = ev.px - camX;
        if (x < -140 || x > W + 140) continue;
        const y = sy(ev.cy);
        if (ev.kind === "birds") {
          const tone = ev.dive != null ? "dark" : "blue";
          bird(ctx, x, y, 1.15, F.t + ev.seed, -1, tone); bird(ctx, x + 26, y - 16, 0.95, F.t + ev.seed + 1, -1, tone); bird(ctx, x + 26, y + 16, 0.95, F.t + ev.seed + 2, -1, tone);
        }
        else {
          const g = ctx.createLinearGradient(x, 0, x + 300, 0);                  // 비행운
          g.addColorStop(0, "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g; ctx.fillRect(x + 20, y - 3, 300, 6);
          plane(ctx, x, y, 1.15, -1);
        }
      }
    }
  }

  // 아이템
  for (const it of F.lv.items) {
    if (it.taken) continue;
    const x = it.x - camX;
    if (x < -40 || x > W + 40) continue;
    drawItem(ctx, it.kind, x, sy(it.y ?? LANE_Y[it.lane]), F.t);
  }

  // 장애물 3) 먹구름(가끔 번쩍인다), 번개, 회오리
  for (const c of F.lv.clouds) {
    const x = c.x - camX;
    if (x < -90 || x > W + 90) continue;
    stormCloud(ctx, x, sy(c.y) + 4, c.r / 34);
    if (Math.sin(F.t * 2.7 + c.x * 0.01) > 0.93) { ctx.globalAlpha = 0.55; puffCloud(ctx, x, sy(c.y) + 4, c.r / 34, "#fff7c9", "#fff7c9", 2); ctx.globalAlpha = 1; }
  }
  for (const b of F.lv.bolts) {
    const x = b.x - camX;
    if (x < -60 || x > W + 60 || (b.state !== "warn" && b.state !== "strike")) continue;
    const ly = sy(LANE_Y[b.lane]);
    if (b.state === "warn") {                                                  // 내리칠 줄을 노란 띠와 "!"로 알린다
      ctx.save(); ctx.globalAlpha = 0.55 + 0.45 * Math.sin(F.t * 24);
      rr(ctx, x - 42, ly - 84, 84, 168, 34, "rgba(255,220,100,.3)");
      rr(ctx, x - 16, ly - 15, 32, 30, 9, "#ffd166"); ctx.fillStyle = C.ink; ctx.font = `20px ${SANS}`; ctx.textAlign = "center"; ctx.fillText("!", x, ly + 8);
      ctx.restore();
    } else {
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,248,200,.35)"; ctx.lineWidth = 22; path(ctx, () => boltShape(ctx, x, -10, ly + 50, b.x)); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; path(ctx, () => boltShape(ctx, x, -10, ly + 50, b.x)); ctx.stroke();
      blob(ctx, x, ly, 34, "rgba(255,250,210,.5)");
      ctx.restore();
    }
  }
  for (const v of F.lv.vortices) {
    const x = v.x - camX;
    if (x < -100 || x > W + 100) continue;
    tornado(ctx, x, sy(v.y), v.r, F.t);
  }

  // 바닷바람: 부는 동안 오른쪽에서 왼쪽으로 흰 바람 줄기가 흐른다(예고 중에는 옅게)
  if (F.windState !== "none") {
    const a = F.windState === "blow" ? 0.75 : 0.28;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const y = 60 + ((i * 197) % (H - 150));
      const len = 90 + (i % 4) * 40;
      const x = W + 100 - ((F.t * (F.windState === "blow" ? 1100 : 400) + i * 173) % (W + 300));
      path(ctx, () => { ctx.moveTo(x, y); ctx.bezierCurveTo(x + len * 0.3, y - 8, x + len * 0.6, y + 8, x + len, y); }); ctx.stroke();
    }
    ctx.restore();
  }

  // 속도선: 빨라질수록 진하고 길다
  const sp = clamp((F.vx - 330) / 210, 0, 1);
  if (F.mode === "fly" && sp > 0.05) {
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.3 * sp})`; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const y = 40 + ((i * 131) % (H - 110)), len = 40 + sp * 110 + (i % 3) * 20;
      const x = W + 60 - ((F.x * 1.6 + i * 211) % (W + 200));
      path(ctx, () => { ctx.moveTo(x, y); ctx.lineTo(x + len, y); }); ctx.stroke();
    }
    ctx.restore();
  }

  if (F.practice) practiceLabels(ctx, F, camX, sy);

  // 이륙하며 발을 뗀 자리에 흙먼지
  if (F.lift > 0 && F.lift < 0.6) {
    const k = F.lift / 0.6, x = F.takeX + 150 * 0.2 - camX;
    ctx.save(); ctx.globalAlpha = 0.7 * (1 - k);
    for (let i = 0; i < 5; i++) blob(ctx, x - 10 - i * 12 - k * 30 * (i % 2 ? 1 : 0.5), sy(START_TOP + GRASS) - 4 - k * (10 + i * 4), 6 + k * 8 - i, "#f4ead2");
    ctx.restore();
  }

  // 우체부 그림자
  const groundY = F.walkK > 0.3 ? WALK_TOP + (F.groundH || 0) : F.x >= 0.9 * LEN ? ISLAND + GRASS : F.x < 200 ? START_TOP + GRASS : 0;   // 섬 위에서는 잔디 표면에, 하늘길에서는 구름 길 위에 그림자
  const alt = clamp((F.y - groundY) / 400, 0, 1);
  ctx.save();
  ctx.filter = "blur(4px)";
  ctx.fillStyle = `rgba(20,80,120,${0.3 * (1 - alt) + 0.06})`;
  path(ctx, () => ctx.ellipse(SX + 8, sy(groundY) + 2, 24 * (1 - alt * 0.5), 5 * (1 - alt * 0.5), 0, 0, Math.PI * 2)); ctx.fill();
  ctx.restore();

  if (!(F.inv > 0 && Math.floor(F.t * 12) % 2)) postman(ctx, F, sy(F.y));

  // 순풍 리본: 뒤로 하늘색 바람 줄기가 흐른다
  if (F.ribbon > 0) {
    ctx.save(); ctx.strokeStyle = "rgba(190,230,250,.85)"; ctx.lineWidth = 4; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) { const yy = sy(F.y) - 24 + i * 12, len = 50 + ((i * 37) % 40), x0 = SX - 40 - ((F.t * 500 + i * 60) % 80); path(ctx, () => { ctx.moveTo(x0, yy); ctx.lineTo(x0 - len, yy); }); ctx.stroke(); }
    ctx.restore();
  }
  // 깃털 방패: 몸 주위에 투명한 방울(개수만큼 겹)
  for (let i = 0; i < F.guard; i++) {
    ctx.save(); ctx.globalAlpha = F.guardT < 3 && Math.floor(F.t * 8) % 2 ? 0.3 : 1;                  // 사라지기 3초 전부터 깜빡인다
    ctx.strokeStyle = `rgba(255,255,255,${0.9 - i * 0.25})`; ctx.fillStyle = "rgba(190,225,245,.22)"; ctx.lineWidth = 3;
    path(ctx, () => ctx.arc(SX, sy(F.y) - 6, 40 + i * 7, 0, Math.PI * 2)); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (F.hitMark > 0) {                                                              // 연습: 맞은 자리를 붉은 파동과 글자로 짚는다
    const k = 1 - F.hitMark / 1.1;
    ctx.save(); ctx.strokeStyle = `rgba(217,69,44,${1 - k})`; ctx.lineWidth = 6 * (1 - k) + 1;
    path(ctx, () => ctx.arc(SX, sy(F.y) - 4, 22 + k * 60, 0, Math.PI * 2)); ctx.stroke();
    ctx.globalAlpha = 1 - k * 0.6; ctx.font = `22px ${SANS}`; ctx.textAlign = "center"; outlined(ctx, "맞았어요!  ♥ -1", SX, sy(F.y) - 64 - k * 18); ctx.restore();
  }
  if (F.umbrella > 0 && !(F.umbrella < 3 && Math.floor(F.t * 8) % 2)) drawItem(ctx, "umbrella", SX + 4, sy(F.y) - 64, F.t);   // 사라지기 3초 전부터 깜빡인다         // 머리 위의 우산
  if (F.pop) {                                                                      // 아이템을 얻는 순간: 둥근 파동
    const k = 1 - F.pop.t / 0.6;
    ctx.save(); ctx.strokeStyle = F.pop.kind === "orb" ? "rgba(255,214,102,.9)" : "rgba(255,255,255,.9)"; ctx.lineWidth = 4 * (1 - k) + 1; ctx.globalAlpha = 1 - k;
    path(ctx, () => ctx.arc(SX, sy(F.y) - 4, 24 + k * 50, 0, Math.PI * 2)); ctx.stroke(); ctx.restore();
  }

  // 비와 천둥: 하늘이 어두워지고 빗줄기가 비스듬히 내린다
  if (F.rainK > 0.02) {
    ctx.fillStyle = `rgba(48,70,100,${0.3 * F.rainK})`; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(215,232,246,${0.6 * F.rainK})`; ctx.lineWidth = 2; ctx.lineCap = "round";
    path(ctx, () => {
      for (let i = 0; i < 110; i++) {
        const x = ((i * 97 + F.t * 150) % (W + 80)) - 40, y = ((i * 53 + F.t * 860) % (H + 60)) - 30;
        ctx.moveTo(x, y); ctx.lineTo(x - 9, y + 22);
      }
    });
    ctx.stroke();
  }
  if (F.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, F.flash * 2)})`; ctx.fillRect(0, 0, W, H); }

  // 바람 리본: 크림 트랙 위로 차오르는 금빛 진행 표시
  const p = clamp(F.x / LEN, 0, 1);
  const rx = (W - 600) / 2;
  rr(ctx, rx, 16, 600, 10, 5, "rgba(31,74,99,.2)");
  if (p > 0.01) rr(ctx, rx, 16, 600 * p, 10, 5, F.fails === 0 ? `hsl(${lerp(38, 48, p)},95%,${lerp(62, 64, p)}%)` : "#f1a24a");

  // 하트(남은 버팀)와 기억 구슬(모은 개수)
  for (let i = 0; i < MAX_HITS; i++) {
    ctx.fillStyle = i < MAX_HITS - F.hits ? C.red : "rgba(31,74,99,.22)";
    heartPath(ctx, rx + 10 + i * 24, 50, 8); ctx.fill();
  }
  const orbsAll = F.lv.items.filter((it) => it.kind === "orb");
  if (orbsAll.length) orbsAll.forEach((it, i) => blob(ctx, rx + 9 + i * 15, 70, 5.5, it.taken ? "#ffd166" : "rgba(31,74,99,.22)"));
  if (F.combo >= 2) {                                                               // 연속 회피: 방금 피했을 때 크게 튀어 오른다
    const pop = F.comboT > 0.9 ? 1 + (F.comboT - 0.9) * 1.2 : 1;
    ctx.save(); ctx.translate(rx + 600, 56); ctx.scale(pop, pop);
    ctx.font = `bold 22px ${SANS}`; ctx.textAlign = "right"; ctx.fillStyle = F.combo >= 8 ? "#e8553a" : C.ink;
    ctx.fillText(`${F.combo}연속 회피`, 0, 0);
    ctx.restore();
  }

  if (F.brace.on) {                                                                 // 비바람 버티기 게이지: 몸 둘레 고리 + 위쪽 막대
    const g = F.brace.g, low = g < 0.3, col = g > 0.55 ? "#5ec9a7" : g > 0.3 ? "#f1a24a" : "#d9452c";
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(31,74,99,.22)"; ctx.lineWidth = 7;
    path(ctx, () => ctx.arc(SX, sy(F.y) - 4, 50, -Math.PI / 2, Math.PI * 1.5)); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = low ? 8 + Math.sin(F.t * 24) * 2 : 7;
    path(ctx, () => ctx.arc(SX, sy(F.y) - 4, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g)); ctx.stroke();
    rr(ctx, W / 2 - 150, 150, 300, 14, 7, "rgba(31,74,99,.2)");
    rr(ctx, W / 2 - 150, 150, Math.max(8, 300 * g), 14, 7, col);
    ctx.font = `22px ${SANS}`; ctx.textAlign = "center";
    outlined(ctx, low ? (F.touch ? "버튼 연타! 연타!" : "Enter 연타! 연타!") : (F.touch ? "왼쪽 아래 버튼을 연달아 눌러 버텨요" : "Enter를 연달아 눌러 버텨요"), W / 2, 188);
    ctx.restore();
  }

  ctx.restore();

  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.78);
  v.addColorStop(0, "rgba(20,80,130,0)"); v.addColorStop(1, "rgba(20,80,130,.18)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  if (F.mode === "count") {
    ctx.font = `64px ${SANS}`;
    outlined(ctx, String(Math.max(1, Math.ceil(F.cd))), W / 2, 250);
    if (F.showTutorial) {
      ctx.font = `22px ${SANS}`; outlined(ctx, F.touch ? "화면 위쪽을 누르면 위로, 아래쪽을 누르면 아래로 한 줄씩 옮겨요" : "↑ ↓ 키나 화면 위·아래를 눌러 한 줄씩 옮겨요", W / 2, 320);
      ctx.font = `18px ${SANS}`; outlined(ctx, "경고가 뜬 줄을 피하고 구슬과 아이템을 모아요 · 하트가 다 닳면 이 구간만 다시 해요", W / 2, 356);
    }
  }
  if (F.practice && F.mode !== "count") {
    ctx.font = `15px ${SANS}`; ctx.fillStyle = "rgba(31,74,99,.75)"; ctx.textAlign = "right"; ctx.fillText("연습 비행", W - 16, 30);
    if (F.coach) {                                                                  // 하단 안내 상자: 지금 만난 것이 무엇인지, 어디가 위험한지
      ctx.font = `21px ${SANS}`;
      const maxw = Math.min(W - 60, 720), lines = []; let cur = "";
      for (const ch of F.coach.text) { if (ctx.measureText(cur + ch).width > maxw - 48) { lines.push(cur); cur = ch; } else cur += ch; }
      lines.push(cur);
      const bh = 40 + lines.length * 28, by = H - bh - 10;
      ctx.save(); ctx.globalAlpha = Math.min(1, F.coach.t * 2);
      rr(ctx, W / 2 - maxw / 2, by, maxw, bh, 20, "rgba(250,243,230,.95)");
      ctx.fillStyle = C.red; ctx.font = `15px ${SANS}`; ctx.textAlign = "left"; ctx.fillText(`${F.coach.n} / ${F.coach.total}`, W / 2 - maxw / 2 + 22, by + 24);
      ctx.fillStyle = C.ink; ctx.font = `21px ${SANS}`; ctx.textAlign = "center";
      lines.forEach((l, i) => ctx.fillText(l, W / 2, by + 22 + (i + 1) * 28));
      ctx.restore();
    }
  }
  if (F.mode === "fly" && F.windState === "warn") {
    ctx.font = `22px ${SANS}`; outlined(ctx, F.touch ? "비바람이 몰려온다! 버튼 연타 준비" : "비바람이 몰려온다! Enter 준비", W / 2, 180);
  }
  if (F.msgT > 0) {
    ctx.font = `24px ${SANS}`;
    ctx.globalAlpha = Math.min(1, F.msgT);
    outlined(ctx, F.msg, W / 2, 120);
    ctx.globalAlpha = 1;
  }
}
