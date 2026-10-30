// 비행 튜닝 값. 높이는 3줄(아래·가운데·위)로 나뉘고, 한 줄씩 옮겨 날아간다.
export const W = 800;           // 캔버스 논리 폭
export const H = 600;           // 캔버스 논리 높이
export const SX = 220;          // 우체부의 화면 x
export const VX = 220;          // 전진 속도 px/s (자동)
export const LANE_Y = [130, 300, 470];   // 3줄의 높이(px, 아래 기준). 아래 / 가운데 / 위
export const LANE_TAU = 0.11;   // 줄을 옮길 때의 부드러움(작을수록 빠르다)
export const LEN = 6400;        // 한 번의 비행 길이(px)
export const ISLAND = 36;       // 도착 섬 윗면 높이
export const R = 15;            // 우체부 충돌 반경 (몸통+가방 크기에 맞춤)
export const MAX_HITS = 5;      // 하트 5개. 이 횟수만큼 부딪히면 구간 실패
export const INV = 1.6;         // 맞은 뒤 무적 시간(초)
