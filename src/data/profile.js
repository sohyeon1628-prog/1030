import { FLIGHT_BY_GAP, FLIGHT_COMMON } from "./story.js";

// "나의 이야기": 플레이어가 주인공이 되어 이름, 사는 섬, 사랑하는 네 사람과 그들에게 못 한 말을 정한다.
// 이 입력으로 오프닝 자막, 네 통의 편지, 섬의 대답, 바람 세기, 에필로그가 만들어진다.

// 처음에 고를 수 있는 사랑하는 사람 여섯 종류(이 중 네 명을 고른다). 연인·은사·직접 입력은 예전 저장본과의 호환을 위해 아래 기본값에만 남겨 둔다.
export const RELATIONS = ["어머니", "아버지", "형제", "친구", "반려동물", "자녀"];

// 마지막으로 이야기한 때 → 그 구간의 바람 세기(오래될수록 거셈)
export const GAP_OPTIONS = [
  { id: "day", label: "어제", ws: 1 },
  { id: "month", label: "한 달 전", ws: 1 },
  { id: "year", label: "일 년 전", ws: 2 },
  { id: "lost", label: "기억나지 않음", ws: 3 },
];

const TITLES = ["첫 안부", "늦은 답장", "서툰 마음", "마지막 편지"];
// 관계마다 장 제목이 다르다. 없는 관계는 장 순서대로 위 제목을 쓴다.
const TITLE_BY_RELATION = {
  어머니: "창가의 안부", 아버지: "말없는 어깨", 친구: "늦은 답장", 연인: "서툰 마음", 은사: "교실의 창가",
  형제: "한 이불의 밤", 형제자매: "한 이불의 밤", 반려동물: "꼬리 흔드는 현관", 자녀: "작은 응원", 딸: "작은 응원", 아내: "선착장의 손짓", "직접 입력": "전하지 못한 말",
};

// 처음 켰을 때 미리 채워져 있는 예시 구성. 그대로 시작해도 된다.
export const DEFAULT_PROFILE = {
  name: "",
  island: "노을섬",
  about: "",
  people: [
    { relation: "어머니", name: "어머니", island: "하늬섬", unsaid: "요즘 어떻게 지내세요? 늘 고마워요. 이번엔 제가 먼저 안부를 전하고 싶었어요.", gap: "month", scene: "창가에서 기다려 주시던 모습", title: "" },
    { relation: "친구", name: "도윤", island: "마루섬", unsaid: "오랜만이야! 문득 네 생각이 나서 편지를 써. 같이 놀던 때가 그리워졌어.", gap: "month", scene: "시험 전날 함께 밤을 새우며 웃던 장면", title: "" },
    { relation: "자녀", name: "하준", island: "물결섬", unsaid: "오늘도 잘 지내고 있니? 네 웃는 얼굴이 자꾸 떠올라서 편지를 써. 늘 응원하고 있어.", gap: "year", scene: "어릴 적 내 등에서 잠들던 네 모습", title: "" },
    { relation: "반려동물", name: "콩이", island: "콩이의 섬", unsaid: "오늘도 잘 지냈니? 너랑 산책하던 시간이 제일 좋았어. 고마워.", gap: "day", scene: "현관에서 꼬리를 흔들며 반기던 모습", title: "" },
  ],
};

// 한국어 조사 붙이기: josa("도윤", "이", "가") → "도윤이", josa("서하", "이", "가") → "서하가"
const hasBatchim = (w) => {
  const c = (w || "").trim().slice(-1).charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};
export const josa = (w, withB, withoutB) => w + (hasBatchim(w) ? withB : withoutB);

const firstSentence = (t) => {
  const s = (t || "").trim().split(/(?<=[.!?])\s+/)[0] || "";
  const c = s.replace(/[.!?]+$/, "");
  return c.length > 36 ? c.slice(0, 36) + "…" : c;
};
const sentences = (t) => ((t || "").trim().split(/(?<=[.!?])\s+/).filter(Boolean)).slice(0, 3);
const isoName = (p) => (p.relation && p.relation !== p.name && p.relation !== "직접 입력" ? `${p.relation} ${p.name}` : p.name);

// 어른(어머니·아버지·은사)에게는 존댓말, 나머지는 편한 말투. 편지 본문과 섬의 대답이 같은 말투로 이어진다.
const FORMAL = new Set(["어머니", "아버지", "은사"]);
const GAP_LINE = {
  f: {
    day: "어제 뵙고도 오늘 또 편지를 써요. 편지로 전하면 왠지 더 설레거든요.",
    month: "한동안 못 뵌 것 같아서 편지를 써요. 그간 잘 지내셨죠?",
    year: "오랜만에 편지를 써요. 소식을 전하지 못한 동안에도 늘 생각하고 있었어요.",
    lost: "얼마 만인지 모를 만큼 오랜만이에요. 그래도 이렇게 편지를 쓰니 마음이 가벼워져요.",
  },
  c: {
    day: "어제도 봤는데 또 편지를 써. 편지로 말하면 왠지 더 설레거든.",
    month: "한동안 못 본 것 같아서 편지를 써. 요즘 어떻게 지내?",
    year: "오랜만이야! 소식을 못 전한 동안에도 늘 생각하고 있었어.",
    lost: "얼마 만인지 모르겠다. 그래도 이렇게 편지를 쓰니까 마음이 가벼워져.",
  },
};
const CLOSING = {
  어머니: "날씨가 쌀쌀하니 따뜻하게 입고 다니세요.", 아버지: "환절기니까 건강 챙기세요.", 은사: "늘 건강하시길 바랍니다.",
  친구: "다음에 만나면 맛있는 거 먹자!", 연인: "다음에 같이 산책하자.", 형제: "곧 얼굴 보러 갈게!", 형제자매: "곧 얼굴 보러 갈게!", 반려동물: "돌아가면 신나게 놀자!", 자녀: "맛있는 거 많이 먹고, 푹 자렴!",
};
// 편지 끝의 추신: 작은 안부 한 줄
const PS = { f: "추신: 답장은 천천히 주셔도 괜찮아요.", c: "추신: 답장은 천천히 해도 돼!", 반려동물: "추신: 간식은 우리 둘만의 비밀이야." };
// 섬이 돌려주는 대답: [가까운 사이(어제·한 달), 오래된 사이(일 년·기억나지 않음)]. 반려동물은 말 대신 몸짓으로 답한다.
const SAY = {
  어머니: ["어머나, 편지가 왔구나! 잘 지낸다니 마음이 놓이는구나. 밥은 챙겨 먹고 있니?", "이게 얼마 만이니! 소식 전해 줘서 고맙구나. 우리 천천히 이야기 나누자꾸나."],
  아버지: ["허허, 편지가 다 왔구나. 잘 지낸다니 다행이다. 몸 챙기거라.", "오랜만이구나. 편지 잘 받았다. 이렇게 소식을 들으니 반갑다."],
  친구: ["우와, 편지다! 나도 딱 네 생각하고 있었어. 이번엔 만나서 놀자!", "대박, 이게 얼마 만이야! 편지 받으니까 너무 반갑다. 우리 곧 보자!"],
  연인: ["편지 받고 한참 웃었어. 나도 같은 생각이었어. 다음 산책이 기대돼.", "와, 이렇게 편지가 오다니. 고마워. 마음이 따뜻해졌어."],
  은사: ["이게 누구냐, 반가운 편지로구나. 잘 지낸다니 기쁘다.", "오랜만이구나. 이렇게 소식을 주니 기쁘다. 앞으로도 늘 응원하마."],
  자녀: ["우와, 편지다! 나도 보고 싶었어요! 다음엔 같이 놀러 가요!", "오랜만이에요! 편지 받으니까 너무 좋아요. 곧 만나요!"],
  형제: ["오~ 편지네! 나도 연락하려던 참이었어. 곧 보자!", "오랜만이야! 편지 받으니까 반갑다. 얼른 얼굴 보고 싶다."],
  형제자매: ["오~ 편지네! 나도 연락하려던 참이었어. 곧 보자!", "오랜만이야! 편지 받으니까 반갑다. 얼른 얼굴 보고 싶다."],
  _: ["우와, 편지가 왔네! 소식 전해 줘서 고마워.", "오랜만이다! 편지 받으니까 너무 반가워. 곧 또 이야기하자."],
};
const WIND_LINE = { 1: "오늘은 바람이 잔잔하네.", 2: "바람이 조금 거칠 걸세.", 3: "바람이 몹시 거칠 걸세. 순풍 리본을 찾아 두게." };   // 해무의 말
const subject = (me) => (me === "나" ? "내가" : josa(me, "이", "가"));
const toward = (w) => { const c = w.trim().slice(-1).charCodeAt(0), t = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 1; return w + (t === 0 || t === 8 ? "로" : "으로"); };

// 프로필 → 편지 네 통. 사람 순서가 곧 장의 순서이고, 섬에서 섬으로 이어진다.
export function buildLetters(pr) {
  const me = pr.name.trim() || "나";
  return pr.people.map((p, i) => {
    const prev = i > 0 ? pr.people[i - 1] : null;
    const next = pr.people[i + 1];
    const gap = GAP_OPTIONS.find((g) => g.id === p.gap) || GAP_OPTIONS[1];
    const far = gap.id === "year" || gap.id === "lost";
    const reg = FORMAL.has(p.relation) ? "f" : "c";

    // 섬의 대답: 닿았다는 장면 → 상대의 한마디(관계마다 다른 말투) → 다음 바람길
    const lead = `편지가 ${p.island}에 닿았다.`;
    const answer = p.relation === "반려동물"
      ? `${josa(p.name, "은", "는")} ${far ? "고개를 갸웃하다가" : "편지 냄새를 맡더니"} 꼬리를 힘껏 흔들며 품으로 달려왔다.`
      : `${josa(p.name, "은", "는")} ${far ? "편지를 읽고 한참 웃다가 말했다." : "편지를 읽자마자 활짝 웃으며 말했다."} "${(SAY[p.relation] || SAY._)[far ? 1 : 0]}"`;
    const link = next ? `바람이 ${next.island} 쪽으로 방향을 틀었다. 이제 ${next.name}에게 갈 차례다.` : "네 섬이 바람길로 하나가 되었다.";
    const reply = `${lead} ${answer} ${link}`;

    const memo = [
      [
        "첫 배달이군. 서두르지 말게. 편지는 날개보다 마음이 먼저 닿는 법이라네.",
        "첫 배달을 해냈군. 이제 가방이 손에 익을 걸세.",
        "벌써 반쯤 왔네. 지칠 때쯤 바람이 제일 고약해지지. 구슬을 놓치지 말게.",
        "마지막 배달일세. 마지막은 늘 좋은 소식으로 끝나는 법이지.",
      ][Math.min(i, 3)],
      WIND_LINE[gap.ws],
    ].join(" ");
    const rel = p.relation && p.relation !== p.name ? `(${p.relation})` : "";
    return {
      id: `l${i + 1}`, chapter: i + 1,
      from: i === 0 ? pr.island : prev.island, to: p.island,
      who: p.name, relation: p.relation, people: `${me} → ${p.name}`,
      title: p.title?.trim() || TITLE_BY_RELATION[p.relation] || TITLES[Math.min(i, 3)],
      context: `${i + 1}장. ${subject(me)} ${p.name}${rel}에게 가는 길입니다.${prev ? ` 앞 장에서 ${prev.name}에게 편지가 닿으며, ${toward(p.island)} 가는 바람길이 열렸습니다.` : " 해무가 열어 준 첫 바람길입니다."}`,
      memo,
      scene: p.scene,
      memory: [`기억 구슬이 빛났다. ${josa(p.scene, "이", "가")} 눈앞에 되살아났다.`, `그 온기가 편지 위에 오래 남아, ${p.name}에게 닿을 말이 조금 더 따뜻해졌다.`],
      body: [`${p.name}에게.`, GAP_LINE[reg][gap.id], ...sentences(p.unsaid), CLOSING[p.relation] || "곧 또 이야기하자!", `— ${me}`, PS[p.relation] || PS[reg]],
      reply,
      flight: { ...FLIGHT_BY_GAP[gap.ws], ...FLIGHT_COMMON },
    };
  });
}

// 관계별 기본값: 대화형 오프닝에서 "못 한 말"과 "떠오르는 장면"을 직접 쓰지 않아도 이야기가 이어지도록.
export const RELATION_DEFAULTS = {
  어머니: { unsaid: "요즘 어떻게 지내세요? 늘 고마워요. 이번엔 제가 먼저 안부를 전하고 싶었어요.", scene: "창가에서 기다려 주시던 모습" },
  아버지: { unsaid: "잘 지내세요? 표현은 서툴지만 늘 든든했어요. 고마워요.", scene: "말없이 내 어깨를 두드려 주시던 모습" },
  친구: { unsaid: "오랜만이야! 문득 네 생각이 나서 편지를 써. 같이 놀던 때가 그리워졌어.", scene: "시험 전날 함께 밤을 새우며 웃던 장면" },
  연인: { unsaid: "오늘 문득 네 생각이 나서 편지를 써. 같이 걷던 저녁이 참 좋았어.", scene: "처음 함께 걷던 저녁 길" },
  은사: { unsaid: "선생님, 안녕하세요. 가르쳐 주신 말씀 덕분에 잘 지내고 있어요. 감사했습니다.", scene: "교실 창가에 서 계시던 모습" },
  형제: { unsaid: "잘 지내지? 어릴 때 이불 나눠 덮던 게 생각나서 웃음이 났어. 늘 네 편이야.", scene: "어릴 적 한 이불을 나눠 덮던 밤" },
  자녀: { unsaid: "오늘도 잘 지내고 있니? 네 웃는 얼굴이 자꾸 떠올라서 편지를 써. 늘 응원하고 있어.", scene: "어릴 적 내 등에서 잠들던 모습" },
  형제자매: { unsaid: "잘 지내지? 어릴 때 이불 나눠 덮던 게 생각나서 웃음이 났어. 늘 네 편이야.", scene: "어릴 적 한 이불을 나눠 덮던 밤" },
  반려동물: { unsaid: "오늘도 잘 지냈니? 너랑 산책하던 시간이 제일 좋았어. 고마워.", scene: "현관에서 꼬리를 흔들며 반기던 모습" },
  "직접 입력": { unsaid: "잘 지내고 있나요? 문득 생각이 나서 편지를 써요. 좋은 일만 가득하길 바라요.", scene: "함께 웃던 어느 날의 모습" },
};
// 못 한 말을 한 번에 고르는 빠른 선택
export const QUICK_UNSAID = [
  { label: "고마웠다고", text: "늘 고맙다는 말을 하고 싶었어요." },
  { label: "안부를 묻고 싶다고", text: "요즘 어떻게 지내는지 궁금했어요." },
  { label: "보고 싶다고", text: "요즘 문득 보고 싶었어요." },
  { label: "사랑한다고", text: "사랑한다는 말을 오늘은 꼭 전하고 싶었어요." },
  { label: "자랑스럽다고", text: "당신이 참 자랑스럽다는 말을 하고 싶었어요." },
];

// 대화로 고른 값 → 사람 한 명. 섬 이름은 "○○의 섬", 장면은 관계 기본값.
export function makePerson({ relation, name, unsaid, gap }) {
  const d = RELATION_DEFAULTS[relation] || RELATION_DEFAULTS["직접 입력"];
  const nm = name.trim() || relation;
  return { relation, name: nm, island: `${nm}의 섬`, unsaid: unsaid?.trim() || d.unsaid, gap: gap || "month", scene: d.scene, title: "" };
}
// "예시로 바로 시작": 이름만 있으면 예시 구성으로 시작한다
export function exampleProfile(name, about) {
  return { ...DEFAULT_PROFILE, name: name.trim() || "나", about: about || "" };
}

// 3D 오프닝 자막(시간은 Intro3D의 카메라 연출과 맞춰져 있다).
// world: 이름을 몰라도 되는 앞부분. tail: 네 사람이 정해진 뒤의 뒷부분(편지가 날아가는 장면).
export function introWorld() {
  return [
    { t: 0.8, end: 6.8, text: "섬과 섬 사이에는, 편지가 오가는 동안에만 열리는 바람길이 있다." },
    { t: 7.6, end: 13.4, text: "편지가 끊기면 길은 닫히고, 섬은 조금 심심해진다." },
    { t: 14.4, end: 20.8, text: "나는 우체부 해무. 사십 년 동안 남들의 편지만 날랐다." },
    { t: 21.4, end: 27, text: "오늘은 내가 가방을 넘기는 날이다. 이 가방을 이어받을 사람이, 찾아왔다." },
  ];
}
export function introTail(pr) {
  const me = pr.name.trim() || "나";
  const tag = (p) => `${p.island}의 ${isoName(p)}`;
  const [a, b, c, d] = pr.people;
  return [
    { t: 35.1, end: 37.7, text: tag(a), tag: true },
    { t: 37.7, end: 40.3, text: tag(b), tag: true },
    { t: 40.3, end: 42.9, text: tag(c), tag: true },
    { t: 42.9, end: 46.4, text: tag(d), tag: true },
    { t: 46.6, end: 999, text: `${josa(me, "의", "의")} 첫 배달을 시작한다.` },
  ];
}
// 다시 보기(이미 이야기를 정한 경우): 해무의 대사까지 포함한 전체 오프닝
export function buildIntro(pr) {
  const me = pr.name.trim() || "나";
  const about = pr.about.trim() || "늘 바쁘다는 말을 달고 사는 사람";
  const w = introWorld();
  w[3] = { t: 21.4, end: 27, text: `오늘은 내가 가방을 넘기는 날이다. 이 가방을 이어받을 사람은, ${me} 자네다.` };
  return [...w,
    { t: 28, end: 34.4, text: `"${me}, 오늘부터 이 가방은 자네 거야. ${about}, 그런 자네를 오래 지켜봤지. 가방 속 편지지는 네 장, 아직 비어 있네. 요즘 안부가 궁금한 사람들에게 써 보게."` },
    ...introTail(pr)];
}

export function buildEpilogue(pr) {
  const me = pr.name.trim() || "나";
  const [a, b, c, d] = pr.people.map((p) => p.name);
  return [
    `네 통의 편지가 모두 닿았다. ${a}, ${b}, ${c}, ${d}. 네 섬이 바람길로 하나가 되었다.`,
    `"${me}, 수고했네. 사십 년을 일한 나도, 첫날엔 자네처럼 손이 떨렸다네."`,
    "\"편지는 닿는 것만으로 끝나지 않아. 쓰는 동안 마음이 먼저 건너가 있거든. 받는 사람 얼굴이 벌써 떠오르지 않던가?\"",
    "\"이 가방은 이제 정말 자네 거야. 안부가 궁금한 사람이 또 있다면, 지도의 '내 편지 쓰기'에서 써 보게.\"  — 해무",
  ];
}
