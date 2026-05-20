/**
 * Isometric Renderer
 *
 * Converts between tile coords and screen coords.
 * Renders tiles in painter's order (back to front).
 */

export const TILE_W = 32;
export const TILE_H = 16;

/** Convert tile coords to screen pixel coords */
export function tileToScreen(tx, ty, camera) {
  const sx = (tx - ty) * (TILE_W / 2);
  const sy = (tx + ty) * (TILE_H / 2);
  return {
    x: (sx - camera.x) * camera.zoom + window.innerWidth / 2,
    y: (sy - camera.y) * camera.zoom + window.innerHeight / 2
  };
}

/** Convert tile coords to world space (no camera/window transform) */
export function tileToWorld(tx, ty) {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2)
  };
}

/** Convert screen pixel coords to tile coords */
export function screenToTile(sx, sy, camera) {
  const wx = (sx - window.innerWidth / 2) / camera.zoom + camera.x;
  const wy = (sy - window.innerHeight / 2) / camera.zoom + camera.y;
  const tx = (wx / (TILE_W / 2) + wy / (TILE_H / 2)) / 2;
  const ty = (wy / (TILE_H / 2) - wx / (TILE_W / 2)) / 2;
  return { x: Math.round(tx), y: Math.round(ty) };
}

let ctx = null;

export function initRenderer(context) {
  ctx = context;
}

/**
 * Main render pass.
 * Clears canvas, applies camera, draws tiles and entities.
 */
export function render(context, gameState, tilemap, entities, fxList) {
  const c = context || ctx;
  const { camera } = gameState;

  c.save();
  c.imageSmoothingEnabled = false;

  // Clear
  c.fillStyle = '#0a0a0f';
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);

  // Draw tilemap
  if (tilemap) {
    const map = tilemap.map;
    for (let ty = 0; ty < map.length; ty++) {
      for (let tx = 0; tx < map[ty].length; tx++) {
        const tileType = map[ty][tx];
        if (tileType < 0) continue;
        const screen = tileToScreen(tx, ty, camera);
        drawTile(c, tileType, screen.x, screen.y, camera.zoom);
      }
    }
  }

  // Draw entities in depth order (sorted by tileY, then tileX)
  if (entities) {
    const sorted = [...entities].sort((a, b) =>
      (a.tileY - b.tileY) || (a.tileX - b.tileX)
    );
    for (const entity of sorted) {
      if (entity.draw) {
        entity.draw(c, camera);
      }
    }
  }

  // Draw FX
  if (fxList) {
    for (const fx of fxList) {
      if (fx.draw) fx.draw(c, gameState);
    }
  }

  c.restore();
}

// ─── Tile rendering ───

const TILE_COLORS = {
  0: '#2a1f14',  // FLOOR_WOOD
  1: '#1a1a2e',  // FLOOR_TILE
  2: '#3d2b1f',  // WALL_BACK
  3: '#2d1f14',  // WALL_SIDE
  4: '#4a3728',  // COUNTER_FRONT
  5: '#5c4033',  // COUNTER_TOP
  6: '#5c4033',  // COUNTER_CORNER
  7: '#1a1510',  // STOOL
};

const BOTTLE_COLORS = ['#2a7a4a', '#8a2a2a', '#4a4a8a', '#8a6a2a', '#5a2a6a', '#2a6a6a'];

function drawTile(ctx, type, sx, sy, zoom) {
  const hw = (TILE_W / 2) * zoom;
  const hh = (TILE_H / 2) * zoom;
  const color = TILE_COLORS[type] || '#1a1a1a';

  // Diamond path (reused for clipping)
  function diamondPath() {
    ctx.beginPath();
    ctx.moveTo(sx, sy - hh);
    ctx.lineTo(sx + hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx - hw, sy);
    ctx.closePath();
  }

  diamondPath();
  ctx.fillStyle = color;
  ctx.fill();

  // Subtle edge
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Floor wood grain (clipped to diamond)
  if (type === 0) {
    ctx.save();
    diamondPath();
    ctx.clip();
    ctx.strokeStyle = 'rgba(180, 140, 100, 0.035)';
    ctx.lineWidth = 1;
    const step = 3 * zoom;
    for (let gy = sy - hh; gy <= sy + hh; gy += step) {
      ctx.beginPath();
      ctx.moveTo(sx - hw, gy);
      ctx.lineTo(sx + hw, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Stool seat cushion
  if (type === 7) {
    const cushR = hw * 0.35;
    ctx.beginPath();
    ctx.ellipse(sx, sy - hh * 0.2, cushR, cushR * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2018';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 150, 0.04)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Wall tiles — height + shelf + bottles
  if (type === 2 || type === 3) {
    const wallH = hh * 2;

    // Wall face
    ctx.beginPath();
    ctx.moveTo(sx - hw, sy);
    ctx.lineTo(sx - hw, sy - wallH);
    ctx.lineTo(sx, sy - hh - wallH);
    ctx.lineTo(sx + hw, sy - wallH);
    ctx.lineTo(sx + hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx - hw, sy);
    ctx.closePath();
    ctx.fillStyle = type === 2 ? '#4a3225' : '#3a2518';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();

    // Shelf and bottles (back wall only)
    if (type === 2) {
      ctx.save();
      // Re-clip to wall face
      ctx.beginPath();
      ctx.moveTo(sx - hw, sy);
      ctx.lineTo(sx - hw, sy - wallH);
      ctx.lineTo(sx, sy - hh - wallH);
      ctx.lineTo(sx + hw, sy - wallH);
      ctx.lineTo(sx + hw, sy);
      ctx.closePath();
      ctx.clip();

      // Shelf plank
      const shelfY = sy - wallH * 0.55;
      ctx.fillStyle = '#5a3f2a';
      ctx.fillRect(sx - hw * 0.85, shelfY, hw * 1.7, Math.max(1, 1.5 * zoom));

      // Bottles
      const bw = Math.max(1.5, 1.5 * zoom);
      const bh = Math.max(3, 4 * zoom);
      const seed = Math.floor(sx * 7 + sy * 13) & 0xFF; // deterministic per tile
      for (let b = 0; b < 2; b++) {
        const bx = sx + (b - 0.5) * hw * 0.5;
        const bColor = BOTTLE_COLORS[(seed + b) % BOTTLE_COLORS.length];

        // Bottle body
        ctx.fillStyle = bColor;
        ctx.fillRect(bx - bw / 2, shelfY - bh, bw, bh);

        // Bottle neck
        ctx.fillRect(bx - bw / 4, shelfY - bh - bw * 0.8, bw / 2, bw * 0.8);

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(bx - bw / 4, shelfY - bh + 1, bw / 3, bh * 0.5);
      }

      ctx.restore();
    }
  }

  // Counter tiles — height + polish
  if (type === 4 || type === 5 || type === 6) {
    const counterH = hh * 1.2;

    // Counter face
    ctx.beginPath();
    ctx.moveTo(sx - hw, sy);
    ctx.lineTo(sx - hw, sy - counterH);
    ctx.lineTo(sx, sy - hh - counterH);
    ctx.lineTo(sx + hw, sy - counterH);
    ctx.lineTo(sx + hw, sy);
    ctx.closePath();
    ctx.fillStyle = type === 5 ? '#6b4f3a' : '#5a4030';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.stroke();

    // Polished surface highlight (counter top only)
    if (type === 5) {
      ctx.strokeStyle = 'rgba(255, 220, 180, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - hw * 0.4, sy - counterH + hh * 0.3);
      ctx.lineTo(sx + hw * 0.4, sy - counterH + hh * 0.7);
      ctx.stroke();
    }
  }
}
