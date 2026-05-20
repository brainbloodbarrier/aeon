/**
 * Entropy-driven glitch effects.
 *
 * stable (< 0.3): nothing
 * unsettled (0.3-0.5): occasional RGB shift
 * decaying (0.5-0.7): RGB + scanline jitter
 * fragmenting (0.7-0.9): screen tear, pixel noise
 * dissolving (0.9-1.0): heavy RGB, screen shake, static
 */

let nextGlitchAt = 0;
let glitchActive = false;
let glitchDuration = 0;

export const glitch = {
  update(dt, gameState) {
    const entropy = gameState.entropy.level;
    if (entropy < 0.3) {
      glitchActive = false;
      return;
    }

    nextGlitchAt -= dt;
    if (glitchActive) {
      glitchDuration -= dt;
      if (glitchDuration <= 0) glitchActive = false;
    }

    if (nextGlitchAt <= 0 && !glitchActive) {
      // Higher entropy = more frequent glitches
      const minInterval = entropy > 0.7 ? 500 : entropy > 0.5 ? 2000 : 5000;
      const maxInterval = entropy > 0.7 ? 2000 : entropy > 0.5 ? 5000 : 10000;
      nextGlitchAt = minInterval + Math.random() * (maxInterval - minInterval);
      glitchActive = true;
      glitchDuration = 50 + Math.random() * 150;
    }
  },

  draw(ctx, gameState) {
    if (!glitchActive) return;

    const { width, height } = ctx.canvas;
    const entropy = gameState.entropy.level;

    // RGB channel shift
    if (entropy >= 0.3) {
      try {
        const shift = Math.floor(2 + entropy * 4);
        const sliceH = 20 + Math.random() * 60;
        const sliceY = Math.floor(Math.random() * (height - sliceH));

        const imageData = ctx.getImageData(0, sliceY, width, sliceH);
        const shifted = ctx.createImageData(width, sliceH);
        const src = imageData.data;
        const dst = shifted.data;

        for (let i = 0; i < src.length; i += 4) {
          const pixel = Math.floor(i / 4);
          const x = pixel % width;

          // Shift red channel right
          const srcR = Math.min(width - 1, x + shift);
          const srcIdx = (Math.floor(pixel / width) * width + srcR) * 4;
          dst[i] = src[srcIdx] || src[i];     // R shifted
          dst[i + 1] = src[i + 1];            // G stays
          dst[i + 2] = src[i + 2];            // B stays
          dst[i + 3] = src[i + 3];            // A stays
        }

        ctx.putImageData(shifted, 0, sliceY);
      } catch { /* canvas security */ }
    }

    // Screen tear (fragmenting+)
    if (entropy >= 0.7) {
      const tearY = Math.floor(Math.random() * height);
      const tearH = 2 + Math.floor(Math.random() * 8);
      const tearShift = (Math.random() - 0.5) * 20;
      try {
        const strip = ctx.getImageData(0, tearY, width, tearH);
        ctx.putImageData(strip, tearShift, tearY);
      } catch { /* graceful */ }
    }

    // Pixel noise (fragmenting+)
    if (entropy >= 0.7 && Math.random() > 0.5) {
      const patches = Math.floor(entropy * 5);
      for (let p = 0; p < patches; p++) {
        const px = Math.random() * width;
        const py = Math.random() * height;
        const ps = 3 + Math.random() * 10;
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.3)`;
        ctx.fillRect(px, py, ps, ps);
      }
    }

    // Screen shake (dissolving)
    if (entropy >= 0.9) {
      const shakeX = (Math.random() - 0.5) * 6;
      const shakeY = (Math.random() - 0.5) * 4;
      ctx.translate(shakeX, shakeY);
    }
  }
};
