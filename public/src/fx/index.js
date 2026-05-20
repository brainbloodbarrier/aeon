/**
 * FX manager — delegates to individual effect modules.
 */

import { rain, initRain } from './rain.js';
import { neon } from './neon.js';
import { crt } from './crt.js';
import { glitch } from './glitch.js';

const fxModules = [rain, neon, glitch, crt]; // crt always last (overlay)

export function initFX() {
  initRain();
}

export function updateFX(dt, gameState) {
  for (const fx of fxModules) {
    if (fx.update) fx.update(dt, gameState);
  }
}

export function drawFX(ctx, gameState) {
  for (const fx of fxModules) {
    if (fx.draw) fx.draw(ctx, gameState);
  }
}
