/**
 * Unit tests for memory-retrieval.js — RRF hybrid search + semantic search
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
jest.unstable_mockModule('../../compute/embedding-provider.js', () => ({
  generateEmbedding: mockGenerateEmbedding
}));

// Import module AFTER mock setup
const { searchByEmbedding, selectMemories, hybridMemorySearch } = await import('../../compute/memory-retrieval.js');
const { logOperation } = await import('../../compute/operator-logger.js');

// ═══════════════════════════════════════════════════════════════════════════
// Test Data
// ═══════════════════════════════════════════════════════════════════════════

const FAKE_EMBEDDING = Array(384).fill(0.01);

/**
 * Setup mockQuery responses for withHnswConfig transaction wrapper.
 * When hybridMemorySearch has an embedding, it wraps the query in:
 *   BEGIN -> SET LOCAL hnsw.iterative_scan -> actual query -> COMMIT
 * When no embedding, importance fallback runs without wrapper.
 */
function setupHnswMocks(searchRows) {
  mockQuery
    .mockResolvedValueOnce(undefined)  // BEGIN
    .mockResolvedValueOnce(undefined)  // SET LOCAL hnsw.iterative_scan
    .mockResolvedValueOnce({ rows: searchRows })  // actual search query
    .mockResolvedValueOnce(undefined); // COMMIT
}

const MOCK_RRF_ROWS = [
  {
    id: 'mem-1',
    memory_type: 'interaction',
    content: 'They discussed existential philosophy.',
    importance_score: 0.8,
    created_at: '2025-01-15T00:00:00Z',
    rrf_score: 0.032
  },
  {
    id: 'mem-2',
    memory_type: 'insight',
    content: 'They prefer direct communication.',
    importance_score: 0.7,
    created_at: '2025-01-10T00:00:00Z',
    rrf_score: 0.031
  }
];

const MOCK_IMPORTANCE_ROWS = [
  {
    id: 'mem-3',
    memory_type: 'learning',
    content: 'They work as a philosopher at the university.',
    importance_score: 0.6,
    created_at: '2025-01-12T00:00:00Z'
  }
];

const MOCK_TEXT_ROWS = [
  {
    id: 'mem-4',
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

describe('Memory Retrieval — RRF Hybrid Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // hybridMemorySearch — core RRF function
  // ═════════════════════════════════════════════════════════════════════════

  describe('hybridMemorySearch', () => {
    it('should use RRF CTEs with vector_search and importance_search when embedding provided', async () => {
      setupHnswMocks(MOCK_RRF_ROWS);

      const result = await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING);

      expect(result.strategy).toBe('rrf_hybrid');
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].id).toBe('mem-1');

      // calls[0]=BEGIN, calls[1]=SET LOCAL, calls[2]=RRF query, calls[3]=COMMIT
      const sql = mockQuery.mock.calls[2][0];
      expect(sql).toContain('vector_search');
      expect(sql).toContain('importance_search');
      expect(sql).toContain('FULL OUTER JOIN');
      expect(sql).toContain('rrf_score');
      // Verify bare ORDER BY for HNSW index usage
      expect(sql).toContain('ORDER BY embedding <=> $3::vector');
      expect(sql).toContain('ORDER BY importance_score DESC, created_at DESC');
    });

    it('should set hnsw.iterative_scan before search query', async () => {
      setupHnswMocks(MOCK_RRF_ROWS);

      await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING);

      expect(mockQuery.mock.calls[0][0]).toBe('BEGIN');
      expect(mockQuery.mock.calls[1][0]).toContain('hnsw.iterative_scan');
      expect(mockQuery.mock.calls[3][0]).toBe('COMMIT');
    });

    it('should pass personaId, userId, and embedding as query params', async () => {
      setupHnswMocks(MOCK_RRF_ROWS);

      await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING);

      // RRF query is at index 2
      const params = mockQuery.mock.calls[2][1];
      expect(params[0]).toBe('persona-1');
      expect(params[1]).toBe('user-1');
      expect(params[2]).toBe(JSON.stringify(FAKE_EMBEDDING));
    });

    it('should fall back to importance+recency when queryEmbedding is null', async () => {
      mockQuery.mockResolvedValueOnce({ rows: MOCK_IMPORTANCE_ROWS });

      const result = await hybridMemorySearch('persona-1', 'user-1', null);

      expect(result.strategy).toBe('importance_recency');
      expect(result.rows).toHaveLength(1);

      // Verify simple importance+recency query (no CTEs)
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('ORDER BY importance_score DESC, created_at DESC');
      expect(sql).not.toContain('vector_search');
    });

    it('should fall back to importance+recency when RRF returns empty rows', async () => {
      // withHnswConfig: BEGIN, SET LOCAL, RRF (empty), COMMIT
      setupHnswMocks([]);
      // Then importance fallback (outside transaction)
      mockQuery.mockResolvedValueOnce({ rows: MOCK_IMPORTANCE_ROWS });

      const result = await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING);

      expect(result.strategy).toBe('rrf_fallback_to_importance');
      expect(result.rows).toHaveLength(1);
      // 4 from withHnswConfig + 1 from fallback
      expect(mockQuery).toHaveBeenCalledTimes(5);
    });

    it('should respect custom limit option', async () => {
      setupHnswMocks([MOCK_RRF_ROWS[0]]);

      await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING, { limit: 5 });

      const sql = mockQuery.mock.calls[2][0];
      // Final LIMIT should be 5
      expect(sql).toMatch(/ORDER BY rrf_score DESC\s+LIMIT 5/);
      // Over-fetch should be 5 * 2 = 10
      expect(sql).toMatch(/LIMIT 10\s/);
    });

    it('should respect custom rrf_k option', async () => {
      setupHnswMocks(MOCK_RRF_ROWS);

      await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING, { rrf_k: 30 });

      const sql = mockQuery.mock.calls[2][0];
      expect(sql).toContain('1.0 / (30 + v.rank)');
      expect(sql).toContain('1.0 / (30 + i.rank)');
    });

    it('should respect custom overFetchMultiplier option', async () => {
      setupHnswMocks(MOCK_RRF_ROWS);

      await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING, {
        limit: 10,
        overFetchMultiplier: 3
      });

      const sql = mockQuery.mock.calls[2][0];
      // Over-fetch: 10 * 3 = 30
      expect(sql).toMatch(/LIMIT 30\s/);
    });

    it('should ROLLBACK on query error inside withHnswConfig', async () => {
      mockQuery
        .mockResolvedValueOnce(undefined)  // BEGIN
        .mockResolvedValueOnce(undefined)  // SET LOCAL
        .mockRejectedValueOnce(new Error('query failed'))  // RRF query fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING))
        .rejects.toThrow('query failed');
      expect(mockQuery.mock.calls[3][0]).toBe('ROLLBACK');
    });

    it('should return empty rows with fallback strategy when both RRF and fallback return empty', async () => {
      // RRF returns empty (wrapped in transaction)
      setupHnswMocks([]);
      // Fallback also returns empty
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await hybridMemorySearch('persona-1', 'user-1', FAKE_EMBEDDING);

      expect(result.strategy).toBe('rrf_fallback_to_importance');
      expect(result.rows).toEqual([]);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // searchByEmbedding — public API (delegates to hybridMemorySearch)
  // ═════════════════════════════════════════════════════════════════════════

  describe('searchByEmbedding', () => {
    it('should perform RRF hybrid search when embedding generation succeeds', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      setupHnswMocks(MOCK_RRF_ROWS);

      const results = await searchByEmbedding('existential philosophy', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('mem-1');
      expect(mockGenerateEmbedding).toHaveBeenCalledWith('existential philosophy');

      // Should use RRF CTEs (index 2 = actual search query)
      const sql = mockQuery.mock.calls[2][0];
      expect(sql).toContain('vector_search');
      expect(sql).toContain('importance_search');
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
      expect(results[0].id).toBe('mem-4');

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

    it('should return empty array when RRF returns no results', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      // RRF returns empty (wrapped in transaction)
      setupHnswMocks([]);
      // Fallback also returns empty
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const results = await searchByEmbedding('completely unrelated topic', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      expect(results).toEqual([]);
    });

    it('should respect limit option', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      setupHnswMocks([MOCK_RRF_ROWS[0]]);

      await searchByEmbedding('philosophy', {
        personaId: 'persona-1',
        userId: 'user-1',
        limit: 1
      });

      const sql = mockQuery.mock.calls[2][0];
      expect(sql).toMatch(/ORDER BY rrf_score DESC\s+LIMIT 1/);
    });

    it('should use importance+recency fallback when query has no meaningful keywords', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce({ rows: MOCK_IMPORTANCE_ROWS });

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
      // BEGIN succeeds but SET LOCAL fails
      mockQuery
        .mockResolvedValueOnce(undefined)  // BEGIN
        .mockRejectedValueOnce(new Error('connection refused'))  // SET LOCAL fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

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
      setupHnswMocks(MOCK_RRF_ROWS);

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
            strategy: 'rrf_hybrid',
            results_count: 2
          }),
          success: true
        })
      );
    });

    it('should use default options when none provided', async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(FAKE_EMBEDDING);
      // RRF empty (wrapped in transaction)
      setupHnswMocks([]);
      // Fallback empty
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await searchByEmbedding('test query', {
        personaId: 'persona-1',
        userId: 'user-1'
      });

      // Default limit = 10, so over-fetch = 20 (index 2 = RRF query)
      const sql = mockQuery.mock.calls[2][0];
      expect(sql).toMatch(/LIMIT 20\s/); // overFetchLimit
      expect(sql).toMatch(/ORDER BY rrf_score DESC\s+LIMIT 10/); // final limit
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
