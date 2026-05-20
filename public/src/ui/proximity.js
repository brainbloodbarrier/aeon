/**
 * Proximity prompt — "[E] Conversar com {Name}"
 * Floating HTML near the persona when avatar is close.
 */

import { tileToScreen } from '../engine/renderer.js';
import { PERSONA_POSITIONS, CATEGORY_COLORS } from '../engine/tilemap.js';

let promptEl = null;
let keyEl = null;
let nameEl = null;

export function initProximity() {
  promptEl = document.getElementById('proximity-prompt');
  if (!promptEl) {
    promptEl = document.createElement('div');
    promptEl.id = 'proximity-prompt';
    promptEl.className = 'proximity-prompt hidden';

    keyEl = document.createElement('span');
    keyEl.className = 'key';
    keyEl.textContent = '[E]';

    const textNode = document.createTextNode(' Conversar com ');

    nameEl = document.createElement('strong');
    nameEl.textContent = '';

    promptEl.appendChild(keyEl);
    promptEl.appendChild(textNode);
    promptEl.appendChild(nameEl);

    document.getElementById('ui-layer').appendChild(promptEl);
  } else {
    keyEl = promptEl.querySelector('.key');
    nameEl = promptEl.querySelector('strong');
  }
}

export function updateProximity(gameState) {
  if (!promptEl) return;

  if (gameState.proximityTarget && !gameState.chatOpen) {
    const slug = gameState.proximityTarget;
    const pos = PERSONA_POSITIONS[slug];
    if (!pos) return;

    const screen = tileToScreen(pos.tileX, pos.tileY, gameState.camera);
    const data = gameState.personas.get(slug);
    const name = data?.name || slug;
    const category = data?.category || 'portuguese';
    const color = CATEGORY_COLORS[category] || '#888';

    nameEl.textContent = name;
    keyEl.style.borderColor = color;
    promptEl.style.left = `${screen.x}px`;
    promptEl.style.top = `${screen.y - 60 * gameState.camera.zoom}px`;
    promptEl.style.borderColor = color;
    promptEl.classList.remove('hidden');
  } else {
    promptEl.classList.add('hidden');
  }
}
