/**
 * Unit tests for embedding-provider.js
 * Docker Model Runner embedding generation with circuit breaker
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// Import module AFTER mock setup
const {
  generateEmbedding,
  isAvailable,
  _resetCircuitBreaker,
  _getCircuitBreakerState
} = await import('../../compute/embedding-provider.js');
const { logOperation } = await import('../../compute/operator-logger.js');

// ═══════════════════════════════════════════════════════════════════════════
// Test Data
// ═══════════════════════════════════════════════════════════════════════════

const FAKE_384_EMBEDDING = Array(384).fill(0.01);

function mockFetchSuccess(embedding = FAKE_384_EMBEDDING) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ embedding }] })
  });
}

function mockFetchFailure(error = new Error('connection refused')) {
  global.fetch = jest.fn().mockRejectedValue(error);
}

function mockFetchNon200(status = 500) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({})
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('EmbeddingProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetCircuitBreaker();
    delete global.fetch;
  });

  afterAll(() => {
    delete global.fetch;
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Happy Path
  // ═════════════════════════════════════════════════════════════════════════

  describe('generateEmbedding — happy path', () => {
    it('should return 384D embedding for valid text', async () => {
      mockFetchSuccess();

      const result = await generateEmbedding('This is a valid test sentence for embedding');
      expect(result).toEqual(FAKE_384_EMBEDDING);
      expect(result).toHaveLength(384);
    });

    it('should call Docker Model Runner with correct payload', async () => {
      mockFetchSuccess();

      await generateEmbedding('Test embedding text');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/engines/v1/embeddings'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"model":"hf.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF"')
        })
      );
    });

    it('should truncate text to TEXT_LIMIT', async () => {
      mockFetchSuccess();
      const longText = 'a'.repeat(10000);

      await generateEmbedding(longText);

      const call = global.fetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.input.length).toBe(8000);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Input Validation
  // ═════════════════════════════════════════════════════════════════════════

  describe('generateEmbedding — input validation', () => {
    it('should return null for null input', async () => {
      const result = await generateEmbedding(null);
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await generateEmbedding('');
      expect(result).toBeNull();
    });

    it('should return null for text shorter than MIN_TEXT_LENGTH', async () => {
      const result = await generateEmbedding('short');
      expect(result).toBeNull();
    });

    it('should return null for undefined input', async () => {
      const result = await generateEmbedding(undefined);
      expect(result).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Error Handling
  // ═════════════════════════════════════════════════════════════════════════

  describe('generateEmbedding — error handling', () => {
    it('should return null on network error', async () => {
      mockFetchFailure();

      const result = await generateEmbedding('Valid text for embedding test');
      expect(result).toBeNull();
    });

    it('should return null on non-200 response', async () => {
      mockFetchNon200(503);

      const result = await generateEmbedding('Valid text for embedding test');
      expect(result).toBeNull();
    });

    it('should return null on invalid response shape', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'shape' })
      });

      const result = await generateEmbedding('Valid text for embedding test');
      expect(result).toBeNull();
    });

    it('should log embedding_failure on error', async () => {
      mockFetchFailure(new Error('ECONNREFUSED'));

      await generateEmbedding('Valid text for embedding test');

      expect(logOperation).toHaveBeenCalledWith(
        'embedding_failure',
        expect.objectContaining({
          details: expect.objectContaining({
            error_message: 'ECONNREFUSED'
          }),
          success: false
        })
      );
    });

    it('should handle timeout via AbortSignal', async () => {
      global.fetch = jest.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      const result = await generateEmbedding('Valid text for embedding test');
      expect(result).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Circuit Breaker
  // ═════════════════════════════════════════════════════════════════════════

  describe('circuit breaker', () => {
    it('should open circuit after 3 consecutive failures', async () => {
      mockFetchFailure();

      await generateEmbedding('Valid text for test one');
      await generateEmbedding('Valid text for test two');
      await generateEmbedding('Valid text for test three');

      const state = _getCircuitBreakerState();
      expect(state.circuitOpen).toBe(true);
      expect(state.consecutiveFailures).toBe(3);
    });

    it('should return null immediately when circuit is open (cooldown active)', async () => {
      mockFetchFailure();

      // Trigger 3 failures to open circuit
      await generateEmbedding('Valid text for test one');
      await generateEmbedding('Valid text for test two');
      await generateEmbedding('Valid text for test three');

      // Reset fetch mock to track new calls
      global.fetch = jest.fn();

      const result = await generateEmbedding('Valid text should not call fetch');
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should close circuit after successful response', async () => {
      mockFetchFailure();

      // Trigger 2 failures (not enough to open)
      await generateEmbedding('Valid text for test one');
      await generateEmbedding('Valid text for test two');

      // Now succeed
      mockFetchSuccess();
      await generateEmbedding('Valid text for test three');

      const state = _getCircuitBreakerState();
      expect(state.circuitOpen).toBe(false);
      expect(state.consecutiveFailures).toBe(0);
    });

    it('should not open circuit before reaching failure threshold', async () => {
      mockFetchFailure();

      await generateEmbedding('Valid text for test one');
      await generateEmbedding('Valid text for test two');

      const state = _getCircuitBreakerState();
      expect(state.circuitOpen).toBe(false);
      expect(state.consecutiveFailures).toBe(2);
    });

    it('should reset circuit breaker with _resetCircuitBreaker', async () => {
      mockFetchFailure();

      await generateEmbedding('Valid text for test one');
      await generateEmbedding('Valid text for test two');
      await generateEmbedding('Valid text for test three');

      expect(_getCircuitBreakerState().circuitOpen).toBe(true);

      _resetCircuitBreaker();

      const state = _getCircuitBreakerState();
      expect(state.circuitOpen).toBe(false);
      expect(state.consecutiveFailures).toBe(0);
      expect(state.circuitOpenedAt).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // isAvailable
  // ═════════════════════════════════════════════════════════════════════════

  describe('isAvailable', () => {
    it('should return true when circuit is closed', () => {
      expect(isAvailable()).toBe(true);
    });

    it('should return false when circuit is open and in cooldown', async () => {
      mockFetchFailure();

      await generateEmbedding('Valid text for test one');
      await generateEmbedding('Valid text for test two');
      await generateEmbedding('Valid text for test three');

      expect(isAvailable()).toBe(false);
    });
  });
});
