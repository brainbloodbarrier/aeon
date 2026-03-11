/**
 * Static bar objects — jukebox, neon sign, decorative bottles.
 * Rendered as entities for depth sorting.
 */

import { tileToScreen } from '../engine/renderer.js';

export function createJukebox(tileX, tileY) {
  let pulsePhase = Math.random() * Math.PI * 2;

  return {
    tileX,
    tileY,
    type: 'jukebox',

    update(dt, gameState) {
      const bpm = 60 + gameState.entropy.level * 40;
      pulsePhase += dt * 0.001 * (bpm / 60) * Math.PI * 2;
    },

    draw(ctx, camera) {
      const screen = tileToScreen(this.tileX, this.tileY, camera);
      const z = camera.zoom;
      const size = 10 * z;
      const pulse = 0.7 + Math.sin(pulsePhase) * 0.3;

      // Cabinet body
      ctx.fillStyle = '#1e1224';
      ctx.fillRect(screen.x - size * 0.55, screen.y - size * 1.6, size * 1.1, size * 1.6);

      // Cabinet edge highlight
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(screen.x - size * 0.55, screen.y - size * 1.6, size * 1.1, size * 1.6);

      // Record slot (dark band at top)
      ctx.fillStyle = '#0a0610';
      ctx.fillRect(screen.x - size * 0.4, screen.y - size * 1.5, size * 0.8, size * 0.3);

      // Main glow panel
      ctx.fillStyle = `rgba(139, 92, 246, ${pulse * 0.6})`;
      ctx.fillRect(screen.x - size * 0.38, screen.y - size * 1.15, size * 0.76, size * 0.7);

      // Light strips
      ctx.fillStyle = `rgba(180, 140, 255, ${pulse * 0.4})`;
      for (let i = 0; i < 3; i++) {
        const stripY = screen.y - size * 1.1 + i * size * 0.2;
        ctx.fillRect(screen.x - size * 0.3, stripY, size * 0.6, 1 * z);
      }

      // Glow aura
      ctx.shadowColor = '#8B5CF6';
      ctx.shadowBlur = 10 * z * pulse;
      ctx.fillStyle = `rgba(139, 92, 246, ${pulse * 0.3})`;
      ctx.fillRect(screen.x - size * 0.38, screen.y - size * 1.15, size * 0.76, size * 0.7);
      ctx.shadowBlur = 0;
    }
  };
}

export function createNeonSign(tileX, tileY) {
  let flickerTimer = 0;
  let flickering = false;
  let buzzPhase = 0;

  return {
    tileX,
    tileY,
    type: 'neon',

    update(dt, gameState) {
      flickerTimer += dt;
      buzzPhase += dt * 0.003;

      if (gameState.entropy.level > 0.5 && flickerTimer > 2000 + Math.random() * 3000) {
        flickering = true;
        flickerTimer = 0;
        setTimeout(() => { flickering = false; }, 100 + Math.random() * 200);
      }
    },

    draw(ctx, camera) {
      const screen = tileToScreen(this.tileX, this.tileY, camera);
      const z = camera.zoom;
      const sy = screen.y - 40 * z;

      if (flickering && Math.random() > 0.5) return;

      const alpha = flickering ? 0.3 : 0.85 + Math.sin(buzzPhase) * 0.1;
      const fontSize = Math.round(10 * z);

      ctx.save();

      // Outer glow (wide, diffuse)
      ctx.shadowColor = '#ff2222';
      ctx.shadowBlur = 30 * z;
      ctx.fillStyle = `rgba(255, 50, 50, ${alpha * 0.3})`;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('O FIM', screen.x, sy);

      // Inner glow (tight, bright)
      ctx.shadowColor = '#ff6644';
      ctx.shadowBlur = 12 * z;
      ctx.fillStyle = `rgba(255, 80, 60, ${alpha})`;
      ctx.fillText('O FIM', screen.x, sy);

      // Core text (brightest)
      ctx.shadowBlur = 4 * z;
      ctx.fillStyle = `rgba(255, 180, 160, ${alpha})`;
      ctx.fillText('O FIM', screen.x, sy);

      ctx.restore();
    }
  };
}
