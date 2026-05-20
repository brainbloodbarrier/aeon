/**
 * Player avatar entity.
 * Moves along A* path with smooth interpolation.
 * pixelX/pixelY are in WORLD space (no camera/window transform).
 */

import { tileToWorld, TILE_W } from '../engine/renderer.js';

const MOVE_SPEED = 3; // tiles per second

export function createAvatar(tileX, tileY) {
  const world = tileToWorld(tileX, tileY);

  return {
    tileX,
    tileY,
    pixelX: world.x,
    pixelY: world.y,
    state: 'idle',
    direction: 'south',
    path: [],

    update(dt, gameState) {
      this.tileX = gameState.avatar.tileX;
      this.tileY = gameState.avatar.tileY;
      this.state = gameState.avatar.state;
      this.direction = gameState.avatar.direction;
      this.path = gameState.avatar.path;

      if (this.state === 'walking' && this.path.length > 0) {
        const target = this.path[0];
        const targetWorld = tileToWorld(target.x, target.y);

        const dx = targetWorld.x - this.pixelX;
        const dy = targetWorld.y - this.pixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = MOVE_SPEED * (TILE_W / 2) * (dt / 1000);

        if (dist <= step) {
          // Arrived at tile
          this.pixelX = targetWorld.x;
          this.pixelY = targetWorld.y;
          gameState.avatar.tileX = target.x;
          gameState.avatar.tileY = target.y;
          this.tileX = target.x;
          this.tileY = target.y;

          // Direction from movement
          if (dx > 1) this.direction = 'east';
          else if (dx < -1) this.direction = 'west';
          else if (dy > 1) this.direction = 'south';
          else if (dy < -1) this.direction = 'north';
          gameState.avatar.direction = this.direction;

          this.path.shift();
          gameState.avatar.path = this.path;

          if (this.path.length === 0) {
            gameState.avatar.state = 'idle';
            this.state = 'idle';
          }
        } else {
          this.pixelX += (dx / dist) * step;
          this.pixelY += (dy / dist) * step;
        }
      } else if (this.state === 'idle') {
        // Snap to current tile
        const w = tileToWorld(this.tileX, this.tileY);
        this.pixelX = w.x;
        this.pixelY = w.y;
      }
    },

    draw(ctx, camera) {
      const sx = (this.pixelX - camera.x) * camera.zoom + window.innerWidth / 2;
      const sy = (this.pixelY - camera.y) * camera.zoom + window.innerHeight / 2;
      const z = camera.zoom;

      // Walk bob
      const walkBob = this.state === 'walking'
        ? Math.sin(Date.now() * 0.008) * 1.5 * z : 0;
      const dy = sy + walkBob;

      // Ground shadow
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * z, 4.5 * z, 1.5 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // Body (trapezoid)
      ctx.beginPath();
      ctx.moveTo(sx - 3.5 * z, dy);
      ctx.lineTo(sx - 2.5 * z, dy - 5 * z);
      ctx.lineTo(sx + 2.5 * z, dy - 5 * z);
      ctx.lineTo(sx + 3.5 * z, dy);
      ctx.closePath();
      ctx.fillStyle = '#d0d0d8';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Head
      ctx.beginPath();
      ctx.arc(sx, dy - 7.5 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#e0e0e8';
      ctx.fill();
      ctx.stroke();

      // Direction indicator (dot on head)
      const dirOffsets = {
        north: { dx: 0, dy: -1.5 * z },
        south: { dx: 0, dy: 1.5 * z },
        east:  { dx: 1.5 * z, dy: 0 },
        west:  { dx: -1.5 * z, dy: 0 },
      };
      const d = dirOffsets[this.direction] || dirOffsets.south;
      ctx.beginPath();
      ctx.arc(sx + d.dx, dy - 7.5 * z + d.dy, 1 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#6e6eff';
      ctx.fill();
    }
  };
}
