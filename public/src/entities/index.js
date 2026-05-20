/**
 * Entity manager.
 * Manages all entities, depth sorting, and proximity detection.
 */

import { createAvatar } from './avatar.js';
import { createPersona } from './persona.js';
import { createJukebox, createNeonSign } from './furniture.js';
import { SPAWN_POINT, PERSONA_POSITIONS, CATEGORY_COLORS } from '../engine/tilemap.js';

const PROXIMITY_RANGE = 2.5; // tiles

let avatar = null;
let entities = [];

export function initEntities(gameState) {
  entities = [];

  // Avatar
  avatar = createAvatar(SPAWN_POINT.x, SPAWN_POINT.y);
  entities.push(avatar);

  // Personas
  for (const [slug, pos] of Object.entries(PERSONA_POSITIONS)) {
    const data = gameState.personas.get(slug);
    const category = data?.category || 'portuguese';
    const name = data?.name || slug;
    const color = CATEGORY_COLORS[category] || '#888888';
    const persona = createPersona(slug, name, category, pos.tileX, pos.tileY, color);
    entities.push(persona);
  }

  // Furniture
  entities.push(createJukebox(1, 5));
  entities.push(createNeonSign(7, 0));

  return entities;
}

export function updateEntities(dt, gameState) {
  // Update all
  for (const entity of entities) {
    if (entity.update) entity.update(dt, gameState);
  }

  // Proximity detection
  gameState.proximityTarget = null;
  for (const entity of entities) {
    if (!entity.slug) continue; // Only personas have slugs
    const dx = Math.abs(gameState.avatar.tileX - entity.tileX);
    const dy = Math.abs(gameState.avatar.tileY - entity.tileY);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= PROXIMITY_RANGE) {
      gameState.proximityTarget = entity.slug;
      break;
    }
  }

  // Center camera on avatar
  gameState.camera.x = avatar.pixelX;
  gameState.camera.y = avatar.pixelY;
}

export function getEntities() {
  return entities;
}

export function getPersonaEntity(slug) {
  return entities.find(e => e.slug === slug);
}
