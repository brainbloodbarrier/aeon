/**
 * Tile type definitions.
 */

export const TILE = {
  VOID:           -1,
  FLOOR_WOOD:      0,
  FLOOR_TILE:      1,
  WALL_BACK:       2,
  WALL_SIDE:       3,
  COUNTER_FRONT:   4,
  COUNTER_TOP:     5,
  COUNTER_CORNER:  6,
  STOOL:           7,
};

/** Whether a tile blocks movement */
export function isWalkable(type) {
  return type === TILE.FLOOR_WOOD || type === TILE.FLOOR_TILE || type === TILE.STOOL;
}
