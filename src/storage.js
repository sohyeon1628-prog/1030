import { GRADE_RANK } from "./data/letters.js";

const KEY = "last-postal-wing:v1";
const EMPTY = {
  delivered: {}, grade: {}, tutorialSeen: false, muted: false,
  bottleSeen: false,  // 첫 편지를 보낸 뒤의 병 편지 에필로그를 봤는지
  storySeen: false,   // 오프닝(해무 이야기)을 봤는지
  howtoSeen: false,   // 게임 방법 안내를 봤는지
  nickname: "",       // 닉네임(로그인이 생기기 전까지 쓰는 이름). 해무가 부르는 이름이다
  mine: [],           // 내가 쓴 편지(미래의 나에게)
  orbs: {},           // 편지(장)별로 가장 많이 모은 기억 구슬 수
  orbExtra: 0,        // 내 편지를 날리며 모은 구슬
};

export function loadState() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...EMPTY };
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 불가 환경 */ }
}

// 배달 기록: state.delivered[id], state.grade[id]. 등급은 더 높은 쪽만 남긴다.
export function recordDelivery(state, id, grade) {
  const prev = state.grade[id];
  return {
    ...state,
    delivered: { ...state.delivered, [id]: true },
    grade: { ...state.grade, [id]: !prev || GRADE_RANK[grade] > GRADE_RANK[prev] ? grade : prev },
  };
}

// 내 편지를 보관한다. openAt 이후에 편지함에서 열 수 있다.
export function addMine(state, entry) {
  return { ...state, mine: [entry, ...state.mine] };
}
