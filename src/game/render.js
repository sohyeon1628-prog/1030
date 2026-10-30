import { H, SX, LEN, ISLAND, LANE_Y, MAX_HITS } from "./constants.js";
import { lerp, clamp } from "./level.js";

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

// 줄무늬 패턴 (바리케이드 기둥)
let stripe = null;
function stripePattern(ctx) {
  if (stripe) return stripe;
  const c = document.createElement("canvas");
  c.width = c.height = 40;
  const k = c.getContext("2d");
  k.fillStyle = C.cream; k.fillRect(0, 0, 40, 40);
  k.fillStyle = C.red;
  for (const o of [-40, 0, 40]) { k.beginPath(); k.moveTo(o, 40); k.lineTo(o + 20, 40); k.lineTo(o + 60, 0); k.lineTo(o + 40, 0); k.fill(); }
  stripe = ctx.createPattern(c, "repeat");
  return stripe;
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
  const flap = Math.sin(F.t * 14) * (0.2 + 0.4 * thrust);
  const swing = Math.sin(F.t * 9) * 0.18;
  const jacket = F.rev > 0 ? "#a63a28" : "#4f7fb5", jacketLt = F.rev > 0 ? "#c4503a" : "#6f9bd0";
  const skin = "#f6d2b0", pants = "#6b4a3a", boot = "#3d2a22", leather = "#c98a4b", leatherDk = "#a56d33";

  ctx.save();
  ctx.translate(SX, sy);
  ctx.rotate(clamp(-F.vy / 300, -0.5, 0.5) + 0.3);       // 앞으로 숙인 비행 자세
  ctx.scale(0.95, 0.95);

  // 우편 날개: 등 위쪽에서 퍼덕인다 (먼 쪽은 옅게)
  for (const [alpha, off] of [[0.6, 5], [1, 0]]) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(-8 + off, -10);
    ctx.rotate(-1.0 - flap);
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
    ctx.rotate(Math.PI - 0.55 + sw);
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

// 수직으로 솟구치는 상어/고래: 머리가 위(top), 몸은 물속(seaY)에서 올라온다
function creature(ctx, kind, cx, top, seaY, t) {
  const whale = kind === "whale";
  const h = Math.max(80, seaY - top + 26), w = whale ? 54 : 44;
  const [c0, c1] = whale ? ["#5b8bc2", "#3f6ea5"] : ["#8ea4ba", "#6c8299"];
  ctx.save();
  ctx.translate(cx + Math.sin(t * 3 + cx * 0.01) * 3, 0);
  ctx.fillStyle = vg(ctx, top, h, c0, c1);                       // 몸통
  path(ctx, () => { ctx.moveTo(0, top); ctx.bezierCurveTo(w * 0.62, top + h * 0.12, w * 0.58, top + h * 0.7, w * 0.22, top + h); ctx.lineTo(-w * 0.22, top + h); ctx.bezierCurveTo(-w * 0.58, top + h * 0.7, -w * 0.62, top + h * 0.12, 0, top); });
  ctx.fill();
  ctx.fillStyle = "#eef2f6";                                      // 배(오른쪽 절반)
  path(ctx, () => { ctx.moveTo(w * 0.05, top + h * 0.12); ctx.bezierCurveTo(w * 0.56, top + h * 0.22, w * 0.5, top + h * 0.7, w * 0.18, top + h); ctx.lineTo(w * 0.02, top + h); ctx.bezierCurveTo(w * 0.3, top + h * 0.7, w * 0.3, top + h * 0.3, w * 0.05, top + h * 0.12); });
  ctx.fill();
  const ey = top + (whale ? 22 : 16);
  blob(ctx, -w * 0.2, ey, 3.4, "#1f2d3a"); blob(ctx, -w * 0.21, ey - 1.2, 1.1, "#fff");   // 눈
  if (whale) {
    ctx.strokeStyle = "rgba(63,110,165,.35)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) path(ctx, () => { ctx.moveTo(w * 0.1, top + h * (0.3 + i * 0.09)); ctx.lineTo(w * 0.42, top + h * (0.3 + i * 0.09)); }); ctx.stroke();
    ctx.fillStyle = c1; path(ctx, () => ctx.ellipse(-w * 0.55, top + h * 0.45, 18, 7, 0.9, 0, Math.PI * 2)); ctx.fill();   // 가슴지느러미
    for (let i = 0; i < 4; i++) blob(ctx, Math.sin(t * 5 + i) * 5 + (i % 2 ? 7 : -7), top - 10 - i * 8, 3 - i * 0.4, "rgba(200,230,255,.9)");   // 분수
  } else {
    ctx.fillStyle = c1;                                           // 등지느러미, 가슴지느러미
    path(ctx, () => { ctx.moveTo(-w * 0.45, top + h * 0.42); ctx.lineTo(-w * 1.0, top + h * 0.6); ctx.lineTo(-w * 0.4, top + h * 0.64); }); ctx.fill();
    path(ctx, () => { ctx.moveTo(w * 0.45, top + h * 0.5); ctx.lineTo(w * 0.95, top + h * 0.66); ctx.lineTo(w * 0.4, top + h * 0.7); }); ctx.fill();
    ctx.strokeStyle = "#3d4a58"; ctx.lineWidth = 2.2;               // 입과 이빨
    path(ctx, () => { ctx.moveTo(-w * 0.28, top + 30); ctx.quadraticCurveTo(0, top + 40, w * 0.3, top + 28); }); ctx.stroke();
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 5; i++) path(ctx, () => { const x0 = -w * 0.22 + i * w * 0.11; ctx.moveTo(x0, top + 33 + Math.abs(i - 2) * -0.4); ctx.lineTo(x0 + 4, top + 33); ctx.lineTo(x0 + 2, top + 39); }), ctx.fill();
  }
  ctx.restore();
  splash(ctx, cx, seaY, t);
}

function bird(ctx, x, y, s, t, dir = -1) {                      // 날갯짓하는 새(기본 오른쪽, dir=-1이면 왼쪽을 본다)
  const f = Math.sin(t * 10) * 0.8;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  for (const [a, col] of [[-0.3, "#7b93ab"], [0, "#56708a"]]) {
    ctx.save(); ctx.translate(-2, -3); ctx.rotate(-f * 0.9 + a); ctx.fillStyle = col;
    path(ctx, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -16, -20, -12); ctx.quadraticCurveTo(-10, -4, 0, 3); }); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = "#6b86a0"; path(ctx, () => ctx.ellipse(0, 1, 11, 6, 0, 0, Math.PI * 2)); ctx.fill();
  path(ctx, () => { ctx.moveTo(-9, 0); ctx.lineTo(-18, -2); ctx.lineTo(-17, 4); }); ctx.fill();         // 꼬리
  blob(ctx, 10, -2, 5, "#6b86a0");
  ctx.fillStyle = "#f4a63a"; path(ctx, () => { ctx.moveTo(14, -3); ctx.lineTo(20, -1); ctx.lineTo(14, 0); }); ctx.fill();
  blob(ctx, 11.5, -3.5, 1.2, "#1f2d3a");
  ctx.restore();
}

function plane(ctx, x, y, s, dir = 1, angle = 0) {              // 작은 비행기(기본 오른쪽을 본다)
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
  const top = y - r * 1.9, bot = y + r * 1.0;
  for (let i = 0; i < 9; i++) {
    const u = i / 8, yy = top + (bot - top) * u, w = r * (1.1 - 0.85 * u);
    ctx.fillStyle = `rgba(${108 + i * 4},${118 + i * 4},${134 + i * 3},.65)`;
    path(ctx, () => ctx.ellipse(x + Math.sin(t * 4 + i * 0.9) * r * 0.12 * (1 - u * 0.3), yy, w, r * 0.16, 0, 0, Math.PI * 2)); ctx.fill();
  }
  for (let k = 0; k < 10; k++) { const a = t * 5 + k * 0.9; blob(ctx, x + Math.cos(a) * r * (0.5 + 0.3 * Math.sin(k)), y + (k - 5) * r * 0.28, 2.4, "#8a6a4a"); }
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
function practiceLabels(ctx, F, camX, sy, seaY) {
  const W = ctx.canvas.width;
  ctx.save(); ctx.textAlign = "center"; ctx.font = `17px ${SANS}`;
  const tag = (t, x, y) => outlined(ctx, t, x, y);
  for (const it of F.lv.items) {
    if (it.taken) continue;
    const x = it.x - camX; if (x < -40 || x > W + 40) continue;
    tag(ITEM_NAME[it.kind], x, sy(LANE_Y[it.lane]) + 40);
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
      const x = ev.x - camX, lanes = ev.peak > 285 ? [0, 1] : [0];
      ctx.fillStyle = "rgba(232,85,58,.22)";
      for (const l of lanes) ctx.fillRect(x - 60, sy(LANE_Y[l]) - 48, 120, 96);
      tag(`${ev.kind === "shark" ? "상어" : "고래"} 점프! 아래 줄이 위험`, x, sy(LANE_Y[0]) - 62);
    } else tag(`${ev.kind === "birds" ? "새" : "비행기"}: 이 줄이 위험!`, W - 150, sy(ev.y) - 36);
  }
  ctx.restore();
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

  for (let i = 0; i < 6; i++) {
    const span = W + 300;
    const x = (((i * 230 - camX * 0.14 - F.t * 5) % span) + span) % span - 150;
    puffCloud(ctx, x, 90 + (i % 3) * 75 + i * 10, 1 + (i % 2) * 0.35, "#ffffff", "#cfe9f5", 2);
  }

  island(ctx, -camX - 140, 30, 340, { arch: 0, cactus: [[310, 1.1]], bushes: [[24, 1]] });
  island(ctx, 0.9 * LEN - camX, ISLAND, 0.1 * LEN + 560, {
    cactus: [[60, 1], [640, 1.2]], bushes: [[110, 0.9], [600, 1]],
    houses: [[260, 58, 42], [350, 50, 36]], roof: C.teal,
  });

  // 바다: 섬의 아랫부분이 물속에 잠기고, 수면에는 흰 물결이 일렁인다
  const seaY = H - 24;
  const sg = ctx.createLinearGradient(0, seaY, 0, H);
  sg.addColorStop(0, "rgba(79,179,217,.82)"); sg.addColorStop(1, "rgba(38,130,182,.96)");
  ctx.fillStyle = sg; ctx.fillRect(-10, seaY, W + 20, 40);
  ctx.fillStyle = "rgba(255,255,255,.6)";
  path(ctx, () => {
    ctx.moveTo(-10, seaY + 2);
    for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, seaY + Math.sin((x + camX * 0.6 + F.t * 40) * 0.05) * 3);
    for (let x = W + 10; x >= -10; x -= 10) ctx.lineTo(x, seaY + 6 + Math.sin((x + camX * 0.6 + F.t * 40) * 0.05) * 3);
  });
  ctx.fill();

  // 세 줄 안내선: 위·가운데·아래 줄이 어디인지 옅은 점선으로 보인다
  if (F.mode !== "done") {
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.setLineDash([6, 14]);
    for (const ly of LANE_Y) path(ctx, () => { ctx.moveTo(0, sy(ly)); ctx.lineTo(W, sy(ly)); }), ctx.stroke();
    ctx.restore();
  }

  // 갑자기 일어나는 사건: 경고 → 발생
  const lane = (F.mode === "fly") ? 1 : 0;
  for (const ev of F.lv.events) {
    const breach = ev.kind === "shark" || ev.kind === "whale";
    if (ev.state === "tele") {
      const k = 1 - ev.t / F.lv.warn;                                           // 0 → 1
      if (breach) {
        const x = ev.x - camX;
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
        path(ctx, () => { ctx.moveTo(W - 70, y); ctx.lineTo(W - 40, y - 20); ctx.lineTo(W - 40, y + 20); }); ctx.fillStyle = "#e8553a"; ctx.fill();
        rr(ctx, W - 40, y - 20, 34, 40, 9, "#e8553a"); ctx.fillStyle = "#fff"; ctx.font = `24px ${SANS}`; ctx.textAlign = "center"; ctx.fillText("!", W - 23, y + 9);
        ctx.restore();
      }
    } else if (ev.state === "act") {
      if (breach) {
        const x = ev.x - camX;
        if (x < -90 || x > W + 90 || ev.h < 6) continue;
        const top = H - ev.h, t = F.t + ev.seed;
        if (ev.t / 1.7 > 0.55) {                                                // 떨어질 때는 몸이 뒤집혀 꼬리가 위로 보인다
          const h = Math.max(80, seaY - top + 26), cy = top + h / 2;
          ctx.save(); ctx.translate(0, 2 * cy); ctx.scale(1, -1); creature(ctx, ev.kind, x, top, seaY, t); ctx.restore();
        } else creature(ctx, ev.kind, x, top, seaY, t);
        splash(ctx, x, seaY, t);
      } else {
        const x = ev.px - camX;
        if (x < -140 || x > W + 140) continue;
        const y = sy(ev.cy);
        if (ev.kind === "birds") { bird(ctx, x, y, 1.15, F.t + ev.seed, -1); bird(ctx, x + 26, y - 16, 0.95, F.t + ev.seed + 1, -1); bird(ctx, x + 26, y + 16, 0.95, F.t + ev.seed + 2, -1); }
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
    drawItem(ctx, it.kind, x, sy(LANE_Y[it.lane]), F.t);
  }

  // 장애물 3) 먹구름(가끔 번쩍인다), 번개, 회오리
  for (const c of F.lv.clouds) {
    const x = c.x - camX;
    if (x < -90 || x > W + 90) continue;
    puffCloud(ctx, x, sy(c.y) + 4, c.r / 34, "#6f7d8f", "#56627a", 0.8);
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

  if (F.practice) practiceLabels(ctx, F, camX, sy, seaY);

  // 우체부 그림자
  const groundY = F.x >= 0.9 * LEN ? ISLAND : 0;
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
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.9 - i * 0.25})`; ctx.fillStyle = "rgba(190,225,245,.22)"; ctx.lineWidth = 3;
    path(ctx, () => ctx.arc(SX, sy(F.y) - 6, 40 + i * 7, 0, Math.PI * 2)); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (F.hitMark > 0) {                                                              // 연습: 맞은 자리를 붉은 파동과 글자로 짚는다
    const k = 1 - F.hitMark / 1.1;
    ctx.save(); ctx.strokeStyle = `rgba(217,69,44,${1 - k})`; ctx.lineWidth = 6 * (1 - k) + 1;
    path(ctx, () => ctx.arc(SX, sy(F.y) - 4, 22 + k * 60, 0, Math.PI * 2)); ctx.stroke();
    ctx.globalAlpha = 1 - k * 0.6; ctx.font = `22px ${SANS}`; ctx.textAlign = "center"; outlined(ctx, "맞았어요!  ♥ -1", SX, sy(F.y) - 64 - k * 18); ctx.restore();
  }
  if (F.umbrella > 0) drawItem(ctx, "umbrella", SX + 4, sy(F.y) - 64, F.t);         // 머리 위의 우산
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

  ctx.restore();

  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.78);
  v.addColorStop(0, "rgba(20,80,130,0)"); v.addColorStop(1, "rgba(20,80,130,.18)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  if (F.mode === "count") {
    ctx.font = `64px ${SANS}`;
    outlined(ctx, String(Math.max(1, Math.ceil(F.cd))), W / 2, 250);
    if (F.showTutorial) {
      ctx.font = `22px ${SANS}`; outlined(ctx, "↑ ↓ 키나 화면 위·아래를 눌러 한 줄씩 옮겨요", W / 2, 320);
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
    ctx.font = `22px ${SANS}`; outlined(ctx, "바람이 몰려온다!", W / 2, 180);
  }
  if (F.msgT > 0) {
    ctx.font = `24px ${SANS}`;
    ctx.globalAlpha = Math.min(1, F.msgT);
    outlined(ctx, F.msg, W / 2, 120);
    ctx.globalAlpha = 1;
  }
}
