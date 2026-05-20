/**
 * NPC persona entity.
 * Sits at the counter, shows trust level, drifts when unstable.
 */

import { tileToScreen } from '../engine/renderer.js';

export function createPersona(slug, name, category, tileX, tileY, color) {
  return {
    slug,
    name,
    category,
    tileX,
    tileY,
    color,
    state: 'idle',       // idle | talking | drifting
    driftScore: 0,
    trustLevel: 'stranger',
    bobOffset: Math.random() * Math.PI * 2, // desync bobs
    driftTimer: 0,

    update(dt, gameState) {
      // Sync from GameState
      const data = gameState.personas.get(this.slug);
      if (data) {
        this.driftScore = data.driftScore || 0;
        this.trustLevel = data.trustLevel || 'stranger';
      }

      // Bob animation
      this.bobOffset += dt * 0.001;

      // Drift timer
      if (this.driftTimer > 0) {
        this.driftTimer -= dt;
        if (this.driftTimer <= 0) {
          this.state = 'idle';
          this.driftTimer = 0;
        }
      }
    },

    triggerDrift(duration = 5000) {
      this.state = 'drifting';
      this.driftTimer = duration;
    },

    draw(ctx, camera) {
      const screen = tileToScreen(this.tileX, this.tileY, camera);
      let sx = screen.x;
      let sy = screen.y;
      const z = camera.zoom;

      // Idle bob
      const bob = Math.sin(this.bobOffset * 1.5) * 1.5 * z;
      sy += bob;

      // Drift trembling
      if (this.state === 'drifting') {
        sx += (Math.random() - 0.5) * 3 * z;
        sy += (Math.random() - 0.5) * 2 * z;
      }

      const bodyColor = this.state === 'drifting'
        ? flashColor(this.color, this.driftTimer)
        : this.color;

      // Desaturate for stranger
      ctx.globalAlpha = this.trustLevel === 'stranger' ? 0.5 : 1.0;

      // Ground shadow
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * z, 5 * z, 1.8 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fill();

      // Trust glow (before body for backdrop effect)
      if (this.trustLevel === 'familiar' || this.trustLevel === 'confidant') {
        const glowColor = this.trustLevel === 'confidant' ? '#FFD700' : this.color;
        const blur = (this.trustLevel === 'confidant' ? 14 : 8) * z;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = blur;
      }

      // Body (trapezoid — slightly larger than avatar)
      ctx.beginPath();
      ctx.moveTo(sx - 4.5 * z, sy);
      ctx.lineTo(sx - 3 * z, sy - 7 * z);
      ctx.lineTo(sx + 3 * z, sy - 7 * z);
      ctx.lineTo(sx + 4.5 * z, sy);
      ctx.closePath();
      ctx.fillStyle = bodyColor;
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(sx, sy - 10 * z, 3 * z, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor;
      ctx.fill();

      // Clear shadow for subsequent draws
      ctx.shadowBlur = 0;

      // Border
      const borderColor = this.trustLevel === 'confidant'
        ? '#FFD700'
        : 'rgba(255,255,255,0.1)';
      const borderWidth = this.trustLevel === 'confidant' ? 1.5 : 0.5;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;

      // Outline body
      ctx.beginPath();
      ctx.moveTo(sx - 4.5 * z, sy);
      ctx.lineTo(sx - 3 * z, sy - 7 * z);
      ctx.lineTo(sx + 3 * z, sy - 7 * z);
      ctx.lineTo(sx + 4.5 * z, sy);
      ctx.closePath();
      ctx.stroke();

      // Outline head
      ctx.beginPath();
      ctx.arc(sx, sy - 10 * z, 3 * z, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1.0;

      // Initial letter on body
      ctx.fillStyle = '#0a0a0f';
      ctx.font = `bold ${Math.round(6 * z)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.name[0].toUpperCase(), sx, sy - 3.5 * z);

      // Name tag above head
      const nameAlpha = this.trustLevel === 'stranger' ? 0.3 : 0.8;
      ctx.fillStyle = `rgba(255,255,255,${nameAlpha})`;
      ctx.font = `${Math.round(5 * z)}px monospace`;
      ctx.fillText(this.name, sx, sy - 15 * z);

      // Trust dot
      const trustColors = {
        stranger: '#555',
        acquaintance: '#FBBF24',
        familiar: '#4ADE80',
        confidant: '#FFD700'
      };
      ctx.beginPath();
      ctx.arc(sx, sy - 17 * z, 1.5 * z, 0, Math.PI * 2);
      ctx.fillStyle = trustColors[this.trustLevel] || '#555';
      ctx.fill();
    }
  };
}

function flashColor(base, timer) {
  // Flicker between base color and dim during drift
  return Math.floor(timer / 100) % 2 === 0 ? base : '#333333';
}
