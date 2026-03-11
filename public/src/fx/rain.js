/**
 * Rain particle system — tropical diagonal rain with splash effects.
 */

const MAX_DROPS = 200;
const MAX_SPLASHES = 40;
const drops = [];
const splashes = [];
let active = false;

export function initRain() {
  for (let i = 0; i < MAX_DROPS; i++) {
    drops.push(resetDrop({}));
  }
}

function resetDrop(d) {
  d.x = Math.random() * window.innerWidth * 1.3 - window.innerWidth * 0.15;
  d.y = Math.random() * -window.innerHeight;
  d.speed = 300 + Math.random() * 200;
  d.length = 8 + Math.random() * 12;
  d.opacity = 0.08 + Math.random() * 0.18;
  d.width = 0.5 + Math.random() * 0.8;
  return d;
}

export const rain = {
  update(dt, gameState) {
    const w = (gameState.ambient.currentWeather || '').toLowerCase();
    active = w.includes('rain') || w.includes('chuva') || w.includes('storm');

    if (!active) return;

    const dtSec = dt / 1000;

    // Update drops
    for (const d of drops) {
      d.x += d.speed * 0.3 * dtSec;
      d.y += d.speed * dtSec;

      if (d.y > window.innerHeight) {
        // Spawn splash
        if (splashes.length < MAX_SPLASHES) {
          splashes.push({
            x: d.x,
            y: window.innerHeight - Math.random() * 30,
            radius: 1 + Math.random() * 2.5,
            opacity: 0.15 + Math.random() * 0.1,
            life: 250
          });
        }
        resetDrop(d);
      }
    }

    // Update splashes
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.life -= dt;
      s.radius += dt * 0.004;
      s.opacity -= dt * 0.0008;
      if (s.life <= 0 || s.opacity <= 0) {
        splashes.splice(i, 1);
      }
    }
  },

  draw(ctx, gameState) {
    if (!active) return;

    ctx.save();

    // Rain drops
    for (const d of drops) {
      ctx.globalAlpha = d.opacity;
      ctx.strokeStyle = 'rgba(170, 195, 255, 0.18)';
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.length * 0.3, d.y + d.length);
      ctx.stroke();
    }

    // Splash ripples
    for (const s of splashes) {
      ctx.globalAlpha = s.opacity;
      ctx.strokeStyle = 'rgba(170, 195, 255, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
};
