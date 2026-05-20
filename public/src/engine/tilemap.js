/**
 * Bar layout — "O Fim" counter scene.
 * 15 columns x 10 rows. Vertical slice.
 */

import { TILE } from './tiles.js';

const V = TILE.VOID;
const F = TILE.FLOOR_WOOD;
const W = TILE.WALL_BACK;
const S = TILE.WALL_SIDE;
const T = TILE.COUNTER_TOP;
const C = TILE.COUNTER_FRONT;
const K = TILE.STOOL;

// prettier-ignore
export const BAR_MAP = [
  [V, V, W, W, W, W, W, W, W, W, W, W, W, V, V],  // row 0 — back wall
  [V, W, W, W, W, W, W, W, W, W, W, W, W, W, V],  // row 1 — back wall
  [S, T, T, T, T, T, T, T, T, T, T, T, T, T, S],  // row 2 — counter top (personas sit here)
  [S, C, C, C, C, C, C, C, C, C, C, C, C, C, S],  // row 3 — counter front
  [F, F, F, F, K, F, F, K, F, F, F, K, F, F, F],  // row 4 — stools row
  [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],  // row 5 — floor
  [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],  // row 6 — floor
  [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],  // row 7 — floor (avatar spawn)
  [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],  // row 8 — floor
  [V, F, F, F, F, F, F, F, F, F, F, F, F, F, V],  // row 9 — edge
];

export const MAP_ROWS = BAR_MAP.length;
export const MAP_COLS = BAR_MAP[0].length;

/** Avatar starting position */
export const SPAWN_POINT = { x: 7, y: 7 };

/**
 * Persona positions at the counter.
 * tileY=2 means behind the counter top.
 */
export const PERSONA_POSITIONS = {
  pessoa:   { tileX: 4,  tileY: 2 },
  crowley:  { tileX: 7,  tileY: 2 },
  tesla:    { tileX: 11, tileY: 2 },
};

/** Category colors for placeholders */
export const CATEGORY_COLORS = {
  portuguese:  '#D4A574',
  magicians:   '#8B5CF6',
  scientists:  '#38BDF8',
  philosophers:'#4ADE80',
  strategists: '#F97316',
  mythic:      '#E879F9',
  enochian:    '#FBBF24',
};
