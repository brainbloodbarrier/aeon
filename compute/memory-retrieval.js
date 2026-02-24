/**
 * AEON Matrix - Memory Retrieval
 *
 * This module determines which memories to inject when a persona is invoked.
 * Run via Node.js Sandbox MCP: run_js_ephemeral
 *
 * Input (via environment):
 *   MEMORIES: JSON array of memory objects
 *   QUERY: Current user question
 *   MAX_MEMORIES: Maximum memories to return (default: 5)
 *
 * Output: JSON array of selected memories
 */

// Parse inputs
let allMemories;
try {
  allMemories = JSON.parse(process.env.MEMORIES || '[]');
} catch (error) {
  console.error(JSON.stringify({ error: 'Failed to parse MEMORIES', message: error.message }));
  process.exit(1);
}
const currentQuery = process.env.QUERY || '';
const maxMemories = parseInt(process.env.MAX_MEMORIES || '5', 10);

/**
 * Select the most relevant memories for injection.
 *
 * Strategy: Hybrid approach
 * 1. Always include the most important memory (anchor)
 * 2. Include recent memories for continuity
 * 3. Fill remaining slots with semantically relevant memories
 *
 * @param {Array} memories - All available memories
 * @param {string} query - Current user question
 * @param {number} max - Maximum memories to return
 * @returns {Array} Selected memories
 */
function selectMemories(memories, query, max) {
  if (memories.length === 0) return [];
  if (memories.length <= max) return memories;

  const selected = [];
  const used = new Set();

  // ─────────────────────────────────────────────────────────────
  // SLOT 1: Most important memory (the anchor)
  // This ensures the persona's most significant memory is always present
  // ─────────────────────────────────────────────────────────────
  const mostImportant = memories.reduce((best, m) =>
    m.importance_score > best.importance_score ? m : best
  );
  selected.push(mostImportant);
  used.add(mostImportant.id);

  // ─────────────────────────────────────────────────────────────
  // SLOTS 2-3: Most recent memories (continuity)
  // These provide conversational context
  // ─────────────────────────────────────────────────────────────
  const byRecency = [...memories]
    .filter(m => !used.has(m.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  for (let i = 0; i < 2 && i < byRecency.length && selected.length < max; i++) {
    selected.push(byRecency[i]);
    used.add(byRecency[i].id);
  }

  // ─────────────────────────────────────────────────────────────
  // REMAINING SLOTS: Semantic relevance
  // If embeddings are available, use cosine similarity
  // Otherwise, fall back to keyword matching
  // ─────────────────────────────────────────────────────────────
  const remaining = memories.filter(m => !used.has(m.id));

  if (remaining.length > 0 && remaining[0].embedding) {
    // TODO: Implement proper semantic search when query embedding is available
    // For now, use importance as proxy for relevance
    const byImportance = remaining
      .sort((a, b) => b.importance_score - a.importance_score);

    for (const m of byImportance) {
      if (selected.length >= max) break;
      selected.push(m);
    }
  } else {
    // Keyword matching fallback
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = remaining.map(m => ({
      memory: m,
      score: queryWords.filter(w =>
        m.content.toLowerCase().includes(w)
      ).length
    }));

    scored.sort((a, b) => b.score - a.score);

    for (const { memory } of scored) {
      if (selected.length >= max) break;
      selected.push(memory);
    }
  }

  return selected;
}

// Execute and output
const result = selectMemories(allMemories, currentQuery, maxMemories);
console.log(JSON.stringify(result, null, 2));
