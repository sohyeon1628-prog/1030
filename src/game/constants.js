// 비행 튜닝 값. 높이는 3줄(아래·가운데·위)로 나뉘고, 한 줄씩 옮겨 날아간다.
export const W = 800;           // 캔버스 논리 폭
export const H = 600;           // 캔버스 논리 높이
export const SX = 220;          // 우체부의 화면 x
export const VX = 330;          // 출발 속도 px/s (자동)
export const VX_MAX = 540;      // 착륙 직전까지 점점 빨라져 닿는 최고 속도
export const VX_PRACTICE = 280; // 연습 비행은 일정한 속도로 천천히
export const LANE_Y = [130, 300, 470];   // 3줄의 높이(px, 아래 기준). 아래 / 가운데 / 위
export const LANE_TAU = 0.07;   // 줄을 옮길 때의 부드러움(작을수록 빠르다)
export const LEN = 12000;       // 한 번의 비행 길이(px)
export const ISLAND = 36;       // 도착 섬 윗면 높이
export const START_TOP = 30;    // 출발 섬 윗면 높이
export const GRASS = 14;        // 섬 윗면 높이(top)에서 잔디 표면까지. 섬 그림의 잔디가 이만큼 솟아 있다
export const FOOT = 36;         // 서 있을 때 우체부 몸통 중심에서 발바닥까지(그림 기준)
export const GROUND_Y = START_TOP + GRASS + FOOT;   // 출발 섬 잔디 위에 서 있을 때 몸통 중심 높이
export const LAND_Y = ISLAND + GRASS + FOOT;        // 도착 섬 잔디 위에 서 있을 때 몸통 중심 높이
export const TAKEOFF = 1.0;     // 도움닫기부터 줄에 오르기까지 걸리는 시간(초)
export const R = 15;            // 우체부 충돌 반경 (몸통+가방 크기에 맞춤)
export const MAX_HITS = 4;      // 하트 4개. 이 횟수만큼 부딪히면 구간 실패
export const INV = 1.2;         // 맞은 뒤 무적 시간(초)
export const JUMP_T = 1.7;      // 상어·고래가 물 밖에 있는 시간(초)
export const JUMP_SPAN = 190;   // 뛰어오른 자리에서 정점까지의 가로 거리(px). 둥근 호를 그리며 왼쪽으로 넘어간다
export const COMBO_SHIELD = 8;  // 연속으로 이만큼 피하면 깃털 방패를 하나 준다

// 하늘길 걷기(3장부터): 날다가 구름 길에 내려 걷는 구간. ↑로 폴짝 뛰어 구름 덩어리와 구멍을 넘는다.
export const WALK_TOP = 190;               // 구름 길 윗면 높이
export const WALK_Y = WALK_TOP + FOOT;     // 길 위에 서 있을 때 몸통 중심 높이
export const WALK_JUMP = 125;              // 뛰어오르는 높이
export const WALK_JUMP_T = 0.72;           // 한 번 뛰어서 내려오기까지(초)
// 도착 지점 2초 전부터는 장애물이 나오지 않는다(착륙 전 마지막 2초, 최고 속도 기준 거리)
export const LAND_P = 0.95;
export const CALM_DIST = 2 * VX_MAX;

// 아이템 지속 시간(초): 깃털 방패와 우산은 얻은 뒤 이만큼 지나면 사라진다
export const GUARD_T = 12;
export const UMBRELLA_T = 10;
