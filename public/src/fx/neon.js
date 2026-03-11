/**
 * Multi-source neon lighting — colored light pools from sign, jukebox, ambient warmth.
 */

import { tileToScreen } from '../engine/renderer.js';

let phase = 0;

// Light sources in tile space
const LIGHTS = [
  { tx: 7, ty: 1, color: [255, 55, 55], radius: 0.28, intensity: 0.045 },    // Neon "O FIM" sign
  { tx: 1, ty: 5, color: [139, 92, 246], radius: 0.16, intensity: 0.03 },     // Jukebox purple
  { tx: 7.5, ty: 4.5, color: [190, 150, 100], radius: 0.35, intensity: 0.02 },// General bar warmth
];

export const neon = {
  update(dt) {
    phase += dt * 0.001;
  },

  draw(ctx, gameState) {
    const { width, height } = ctx.canvas;
    const pulse = 0.5 + Math.sin(phase * 0.8) * 0.15;
    const entropy = gameState.entropy.level;

    for (const light of LIGHTS) {
      const screen = tileToScreen(light.tx, light.ty, gameState.camera);
      const r = width * light.radius;

      const glow = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, r
      );

      const [cr, cg, cb] = light.color;
      const a = light.intensity * pulse * (1 - entropy * 0.3);

      glow.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
      glow.addColorStop(0.5, `rgba(${cr},${cg},${cb},${a * 0.35})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }
  }
};
