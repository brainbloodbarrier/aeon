/**
 * A* pathfinding on the isometric tile grid.
 */

import { BAR_MAP, MAP_ROWS, MAP_COLS } from './tilemap.js';
import { isWalkable } from './tiles.js';

const MAX_PATH = 30;

/** Find shortest path from start to end tile. Returns array of {x,y} or empty. */
export function findPath(startX, startY, endX, endY, occupiedTiles = new Set()) {
  if (endX < 0 || endX >= MAP_COLS || endY < 0 || endY >= MAP_ROWS) return [];
  if (!isWalkable(BAR_MAP[endY]?.[endX])) return [];

  const key = (x, y) => `${x},${y}`;
  const open = [{ x: startX, y: startY, g: 0, f: 0, parent: null }];
  const closed = new Set();

  open[0].f = heuristic(startX, startY, endX, endY);

  while (open.length > 0) {
    // Find lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];

    if (current.x === endX && current.y === endY) {
      return reconstructPath(current);
    }

    closed.add(key(current.x, current.y));

    if (current.g > MAX_PATH) continue;

    // 4-directional neighbors
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);

      if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
      if (closed.has(nk)) continue;
      if (!isWalkable(BAR_MAP[ny]?.[nx])) continue;
      if (occupiedTiles.has(nk) && !(nx === endX && ny === endY)) continue;

      const g = current.g + 1;
      const existing = open.find(n => n.x === nx && n.y === ny);

      if (!existing) {
        open.push({ x: nx, y: ny, g, f: g + heuristic(nx, ny, endX, endY), parent: current });
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + heuristic(nx, ny, endX, endY);
        existing.parent = current;
      }
    }
  }

  return []; // No path found
}

function heuristic(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function reconstructPath(node) {
  const path = [];
  let current = node;
  while (current.parent) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path;
}
