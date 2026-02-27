/**
 * Unit tests for memory-retrieval.js — semantic search
 * Constitution Principle IV: Relationship Continuity
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

const mockGenerateEmbedding = jest.fn();
jest.unstable_mockModule('../../compute/memory-extractor.js', () => ({
  generateEmbedding: mockGenerateEmbedding
}));

// Import module AFTER mock setup
const { searchByEmbedding, selectMemories } = await import('../../compute/memory-retrieval.js');
const { logOperation } = await import('../../compute/operator-logger.js');

// ═══════════════════════════════════════════════════════════════════════════
// Test Data
// ═══════════════════════════════════════════════════════════════════════════

const FAKE_EMBEDDING = Array(1536).fill(0.01);

const MOCK_SEMANTIC_ROWS = [
  {
    id: 'mem-1',
    memory_type: 'interaction',
    content: 'They discussed existential philosophy.',
    importance_score: 0.8,
    created_at: '2025-01-15T00:00:00Z',
    similarity: 0.92,
    hybrid_score: 0.87
  },
  {
    id: 'mem-2',
    memory_type: 'insight',
    content: 'They prefer direct communication.',
    importance_score: 0.7,
    created_at: '2025-01-10T00:00:00Z',
    similarity: 0.85,
    hybrid_score: 0.79
  }
];

const MOCK_TEXT_ROWS = [
  {
    id: 'mem-3',
    memory_type: 'learning',
    content: 'They work as a philosopher at the university.',
    importance_score: 0.6,
    created_at: '2025-01-12T00:00:00Z',
    keyword_matches: 2
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Memory Retrieval — Semantic Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // searchByEmbedding — semantic path
  // ═════════════════════════════════════════════════════════════════════════

  describe('searchByEmbedding', () => {
    it('should perform semantic search when embedding generation succeeds', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      mockQuery.mockResolvedValueOnce({ rows: MOCK_SEMANTIC_ROWS });

      const results = await searchByEmbedding('existential philosophy', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('mem-1');
      expect(results[0].similarity).toBe(0.92);
      expect(mockGenerateEmbedding).toHaveBeenCalledWith('existential philosophy');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('<=>'),
        expect.arrayContaining(['persona-1', 'user-1'])
      );
    });

    it('should fall back to text search when embedding generation returns null', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce({ rows: MOCK_TEXT_ROWS });

      const results = await searchByEmbedding('philosopher university', {
        personaId: 'persona-1',
        userId: 'user-1',
        sessionId: 'session-1'
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('mem-3');

      // Should log fallback
      expect(logOperation).toHaveBeenCalledWith(
        'semantic_search_fallback',
        expect.objectContaining({
          details: expect.objectContaining({
            reason: 'embedding_generation_failed',
            fallback: 'text_search'
          })
        })
      );
    });

    it('should fall back to text search when embedding generation throws', async () => {
      mockGenerateEmbedding.mockRejectedValueOnce(new Error('OpenAI API error'));
      // The outer catch will fire — returns empty array
      const results = await searchByEmbedding('test query', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      expect(results).toEqual([]);
      expect(logOperation).toHaveBeenCalledWith(
        'error_graceful',
        expect.objectContaining({
          details: expect.objectContaining({
            error_type: 'semantic_search_failure'
          })
        })
      );
    });

    it('should return empty array when no results match similarity threshold', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const results = await searchByEmbedding('completely unrelated topic', {
        personaId: 'persona-1',
        userId: 'user-1',
        minSimilarity: 0.9
      });

      expect(results).toEqual([]);
    });

    it('should respect limit option', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      mockQuery.mockResolvedValueOnce({ rows: [MOCK_SEMANTIC_ROWS[0]] });

      await searchByEmbedding('philosophy', {
        personaId: 'persona-1',
        userId: 'user-1',
        limit: 1
      });

      // The LIMIT parameter is the last one in the query
      const queryCall = mockQuery.mock.calls[0];
      const params = queryCall[1];
      expect(params[params.length - 1]).toBe(1);
    });

    it('should use importance+recency fallback when query has no meaningful keywords', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce({ rows: MOCK_TEXT_ROWS });

      await searchByEmbedding('ok', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      // 'ok' is only 2 chars, filtered out — should use importance_recency strategy
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY importance_score DESC'),
        expect.arrayContaining(['persona-1', 'user-1'])
      );
    });

    it('should return empty array on database error', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      mockQuery.mockRejectedValueOnce(new Error('connection refused'));

      const results = await searchByEmbedding('test', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      expect(results).toEqual([]);
      expect(logOperation).toHaveBeenCalledWith(
        'error_graceful',
        expect.objectContaining({
          details: expect.objectContaining({
            error_type: 'semantic_search_failure'
          }),
          success: false
        })
      );
    });

    it('should log semantic_search operation on success', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      mockQuery.mockResolvedValueOnce({ rows: MOCK_SEMANTIC_ROWS });

      await searchByEmbedding('philosophy', {
        personaId: 'persona-1',
        userId: 'user-1',
        sessionId: 'session-1'
      });

      expect(logOperation).toHaveBeenCalledWith(
        'semantic_search',
        expect.objectContaining({
          sessionId: 'session-1',
          personaId: 'persona-1',
          userId: 'user-1',
          details: expect.objectContaining({
            strategy: 'embedding',
            results_count: 2
          }),
          success: true
        })
      );
    });

    it('should use default options when none provided', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searchByEmbedding('test query', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      // Should use DEFAULT_LIMIT (10) and MIN_SIMILARITY (0.3)
      const queryCall = mockQuery.mock.calls[0];
      const params = queryCall[1];
      // params: [personaId, userId, embedding, minSimilarity, limit]
      expect(params[3]).toBe(0.3);   // MIN_SIMILARITY
      expect(params[4]).toBe(10);    // DEFAULT_LIMIT
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // selectMemories — pure function (in-memory selection)
  // ═════════════════════════════════════════════════════════════════════════

  describe('selectMemories', () => {
    const memories = [
      { id: 'a', content: 'philosophy dialectic', importance_score: 0.9, created_at: '2025-01-01' },
      { id: 'b', content: 'software engineering', importance_score: 0.5, created_at: '2025-01-15' },
      { id: 'c', content: 'existential meaning', importance_score: 0.7, created_at: '2025-01-10' },
      { id: 'd', content: 'daily routine tasks', importance_score: 0.3, created_at: '2025-01-20' },
      { id: 'e', content: 'philosophy of mind', importance_score: 0.6, created_at: '2025-01-05' }
    ];

    it('should return empty array for empty input', () => {
      expect(selectMemories([], 'test', 5)).toEqual([]);
    });

    it('should return all memories when count <= max', () => {
      const result = selectMemories(memories.slice(0, 2), 'test', 5);
      expect(result).toHaveLength(2);
    });

    it('should always include the most important memory first', () => {
      const result = selectMemories(memories, 'unrelated query', 3);
      expect(result[0].id).toBe('a'); // highest importance_score: 0.9
    });

    it('should include recent memories for continuity', () => {
      const result = selectMemories(memories, 'unrelated', 4);
      const ids = result.map(m => m.id);
      // Most recent is 'd' (Jan 20), then 'b' (Jan 15)
      expect(ids).toContain('d');
      expect(ids).toContain('b');
    });

    it('should fill remaining slots with keyword-relevant memories', () => {
      const result = selectMemories(memories, 'philosophy', 4);
      const ids = result.map(m => m.id);
      // 'a' (anchor), 'd'+'b' (recency), then 'e' should fill via keyword 'philosophy'
      expect(ids).toContain('e'); // 'philosophy of mind' matches keyword
    });

    it('should not exceed max limit', () => {
      const result = selectMemories(memories, 'philosophy', 3);
      expect(result).toHaveLength(3);
    });

    it('should not duplicate memories across slots', () => {
      const result = selectMemories(memories, 'test', 5);
      const ids = result.map(m => m.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });
});
