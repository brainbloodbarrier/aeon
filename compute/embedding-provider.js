/**
 * AEON Matrix - Embedding Provider
 *
 * Generates text embeddings via Docker Model Runner (OpenAI-compatible API).
 * Replaces the previous OpenAI-based embedding generation.
 *
 * Circuit breaker pattern: after consecutive failures, stops calling the API
 * for a cooldown period before retrying.
 *
 * @module compute/embedding-provider
 */

import { logOperation } from './operator-logger.js';
import { EMBEDDING_PROVIDER } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// Circuit Breaker State
// ═══════════════════════════════════════════════════════════════════════════

let circuitOpen = false;
let circuitOpenedAt = 0;
let consecutiveFailures = 0;

// ═══════════════════════════════════════════════════════════════════════════
// Embedding Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate an embedding vector for text content.
 * Uses Docker Model Runner's OpenAI-compatible endpoint.
 *
 * @param {string} text - Text to embed (truncated to TEXT_LIMIT chars)
 * @returns {Promise<number[]|null>} 384-dimension embedding vector, or null
 */
export async function generateEmbedding(text) {
  if (!text || text.length < EMBEDDING_PROVIDER.MIN_TEXT_LENGTH) return null;

  // Circuit breaker: skip if open and still in cooldown
  if (circuitOpen && (Date.now() - circuitOpenedAt) < EMBEDDING_PROVIDER.COOLDOWN_MS) {
    return null;
  }

  try {
    const response = await fetch(EMBEDDING_PROVIDER.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_PROVIDER.MODEL,
        input: text.slice(0, EMBEDDING_PROVIDER.TEXT_LIMIT)
      }),
      signal: AbortSignal.timeout(EMBEDDING_PROVIDER.TIMEOUT_MS)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data?.data?.[0]?.embedding) throw new Error('Invalid response shape');

    // Reset circuit breaker on success
    circuitOpen = false;
    consecutiveFailures = 0;

    return data.data[0].embedding;
  } catch (error) {
    consecutiveFailures++;
    if (consecutiveFailures >= EMBEDDING_PROVIDER.FAILURE_THRESHOLD) {
      circuitOpen = true;
      circuitOpenedAt = Date.now();
    }

    console.error('[EmbeddingProvider] Failed:', error.message);
    logOperation('embedding_failure', {
      details: { error_message: error.message, circuit_open: circuitOpen },
      success: false
    }).catch(() => {});

    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if the embedding provider is available.
 *
 * @returns {boolean} true if circuit is closed (provider assumed available)
 */
export function isAvailable() {
  if (!circuitOpen) return true;
  // If cooldown has elapsed, consider it available (half-open)
  return (Date.now() - circuitOpenedAt) >= EMBEDDING_PROVIDER.COOLDOWN_MS;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reset circuit breaker state (for testing).
 */
export function _resetCircuitBreaker() {
  circuitOpen = false;
  circuitOpenedAt = 0;
  consecutiveFailures = 0;
}

/**
 * Get current circuit breaker state (for diagnostics).
 *
 * @returns {{ circuitOpen: boolean, consecutiveFailures: number, circuitOpenedAt: number }}
 */
export function _getCircuitBreakerState() {
  return { circuitOpen, consecutiveFailures, circuitOpenedAt };
}
