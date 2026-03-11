/**
 * AEON Matrix - Prompt Builder
 *
 * Assembles context components into a token-budgeted system prompt.
 * Handles component ordering, token calculation, and memory truncation.
 *
 * Extracted from context-assembler.js — pure prompt construction logic.
 *
 * Feature: 002-invisible-infrastructure
 */

import { logOperation } from './operator-logger.js';
import { CONTEXT_BUDGET } from './constants.js';
import { estimateTokens, truncateMemories } from './memory-orchestrator.js';

// ═══════════════════════════════════════════════════════════════════
// Component Ordering
// ═══════════════════════════════════════════════════════════════════

/**
 * Canonical order for assembling components into the system prompt.
 *
 * Order: setting → ambient → temporal → relationship → persona relations →
 *        memories → persona memories → preterite → entropy → drift correction →
 *        zone resistance → they awareness → counterforce → narrative gravity →
 *        interface bleed
 */
const COMPONENT_ORDER = [
  'setting',
  'ambient',
  'temporal',
  'relationship',
  'personaRelations',
  'memories',
  'personaMemories',
  'preterite',
  'entropy',
  'driftCorrection',
  'zoneResistance',
  'theyAwareness',
  'counterforce',
  'narrativeGravity',
  'interfaceBleed'
];

// ═══════════════════════════════════════════════════════════════════
// Token Budget Calculation
// ═══════════════════════════════════════════════════════════════════

/**
 * Sum token estimates for all non-memory components.
 *
 * @param {Object} components - Assembled context components
 * @returns {number} Total estimated tokens for non-memory components
 */
function calculateNonMemoryTokens(components) {
  let total = 0;
  for (const key of COMPONENT_ORDER) {
    if (key === 'memories') continue;
    total += estimateTokens(components[key]);
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════════
// Prompt Assembly
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a token-budgeted system prompt from assembled context components.
 *
 * Takes the structured components map and assembles them in canonical order,
 * truncating memories if needed to fit within the token budget.
 *
 * @param {Object} components - Map of assembled context components (may contain nulls)
 * @param {number} maxTokens - Maximum token budget
 * @param {Object} logContext - Logging context
 * @param {string} logContext.sessionId - Session UUID
 * @param {string} logContext.personaId - Persona UUID
 * @param {string} logContext.userId - User UUID
 * @param {number} logContext.startTime - Assembly start timestamp
 * @returns {Promise<{systemPrompt: string, totalTokens: number, truncated: boolean}>}
 */
export async function buildSystemPrompt(components, maxTokens, logContext) {
  const { sessionId, personaId, userId, startTime } = logContext;

  // Calculate token usage for non-memory components
  const nonMemoryTokens = calculateNonMemoryTokens(components);

  // Check if we need to truncate memories
  const remainingBudget = maxTokens - nonMemoryTokens - CONTEXT_BUDGET.buffer;
  let truncated = false;

  if (components.memories) {
    const memoryTokens = estimateTokens(components.memories);
    if (memoryTokens > remainingBudget) {
      components.memories = truncateMemories(components.memories, remainingBudget);
      truncated = true;

      await logOperation('context_truncation', {
        sessionId,
        personaId,
        userId,
        details: {
          original_tokens: memoryTokens,
          truncated_to: estimateTokens(components.memories),
          components_affected: ['memories']
        },
        durationMs: Date.now() - startTime,
        success: true
      });
    }
  }

  // Assemble parts in canonical order
  const parts = [];

  for (const key of COMPONENT_ORDER) {
    const value = components[key];
    if (!value) continue;
    // First component has no leading newline
    parts.push(parts.length === 0 ? value : '\n' + value);
  }

  const systemPrompt = parts.join('').trim();
  const totalTokens = estimateTokens(systemPrompt);

  return { systemPrompt, totalTokens, truncated };
}
