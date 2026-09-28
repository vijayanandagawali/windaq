/**
 * Ludo board geometry on a 15x15 grid. Must match services/realtime/src/services/ludo/ludoRules.js:
 * seats 0 red, 1 green, 2 yellow, 3 blue; starts at absolute squares 0, 13, 26, 39; stars at +8.
 */
export const SEAT_COLOR = ['#E5484D', '#30A46C', '#E8A800', '#3E63DD'];
export const SEAT_SOFT = ['#FDECEC', '#E6F6EC', '#FFF6D6', '#E9EEFD'];
export const SEAT_NAME = ['Red', 'Green', 'Yellow', 'Blue'];
export const START_OFFSET = [0, 13, 26, 39];
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

type Cell = [number, number]; // [row, col]

function buildTrack(): Cell[] {
  const t: Cell[] = [];
  const push = (r: number, c: number) => t.push([r, c]);
  for (let c = 1; c <= 5; c++) push(6, c);
  for (let r = 5; r >= 0; r--) push(r, 6);
  push(0, 7);
  for (let r = 0; r <= 5; r++) push(r, 8);
  for (let c = 9; c <= 14; c++) push(6, c);
  push(7, 14);
  for (let c = 14; c >= 9; c--) push(8, c);
  for (let r = 9; r <= 14; r++) push(r, 8);
  push(14, 7);
  for (let r = 14; r >= 9; r--) push(r, 6);
  for (let c = 5; c >= 0; c--) push(8, c);
  push(7, 0);
  push(6, 0);
  return t;
}

export const TRACK: Cell[] = buildTrack(); // 52 cells, index = absolute square

const HOME_COLUMN: Cell[][] = [
  [1, 2, 3, 4, 5].map((c) => [7, c] as Cell),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as Cell),
  [13, 12, 11, 10, 9].map((c) => [7, c] as Cell),
  [13, 12, 11, 10, 9].map((r) => [r, 7] as Cell)
];
export const HOME_COLUMN_CELLS = HOME_COLUMN;

const BASE_ORIGIN: Cell[] = [[0, 0], [0, 9], [9, 9], [9, 0]];
export const BASE_ORIGINS = BASE_ORIGIN;
const BASE_SLOTS: [number, number][] = [[1.9, 1.9], [1.9, 4.1], [4.1, 1.9], [4.1, 4.1]];
const HOME_POINT: [number, number][] = [[7.5, 6.45], [6.45, 7.5], [7.5, 8.55], [8.55, 7.5]];

/** Centre of a token in grid units (row, col), for seat/token index and relative position. */
export function tokenPoint(seat: number, tokenIndex: number, pos: number): [number, number] {
  if (pos === -1) {
    const [r0, c0] = BASE_ORIGIN[seat];
    const [dr, dc] = BASE_SLOTS[tokenIndex];
    return [r0 + dr, c0 + dc];
  }
  if (pos === 56) {
    const [r, c] = HOME_POINT[seat];
    const spread = (tokenIndex - 1.5) * 0.28;
    return seat % 2 === 0 ? [r + spread, c] : [r, c + spread];
  }
  if (pos >= 51) {
    const [r, c] = HOME_COLUMN[seat][pos - 51];
    return [r + 0.5, c + 0.5];
  }
  const [r, c] = TRACK[(START_OFFSET[seat] + pos) % 52];
  return [r + 0.5, c + 0.5];
}

/** Cells a token passes through for a move, for step-by-step animation (base exits jump straight to start). */
export function pathPositions(from: number, to: number): number[] {
  if (from === -1) return [0];
  const out: number[] = [];
  for (let p = from + 1; p <= to; p++) out.push(p);
  return out;
}
