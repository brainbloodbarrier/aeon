/**
 * Input handler — mouse, keyboard, zoom.
 */

import { screenToTile } from './renderer.js';
import { findPath } from './pathfinding.js';

let gameState = null;
let canvas = null;

// Callbacks set by main.js
let onInteract = null;
let onCloseChat = null;

export function initInput(canvasEl, state, callbacks = {}) {
  canvas = canvasEl;
  gameState = state;
  onInteract = callbacks.onInteract || null;
  onCloseChat = callbacks.onCloseChat || null;

  canvas.addEventListener('click', handleClick);
  window.addEventListener('keydown', handleKeydown);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
}

function handleClick(e) {
  if (gameState.chatOpen) return;

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const tile = screenToTile(sx, sy, gameState.camera);

  const path = findPath(
    gameState.avatar.tileX,
    gameState.avatar.tileY,
    tile.x,
    tile.y
  );

  if (path.length > 0) {
    gameState.avatar.path = path;
    gameState.avatar.state = 'walking';
  }
}

function handleKeydown(e) {
  // Esc — close chat
  if (e.key === 'Escape' && gameState.chatOpen) {
    if (onCloseChat) onCloseChat();
    return;
  }

  // E — interact
  if ((e.key === 'e' || e.key === 'E') && gameState.proximityTarget && !gameState.chatOpen) {
    if (onInteract) onInteract(gameState.proximityTarget);
    return;
  }

  if (gameState.chatOpen) return; // Don't process movement while chatting

  // WASD / Arrow movement
  const dirs = {
    'w': { dx: 0, dy: -1, dir: 'north' },
    'ArrowUp': { dx: 0, dy: -1, dir: 'north' },
    's': { dx: 0, dy: 1, dir: 'south' },
    'ArrowDown': { dx: 0, dy: 1, dir: 'south' },
    'a': { dx: -1, dy: 0, dir: 'west' },
    'ArrowLeft': { dx: -1, dy: 0, dir: 'west' },
    'd': { dx: 1, dy: 0, dir: 'east' },
    'ArrowRight': { dx: 1, dy: 0, dir: 'east' },
  };

  const move = dirs[e.key];
  if (move && gameState.avatar.state === 'idle') {
    const nx = gameState.avatar.tileX + move.dx;
    const ny = gameState.avatar.tileY + move.dy;
    gameState.avatar.direction = move.dir;

    const path = findPath(gameState.avatar.tileX, gameState.avatar.tileY, nx, ny);
    if (path.length > 0) {
      gameState.avatar.path = path;
      gameState.avatar.state = 'walking';
    }
  }
}

function handleWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.2 : 0.2;
  gameState.camera.zoom = Math.max(1, Math.min(4, gameState.camera.zoom + delta));
}

export function destroyInput() {
  canvas?.removeEventListener('click', handleClick);
  window.removeEventListener('keydown', handleKeydown);
  canvas?.removeEventListener('wheel', handleWheel);
}
