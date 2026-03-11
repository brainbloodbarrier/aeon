/**
 * CRT scanline overlay — intensity driven by entropy.
 */

export const crt = {
  update() {},

  draw(ctx, gameState) {
    const { width, height } = ctx.canvas;
    const intensity = 0.03 + gameState.entropy.level * 0.12;

    // Scanlines
    ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }

    // Vignette
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.3,
      width / 2, height / 2, height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${0.3 + gameState.entropy.level * 0.3})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
};
