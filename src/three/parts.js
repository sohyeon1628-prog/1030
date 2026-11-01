import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// 지도(World3D)와 오프닝(Intro3D)이 함께 쓰는 3D 부품: 바다, 섬, 우체부, 소품.

// 섬 5개: [0]은 해무의 집(노을섬, 출발점), [1~4]는 편지 1~4의 도착지. 위에서 아래로 굽이치듯 이어진다.
export const ISLANDS = [
  { name: "노을섬", x: 0, z: 0 },
  { name: "하늬섬", x: 6.5, z: 1.5 },
  { name: "마루섬", x: 2.5, z: 6.5 },
  { name: "물결섬", x: 9, z: 8.5 },
  { name: "먼바다섬", x: 4.5, z: 13 },
];
export const CENTER = new THREE.Vector3(4.5, 0, 6.5);
// 편지섬: 내 편지를 쓰는 곳. 이야기 섬 네 개와 따로 두고(ISLANDS에 넣으면 오프닝·안개 계산이 달라진다), 네 통을 모두 전하면 열린다.
// 마지막 섬(먼바다섬) 곁에 둬서 이야기가 끝난 뒤의 다음 행선지처럼 보이게 한다.
export const POST_ISLAND = { name: "편지섬", x: -0.6, z: 13.2 };

export const mat = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.78, metalness: 0, ...o });
export function box(w, h, d, r, hex, x = 0, y = 0, z = 0, o) {
  const rad = Math.max(0.005, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, rad), mat(hex, o));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function mesh(geo, hex, x = 0, y = 0, z = 0, o) {
  const m = new THREE.Mesh(geo, mat(hex, o));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export const add = (g, ...ms) => { ms.forEach((m) => g.add(m)); return g; };

// 위·아래가 둥글게 말린 원반 (섬의 층). 프로필을 회전시켜 만든다.
export function puck(r, h, rad, hex, x = 0, y = 0, z = 0) {
  rad = Math.min(rad, r * 0.9, h / 2);
  const n = 6, pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r - rad, 0)];
  for (let i = 1; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(r - rad + Math.cos(a) * rad, rad + Math.sin(a) * rad)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(r - rad + Math.cos(a) * rad, h - rad + Math.sin(a) * rad)); }
  pts.push(new THREE.Vector2(0, h));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), mat(hex, { side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  return m;
}
export function palm(x, z, y = 0, s = 1) {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.75, 10), "#b88a5a", 0, 0.37, 0); trunk.rotation.z = 0.15; g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const leaf = mesh(new THREE.SphereGeometry(1, 14, 8), i % 2 ? "#5fae45" : "#6dbb4d", 0, 0, 0);
    leaf.scale.set(0.34, 0.045, 0.11);
    const pivot = new THREE.Group(); pivot.position.set(0.1, 0.76, 0); pivot.rotation.y = (i / 5) * Math.PI * 2;
    leaf.position.x = 0.3; leaf.rotation.z = -0.35; pivot.add(leaf); g.add(pivot);
  }
  g.position.set(x, y, z); g.scale.setScalar(s);
  return g;
}
export function bush(x, z, y = 0, s = 1) {
  const g = new THREE.Group();
  [[-0.14, 0.14, 0.02, 0.2, "#6b9a2a"], [0.14, 0.17, -0.02, 0.23, "#7aab33"], [0, 0.26, 0, 0.18, "#86b83a"]]
    .forEach(([a, b, c, r, hex]) => g.add(mesh(new THREE.SphereGeometry(r, 18, 14), hex, a, b, c)));
  g.position.set(x, y, z); g.scale.setScalar(s);
  return g;
}
// 항로가 끊겨 있음을 알리는 부표 (배달하면 사라진다)
export function buoy(x, z) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.2, 20, 14), "#e8553a", 0, 0.12, 0));
  const ring = mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 24), "#faf3e6", 0, 0.14, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), "#efe3cd", 0, 0.42, 0), mesh(new THREE.SphereGeometry(0.05, 8, 6), "#e8553a", 0, 0.6, 0));
  g.position.set(x, 0, z);
  return g;
}
export function boat(hull) {
  const g = new THREE.Group();
  g.add(box(1.0, 0.22, 0.4, 0.11, hull, 0, -0.04));
  g.add(box(0.96, 0.05, 0.36, 0.02, "#faf3e6", 0, 0.16));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8), "#efe3cd", 0.05, 0.62, 0));
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 0.8); sh.lineTo(0.5, 0);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat("#ffffff", { side: THREE.DoubleSide, roughness: 0.9 }));
  sail.position.set(0.08, 0.2, 0); sail.castShadow = true; g.add(sail);
  return g;
}

// 편지 가방을 멘 우체부 (+x 방향으로 날아간다). 장난감 비율: 큰 머리, 짧은 팔다리, 앞으로 숙인 비행 자세.
// elder: 선배 해무(흰 콧수염과 흰 머리카락). 등의 작은 우편 날개가 퍼덕인다(animatePostman).
export function makePostman({ elder = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.z = -0.42;                       // 앞으로 숙인 자세
  g.add(body);
  // 해무(elder)는 나와 한눈에 구분되도록 옷 색을 완전히 다르게 입는다: 나는 빨간 모자와 파란 옷, 해무는 짙은 초록 모자와 코트에 금빛 띠
  const pal = elder
    ? { jacket: "#2f6b50", cap: "#24493a", brim: "#183a2d", band: "#f2d98a", scarf: "#f2c94c", badge: "#fff3b0", bag: "#7a5a3a" }
    : { jacket: "#4f7fb5", cap: "#d9452c", brim: "#b8341f", band: "#faf3e6", scarf: "#e8553a", badge: "#ffd166", bag: "#c98a4b" };
  const jacket = pal.jacket, skin = elder ? "#efc9a6" : "#f6d2b0", leather = pal.bag;
  const arms = [], legs = [], wings = [];

  // 몸통 + 스카프 + 허리띠
  body.add(mesh(new THREE.CapsuleGeometry(0.23, 0.32, 8, 16), jacket, 0, 0.1, 0));
  const scarf = mesh(new THREE.TorusGeometry(0.2, 0.06, 10, 24), pal.scarf, 0, 0.4, 0); scarf.rotation.x = Math.PI / 2; body.add(scarf);
  const belt = mesh(new THREE.TorusGeometry(0.235, 0.035, 8, 28), "#3d2a22", 0, -0.04, 0); belt.rotation.x = Math.PI / 2; body.add(belt);

  // 머리: 큰 둥근 얼굴, 우체부 모자(챙이 앞), 눈·코·볼·콧수염
  const head = new THREE.Group(); head.position.set(0.04, 0.8, 0); body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.31, 28, 20), skin));
  head.add(mesh(new THREE.SphereGeometry(0.335, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), pal.cap, 0, 0.07, 0));
  const band = mesh(new THREE.TorusGeometry(0.325, 0.03, 8, 32), pal.band, 0, 0.07, 0); band.rotation.x = Math.PI / 2; head.add(band);
  head.add(box(0.3, 0.045, 0.42, 0.02, pal.brim, 0.3, 0.05, 0));
  const badge = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), pal.badge, 0.335, 0.2, 0); badge.rotation.z = Math.PI / 2; head.add(badge);
  [-1, 1].forEach((z) => {
    head.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), "#2b1d1a", 0.27, 0.0, z * 0.12));
    head.add(mesh(new THREE.SphereGeometry(0.015, 8, 6), "#ffffff", 0.305, 0.02, z * 0.115));
    const ch = mesh(new THREE.SphereGeometry(0.05, 10, 8), "#f4a58a", 0.24, -0.1, z * 0.2); ch.scale.set(0.5, 0.8, 1); head.add(ch);
    if (elder) head.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), "#f1ece4", -0.06, -0.08, z * 0.28));
  });
  head.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), elder ? "#e8b896" : "#f0b894", 0.31, -0.07, 0));
  head.add(box(0.06, elder ? 0.07 : 0.045, elder ? 0.3 : 0.22, 0.02, elder ? "#f1ece4" : "#6b4a3a", 0.28, -0.2, 0));
  g.userData.head = head;

  // 편지 가방: 옆구리에 메고 어깨끈이 가슴을 가로지른다. 편지가 삐죽 나와 있다
  const strap = mesh(new THREE.TorusGeometry(0.245, 0.035, 8, 32), "#8a5a2b", 0, 0.14, 0); strap.rotation.set(Math.PI / 2, 0.5, 0.0); body.add(strap);
  body.add(box(0.38, 0.3, 0.15, 0.06, leather, -0.04, -0.2, 0.26));
  body.add(box(0.4, 0.12, 0.17, 0.05, "#a56d33", -0.04, -0.02, 0.26));
  body.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), "#ffd166", 0.08, -0.04, 0.35));
  const mail = box(0.2, 0.025, 0.12, 0.01, "#faf3e6", -0.12, 0.08, 0.27); mail.rotation.z = 0.5; body.add(mail);

  // 팔(앞으로 쭉), 다리(뒤로 휘날림), 우편 날개(작고 둥글게)
  [-1, 1].forEach((z) => {
    const ad = [0.955, 0.296], sh = [0.08, 0.3];
    const a = mesh(new THREE.CapsuleGeometry(0.075, 0.28, 6, 10), jacket, sh[0] + ad[0] * 0.22, sh[1] + ad[1] * 0.22, z * 0.27);
    a.rotation.z = -(Math.PI / 2 - 0.3); body.add(a); arms.push({ m: a, base: a.rotation.z });
    body.add(mesh(new THREE.SphereGeometry(0.095, 12, 10), "#faf3e6", sh[0] + ad[0] * 0.46, sh[1] + ad[1] * 0.46, z * 0.27));
    const ld = [-0.92, -0.39], hip = [-0.02, -0.2];
    const l = mesh(new THREE.CapsuleGeometry(0.085, 0.3, 6, 10), z < 0 ? "#58392b" : "#6b4a3a", hip[0] + ld[0] * 0.24, hip[1] + ld[1] * 0.24, z * 0.12);
    l.rotation.z = Math.PI / 2 + 0.4; body.add(l); legs.push({ m: l, base: l.rotation.z });
    body.add(mesh(new THREE.SphereGeometry(0.115, 12, 10), "#3d2a22", hip[0] + ld[0] * 0.5, hip[1] + ld[1] * 0.5, z * 0.12));
    const pivot = new THREE.Group(); pivot.position.set(-0.22, 0.42, z * 0.06);
    const wing = mesh(new THREE.SphereGeometry(1, 20, 12), "#ffffff", -0.1, 0.02, z * 0.3, { roughness: 0.9 });
    wing.scale.set(0.2, 0.035, 0.3); wing.rotation.y = z * 0.35; pivot.add(wing);
    const tip = mesh(new THREE.SphereGeometry(1, 16, 10), "#efe3cd", -0.16, 0.0, z * 0.5, { roughness: 0.9 });
    tip.scale.set(0.12, 0.03, 0.18); tip.rotation.y = z * 0.35; pivot.add(tip);
    body.add(pivot); wings.push({ pivot, s: z });
  });
  g.userData.arms = arms; g.userData.legs = legs; g.userData.wings = wings;
  g.scale.setScalar(0.78);
  return g;
}

// 우체부의 날갯짓·팔다리 움직임. thrust(0~1)가 클수록 날개가 크게 퍼덕인다.
export function animatePostman(pm, T, thrust = 0.6) {
  const u = pm.userData;
  const flap = Math.sin(T * 14) * (0.3 + 0.35 * thrust);
  u.wings.forEach(({ pivot, s }) => { pivot.rotation.x = s * (0.45 + flap); });
  u.legs.forEach((l, k) => { l.m.rotation.z = l.base + Math.sin(T * 9 + k * 2) * 0.18; });
  u.arms.forEach((a, k) => { a.m.rotation.z = a.base + Math.sin(T * 6 + k) * 0.06; });
  u.head.rotation.z = Math.sin(T * 3) * 0.04;
}


// 섬마다 다른 집: 0 굴뚝 있는 오두막(해무의 집), 1 박공지붕 통나무집, 2 등대 탑, 3 둥근 돔 집, 4 원뿔 지붕의 둥근 오두막.
// roof는 상태 색(배달 완료 청록 / 다음 배달 빨강 / 잠김 회색)이고, 각 집의 지붕이나 포인트에 쓴다.
// 집마다 지붕과 벽 색이 다르다(모양은 그대로, 색만 다양하게).
const HOUSE_PAL = [
  { roof: "#e8553a", wall: "#fff1d6" }, { roof: "#3f8fd2", wall: "#f2c36b" }, { roof: "#7a5bc7", wall: "#fdfaf2", band: "#5aa3d4" },
  { roof: "#f59a4a", wall: "#bfe8d8" }, { roof: "#2fa08a", wall: "#f8c8d4" },
];
function addHouse(g, style) {
  const { roof, wall, band } = HOUSE_PAL[style % HOUSE_PAL.length];
  const hx = -0.15, hz = -0.1, y0 = 0.58;
  const door = (x, z, h = 0.38, w = 0.22, rot = 0) => { const d = box(w, h, 0.05, 0.02, "#a5603a", x, y0, z); d.rotation.y = rot; g.add(d); };
  if (style === 0) {                                              // 오두막 + 굴뚝
    g.add(box(0.9, 0.7, 0.9, 0.12, wall, hx, y0, hz), box(1.1, 0.3, 1.1, 0.14, roof, hx, y0 + 0.68, hz));
    door(hx, hz + 0.46); g.add(box(0.05, 0.22, 0.24, 0.02, "#7ea6d4", 0.3, y0 + 0.37, hz));
    g.add(box(0.16, 0.4, 0.16, 0.04, "#b9a58a", 0.2, 1.4, -0.35));
  } else if (style === 1) {                                       // 박공지붕 통나무집
    g.add(box(0.95, 0.55, 0.85, 0.08, wall, hx, y0, hz));
    [-1, 1].forEach((sd) => {                                     // 두 장의 지붕판이 용마루에서 만난다(^자: 안쪽이 높고 바깥쪽이 처마)
      const slab = box(1.15, 0.07, 0.62, 0.03, roof, hx, y0 + 0.74, hz + sd * 0.27);
      slab.rotation.x = sd * 0.72; g.add(slab);
    });
    const tri = new THREE.Shape(); tri.moveTo(-0.43, 0); tri.lineTo(0.43, 0); tri.lineTo(0, 0.4);
    const gab = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat(wall, { side: THREE.DoubleSide }));
    gab.position.set(hx + 0.49, y0 + 0.55, hz); gab.rotation.y = Math.PI / 2; g.add(gab);
    door(hx, hz + 0.43, 0.36, 0.2); g.add(box(0.05, 0.2, 0.2, 0.02, "#7ea6d4", hx + 0.5, y0 + 0.2, hz));
  } else if (style === 2) {                                       // 등대 탑
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.25, 20), wall, hx, y0 + 0.62, hz));
    g.add(mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.2, 20), band || "#e8553a", hx, y0 + 0.5, hz));
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 20), "#8c7a63", hx, y0 + 1.27, hz));
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16), "#fff3b0", hx, y0 + 1.34, hz, { emissive: "#ffd166", emissiveIntensity: 0.5 }));
    g.add(mesh(new THREE.ConeGeometry(0.3, 0.3, 20), roof, hx, y0 + 1.76, hz));
    door(hx, hz + 0.36, 0.34, 0.18);
  } else if (style === 3) {                                       // 둥근 돔 집
    g.add(mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.42, 24), wall, hx, y0 + 0.21, hz));
    g.add(mesh(new THREE.SphereGeometry(0.64, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), roof, hx, y0 + 0.42, hz));
    g.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), "#ffd166", hx, y0 + 1.07, hz));
    door(hx, hz + 0.6, 0.34, 0.2, 0);
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), "#7ea6d4", hx + 0.5, y0 + 0.3, hz + 0.18).rotateZ(Math.PI / 2));
  } else {                                                        // 원뿔 지붕의 둥근 오두막
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.5, 20), wall, hx, y0 + 0.25, hz));
    g.add(mesh(new THREE.ConeGeometry(0.78, 0.62, 20), roof, hx, y0 + 0.81, hz));
    door(hx, hz + 0.5, 0.34, 0.2); g.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), "#ffd166", hx, y0 + 1.15, hz));
  }
}

// 바다 위에 떠 있는 둥근 섬 하나 (바위 → 모래 → 잔디 층, 가장자리에 물거품)

// 편지섬의 우체국: 빨간 박공지붕 건물, 깃발, 커다란 빨간 우체통. 편지를 쓰러 오는 곳이라 이야기 섬의 집들보다 눈에 띄게 만든다.
function addPostOffice(g) {
  const hx = -0.15, hz = -0.1, y0 = 0.58;
  g.add(box(1.0, 0.6, 0.86, 0.1, "#fff1d6", hx, y0, hz));
  [-1, 1].forEach((sd) => {
    const slab = box(1.2, 0.08, 0.64, 0.03, "#e8553a", hx, y0 + 0.78, hz + sd * 0.28);
    slab.rotation.x = sd * 0.72; g.add(slab);
  });
  g.add(box(0.22, 0.38, 0.05, 0.02, "#a5603a", hx, y0, hz + 0.45), box(0.05, 0.2, 0.2, 0.02, "#7ea6d4", hx + 0.52, y0 + 0.22, hz));
  g.add(box(0.5, 0.14, 0.04, 0.02, "#fff7e0", hx, y0 + 0.5, hz + 0.46));                       // 문 위 간판
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), "#efe3cd", hx - 0.5, y0 + 0.9, hz - 0.3));   // 깃대와 깃발
  g.add(box(0.3, 0.17, 0.03, 0.02, "#e8553a", hx - 0.35, y0 + 1.25, hz - 0.3));
  // 우체통: 빨간 몸통, 둥근 윗면, 편지 넣는 틈
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), "#8c7a63", 0.62, y0 + 0.15, 0.5));
  g.add(box(0.34, 0.3, 0.26, 0.07, "#d9452c", 0.62, y0 + 0.3, 0.5));
  const dome = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 16, 1, false, 0, Math.PI), "#d9452c", 0.62, y0 + 0.6, 0.5);
  dome.rotation.z = Math.PI / 2; dome.rotation.y = Math.PI / 2; g.add(dome);
  g.add(box(0.2, 0.03, 0.03, 0.01, "#3d2a22", 0.62, y0 + 0.5, 0.64));
}

// 바다 위에 떠 있는 둥근 섬 하나 (바위 → 모래 → 잔디 층, 가장자리에 물거품)
export function buildIsland({ x, z, roof = "#d9d2c3", grade = false, locked = false, arch = false, home = false, style = 0, stop = -1 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(puck(1.5, 1.1, 0.5, "#b9a58a", 0, -0.8, 0));
  g.add(puck(1.45, 0.4, 0.2, "#f2e2bd", 0, -0.06, 0));
  g.add(puck(1.15, 0.3, 0.15, "#a5d65a", 0, 0.28, 0));
  if (style === "post") addPostOffice(g); else addHouse(g, style, roof);
  g.add(palm(0.7, -0.55, 0.58, 1.2), bush(-0.8, 0.65, 0.58));
  if (grade) g.add(box(0.36, 0.3, 0.36, 0.08, "#5ec9a7", 0.65, 0.58, 0.6));
  if (arch) {   // 출발 섬: START 아치
    g.add(box(0.12, 1.0, 0.12, 0.04, "#efe3cd", -1.0, 0.58, -0.75), box(0.12, 1.0, 0.12, 0.04, "#efe3cd", -1.0, 0.58, 0.75));
    g.add(box(0.2, 0.4, 1.9, 0.1, "#e8553a", -1.0, 1.48, 0));
    const c = document.createElement("canvas"); c.width = 256; c.height = 80;
    const k = c.getContext("2d"); k.fillStyle = "#fff"; k.font = "800 52px sans-serif"; k.textAlign = "center"; k.fillText("START", 128, 58);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.31), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    t.position.set(-0.89, 1.68, 0); t.rotation.y = Math.PI / 2; g.add(t);
  }
  const foam = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.9, 56), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.05; foam.name = "foam"; g.add(foam);
  if (locked) g.traverse((o) => { if (o.material?.color && o.name !== "foam") o.material.color.lerp(new THREE.Color("#a8b4bd"), 0.5); });
  g.traverse((o) => { o.userData.stop = stop; });
  return g;
}

// 유리병 편지: 몸통이 +y 방향이고 병목과 코르크가 위쪽이다(누이면 rotation.z = -π/2로 병목이 +x를 향한다).
// userData: cork(마개, 뽑으면 날아간다), scroll(병 속에 말려 든 편지). 크기는 약 높이 1.15.
export function makeBottle() {
  const g = new THREE.Group();
  const glass = { transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0, emissive: "#9fe0c8", emissiveIntensity: 0.18, side: THREE.DoubleSide };
  const body = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.62, 22), "#bfe9d8", 0, 0, 0, glass); body.castShadow = false;
  const shoulder = mesh(new THREE.SphereGeometry(0.13, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), "#bfe9d8", 0, 0.31, 0, glass); shoulder.castShadow = false;
  const neck = mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.3, 16), "#bfe9d8", 0, 0.5, 0, glass); neck.castShadow = false;
  const lip = mesh(new THREE.TorusGeometry(0.062, 0.02, 8, 18), "#cfeee0", 0, 0.66, 0, { transparent: true, opacity: 0.6 }); lip.rotation.x = Math.PI / 2;
  const cork = mesh(new THREE.CylinderGeometry(0.052, 0.045, 0.14, 14), "#c9a06a", 0, 0.69, 0);
  const scroll = new THREE.Group();                                           // 병 속에 든 편지: 돌돌 말린 종이와 리본
  scroll.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.46, 14), "#f3e3b8", 0, 0, 0), mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 16), "#e8553a", 0, 0.05, 0));
  scroll.children[1].rotation.x = Math.PI / 2; scroll.position.set(0, 0.12, 0); scroll.rotation.z = 0.08;
  g.add(body, shoulder, neck, lip, scroll, cork);
  g.userData.cork = cork; g.userData.scroll = scroll;
  return g;
}

// 해무가 사랑하는 사람들에게 쓴 편지 (봉투). 오프닝에서 서랍 위로 떠오른다.
export function makeEnvelope() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.05, 0.34, 0.02, "#faf3e6"));
  const flap = box(0.5, 0.02, 0.17, 0.01, "#efe3cd", 0, 0.05, -0.085); flap.rotation.x = 0.0; g.add(flap);
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), "#e8553a", 0, 0.07, 0));
  return g;
}

export function waterTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const k = c.getContext("2d");
  k.fillStyle = "#4db4da"; k.fillRect(0, 0, 256, 256);
  k.strokeStyle = "rgba(255,255,255,.28)"; k.lineWidth = 3; k.lineCap = "round";
  for (let i = 0; i < 16; i++) {
    const x = (i * 97) % 256, y = (i * 61) % 256;
    k.beginPath(); k.moveTo(x, y); k.quadraticCurveTo(x + 14, y - 8, x + 28, y); k.quadraticCurveTo(x + 42, y + 8, x + 56, y); k.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(22, 22); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}



// ───────── 구름이 덮은 바다 / 이어지는 다리 / 확장되는 땅 ─────────
// ───── 안개: 가로로 번지는 얇고 투명한 안개 텍스처. 윤곽 없이 풀어지고, 겹칠수록 짙어진다 ─────
const fogTex = [];
function fogTexture(seed) {
  if (fogTex[seed]) return fogTex[seed];
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const k = c.getContext("2d"), img = k.createImageData(N, N);
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c2 = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  };
  const fbm = (x, y) => { let a = 0.5, s = 0, f = 1; for (let o = 0; o < 5; o++) { s += a * noise(x * f, y * f); f *= 2; a *= 0.5; } return s; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nx = (x / N - 0.5) * 2, ny = (y / N - 0.5) * 2;
    const edge = (v) => { const t = Math.max(0, Math.min(1, (Math.abs(v) - 0.55) / 0.45)); return 1 - t * t * (3 - 2 * t); };
    const fall = Math.exp(-(nx * nx * 1.5 + ny * ny * 3.4)) * edge(nx) * edge(ny);   // 가로로 긴 타원. 테두리는 완전히 투명해서 조각의 경계가 보이지 않는다
    const d = fbm((x / N) * 2.2 + seed * 3.1, (y / N) * 7.0);                // 가로 결의 노이즈(가로로 번지는 안개)
    const alpha = Math.min(1, fall * (0.28 + d * 1.05));
    const v = 232 + (d - 0.5) * 34;
    const i = (y * N + x) * 4;
    img.data[i] = v - 4; img.data[i + 1] = v + 2; img.data[i + 2] = v + 8;
    img.data[i + 3] = Math.round(alpha * 255);
  }
  k.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (fogTex[seed] = t);
}

// 안개 조각 하나. 아직 열리지 않은 구역을 빈틈없이 덮도록 겹쳐 깔아서 쓴다.
export function makeFog(seed, opacity) {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTexture(seed % 3), transparent: true, opacity, depthWrite: false, color: "#f1f5f9" }));
}

// 두 섬을 잇는 나무다리. planks에 널빤지와 말뚝이 순서대로 들어 있어 하나씩 나타나게 할 수 있다.
export function makeBridge(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const start = 1.75, end = len - 1.75, n = Math.max(4, Math.floor((end - start) / 0.5));
  const g = new THREE.Group(), items = [];
  const yaw = Math.atan2(-dz, dx);
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n, t = start + (end - start) * f;
    const x = a.x + ux * t, z = a.z + uz * t, y = 0.3 + Math.sin(Math.PI * f) * 0.3;
    const plank = box(0.5, 0.07, 0.6, 0.02, i % 2 ? "#c98a4b" : "#b97a3e", x, y, z);
    plank.rotation.y = yaw; g.add(plank); items.push(plank);
    if (i % 3 === 0) [-1, 1].forEach((sd) => {
      const post = box(0.06, 0.32, 0.06, 0.02, "#8a5a2b", x - uz * 0.36 * sd, y + 0.05, z + ux * 0.36 * sd);
      g.add(post); items.push(post);
    });
  }
  return { group: g, items };
}

// 섬이 확장된 모습: 더 넓은 모래톱과 잔디, 새 야자수와 덤불, 작은 집
export function makeExtras() {
  const g = new THREE.Group();
  g.add(puck(2.15, 0.3, 0.14, "#f2e2bd", 0, -0.1, 0));
  g.add(puck(1.75, 0.22, 0.1, "#a5d65a", 0, 0.1, 0));
  g.add(palm(1.5, 0.5, 0.32, 1.0), palm(-1.4, -0.9, 0.32, 0.9), bush(1.2, -1.45, 0.32), bush(-1.6, 0.5, 0.32, 0.8));
  g.add(box(0.5, 0.45, 0.5, 0.08, "#faf3e6", -1.3, 0.32, 1.0), box(0.64, 0.2, 0.64, 0.1, "#5ec9a7", -1.3, 0.77, 1.0));
  g.traverse((o) => { o.userData.stop = -1; });
  return g;
}

// 바다에 새로 솟아난 작은 섬
export function makeIslet() {
  const g = new THREE.Group();
  g.add(puck(0.85, 0.6, 0.22, "#b9a58a", 0, -0.5, 0), puck(0.8, 0.28, 0.12, "#f2e2bd", 0, -0.06, 0), puck(0.58, 0.2, 0.1, "#a5d65a", 0, 0.18, 0));
  g.add(palm(0.1, 0.0, 0.36, 0.85), bush(-0.35, 0.25, 0.36, 0.7));
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 40), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.05; g.add(foam);
  return g;
}


// ───────── 바다의 생물: 갈매기와 돌고래 ─────────
// 갈매기(+x 방향으로 난다). 날개가 퍼덕이고, 몸이 기울어 선회한다.
export function makeGull() {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(1, 16, 12), "#ffffff", 0, 0, 0); body.scale.set(0.34, 0.12, 0.13); g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), "#ffffff", 0.3, 0.03, 0));
  const beak = mesh(new THREE.ConeGeometry(0.03, 0.12, 8), "#f4a63a", 0.42, 0.02, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  [-1, 1].forEach((z) => g.add(mesh(new THREE.SphereGeometry(0.014, 6, 5), "#2b1d1a", 0.34, 0.06, z * 0.06)));
  const tail = mesh(new THREE.ConeGeometry(0.08, 0.2, 4), "#e6ecf2", -0.36, 0, 0); tail.rotation.z = Math.PI / 2; tail.scale.z = 0.6; g.add(tail);
  const wings = [];
  [-1, 1].forEach((z) => {
    const pivot = new THREE.Group(); pivot.position.set(0.02, 0.04, z * 0.07);
    const w = mesh(new THREE.BoxGeometry(0.2, 0.018, 0.5), "#ffffff", -0.04, 0, z * 0.25); w.rotation.y = z * -0.25; pivot.add(w);
    const tip = mesh(new THREE.BoxGeometry(0.16, 0.016, 0.16), "#8d99a6", -0.1, 0, z * 0.55); tip.rotation.y = z * -0.25; pivot.add(tip);
    g.add(pivot); wings.push({ pivot, s: z });
  });
  g.userData.wings = wings;
  g.traverse((o) => { o.castShadow = true; });
  return g;
}
export function animateGull(g, T, ph = 0) {
  const f = Math.sin(T * 8 + ph) * 0.65;
  g.userData.wings.forEach(({ pivot, s }) => { pivot.rotation.x = s * (0.15 + f); });
}

// 돌고래(+x 방향으로 헤엄친다). 수면에서 뛰어올랐다 잠수한다.
export function makeDolphin() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.17, 0.62, 8, 14), "#7b9db5", 0, 0, 0); body.rotation.z = Math.PI / 2; g.add(body);
  const belly = mesh(new THREE.CapsuleGeometry(0.15, 0.55, 8, 12), "#e8f0f5", 0.02, -0.06, 0); belly.rotation.z = Math.PI / 2; belly.scale.set(1, 1, 0.92); g.add(belly);
  const beak = mesh(new THREE.CapsuleGeometry(0.055, 0.2, 6, 10), "#8fb0c6", 0.6, -0.04, 0); beak.rotation.z = Math.PI / 2; g.add(beak);
  const dorsal = mesh(new THREE.ConeGeometry(0.12, 0.26, 4), "#6b8ca4", -0.05, 0.22, 0); dorsal.rotation.z = 0.35; dorsal.scale.z = 0.35; g.add(dorsal);
  [-1, 1].forEach((z) => {
    const fin = mesh(new THREE.ConeGeometry(0.07, 0.24, 4), "#6b8ca4", 0.2, -0.14, z * 0.17); fin.rotation.set(z * 0.9, 0, 1.1); fin.scale.z = 0.4; g.add(fin);
    g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), "#1f2d3a", 0.45, 0.05, z * 0.13));
  });
  const fluke = new THREE.Group(); fluke.position.set(-0.6, 0, 0);
  const fl = mesh(new THREE.SphereGeometry(1, 12, 8), "#6b8ca4", -0.08, 0, 0); fl.scale.set(0.12, 0.03, 0.26); fluke.add(fl);
  g.add(fluke);
  g.userData.fluke = fluke;
  g.traverse((o) => { o.castShadow = true; });
  return g;
}


// 물고기(+x 방향). 떼를 지어 헤엄치는 작은 물고기.
export function makeFish(c1, c2) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(1, 14, 10), c1, 0, 0, 0); body.scale.set(0.26, 0.11, 0.08); g.add(body);
  const belly = mesh(new THREE.SphereGeometry(1, 12, 8), "#fff3dc", 0.01, -0.03, 0); belly.scale.set(0.22, 0.06, 0.07); g.add(belly);
  const tail = new THREE.Group(); tail.position.set(-0.24, 0, 0);
  const t = mesh(new THREE.ConeGeometry(0.1, 0.18, 4), c2, -0.06, 0, 0); t.rotation.z = Math.PI / 2; t.scale.z = 0.3; tail.add(t);
  g.add(tail);
  g.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 4), c2, 0, 0.1, 0));
  [-1, 1].forEach((z) => g.add(mesh(new THREE.SphereGeometry(0.018, 6, 5), "#1f2d3a", 0.2, 0.025, z * 0.06)));
  g.userData.tail = tail;
  return g;
}

// 바다거북(+x 방향). 수면 가까이에서 느리게 노를 젓는다.
export function makeTurtle() {
  const g = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(1, 18, 12), "#6b9a5a", 0, 0, 0); shell.scale.set(0.46, 0.17, 0.38); g.add(shell);
  const top = mesh(new THREE.SphereGeometry(1, 16, 10), "#8ab56e", 0, 0.05, 0); top.scale.set(0.38, 0.1, 0.3); g.add(top);
  g.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), "#a8c98a", 0.5, 0.02, 0));
  [-1, 1].forEach((z) => g.add(mesh(new THREE.SphereGeometry(0.02, 6, 5), "#1f2d3a", 0.58, 0.07, z * 0.07)));
  const flippers = [];
  [[0.25, 1], [0.25, -1], [-0.25, 1], [-0.25, -1]].forEach(([x, z], i) => {
    const f = mesh(new THREE.SphereGeometry(1, 10, 8), "#8ab56e", x, -0.02, z * 0.38); f.scale.set(0.2, 0.035, 0.1); f.rotation.y = z * (x > 0 ? -0.6 : 0.4);
    g.add(f); flippers.push({ f, z, front: x > 0, base: f.rotation.y });
  });
  g.add(mesh(new THREE.ConeGeometry(0.05, 0.14, 4), "#6b9a5a", -0.5, 0, 0).rotateZ(Math.PI / 2));
  g.traverse((o) => { o.castShadow = true; });
  g.userData.flippers = flippers;
  return g;
}
