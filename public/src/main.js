/**
 * AEON Frontend — main.js
 * Entry point. Game loop. Connects all systems.
 */

import { GameState } from './state.js';
import { initRenderer, render } from './engine/renderer.js';
import { initInput } from './engine/input.js';
import { initEntities, updateEntities, getEntities } from './entities/index.js';
import { initFX, updateFX, drawFX } from './fx/index.js';
import { initProximity, updateProximity } from './ui/proximity.js';
import { initChat, openChat, closeChat, bindGameState } from './ui/chat.js';
import { initHUD, updateHUD } from './ui/hud.js';
import { getState, getPersonas, connectSSE } from './api/client.js';
import { BAR_MAP } from './engine/tilemap.js';
import { PERSONA_POSITIONS } from './engine/tilemap.js';

// ─── Canvas setup ───
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ─── Init ───
async function init() {
  initRenderer(ctx);

  // Load personas from backend
  try {
    const personas = await getPersonas();
    for (const p of personas) {
      if (PERSONA_POSITIONS[p.name]) {
        GameState.personas.set(p.name, {
          id: p.id,
          name: p.name,
          category: p.category,
          driftScore: 0,
          trustLevel: 'stranger',
          ...PERSONA_POSITIONS[p.name]
        });
      }
    }
  } catch (err) {
    // Fallback — populate from positions with defaults
    for (const [slug, pos] of Object.entries(PERSONA_POSITIONS)) {
      GameState.personas.set(slug, {
        id: null,
        name: slug,
        category: slug === 'pessoa' ? 'portuguese' : slug === 'crowley' ? 'magicians' : 'scientists',
        driftScore: 0,
        trustLevel: 'stranger',
        ...pos
      });
    }
  }

  // Load initial state from backend
  try {
    const state = await getState();
    if (state.entropy) Object.assign(GameState.entropy, state.entropy);
    if (state.ambient) Object.assign(GameState.ambient, state.ambient);
    if (state.paranoia) Object.assign(GameState.paranoia, state.paranoia);
  } catch { /* start with defaults */ }

  // Init systems
  initEntities(GameState);

  initInput(canvas, GameState, {
    onInteract: (slug) => openChat(slug, GameState),
    onCloseChat: () => closeChat(GameState)
  });

  initChat();
  bindGameState(GameState);
  initHUD();
  initProximity();
  initFX();

  // Connect SSE for real-time updates
  connectSSE(GameState);

  // Start game loop
  requestAnimationFrame(gameLoop);
}

// ─── Game Loop ───
function gameLoop(timestamp) {
  const dt = GameState.lastTick ? timestamp - GameState.lastTick : 16;
  GameState.lastTick = timestamp;
  GameState.deltaTime = dt;
  GameState.frameCount++;

  // Update
  updateEntities(dt, GameState);
  updateFX(dt, GameState);
  updateProximity(GameState);
  updateHUD(GameState, dt);

  // Render
  render(ctx, GameState, { map: BAR_MAP }, getEntities());

  // FX overlay (after main render)
  drawFX(ctx, GameState);

  requestAnimationFrame(gameLoop);
}

// ─── Boot ───
init().catch(err => {
  console.error('AEON init failed:', err);
});
