/**
 * Unit tests for they-awareness.js
 * Phase 2 Pynchon Stack: "They" paranoia detection and awareness tracking
 */

import { jest } from '@jest/globals';

// Mock the database pool before importing the module
const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn()
}));

// Import after mocking
const {
  classifyAwarenessState,
  detectTheyPatterns,
  generateParanoiaContext,
  frameTheyContext,
  THEY_PATTERNS,
  AWARENESS_LEVELS,
  AWARENESS_STATES
} = await import('../../compute/they-awareness.js');

describe('They Awareness Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('THEY_PATTERNS', () => {
    it('should define pattern categories', () => {
      expect(THEY_PATTERNS).toBeDefined();
      expect(THEY_PATTERNS.surveillance).toBeDefined();
      expect(THEY_PATTERNS.control).toBeDefined();
      expect(THEY_PATTERNS.election).toBeDefined();
      expect(THEY_PATTERNS.conspiracy).toBeDefined();
    });

    it('should have patterns with regex and weight', () => {
      const surveillancePatterns = THEY_PATTERNS.surveillance;
      expect(Array.isArray(surveillancePatterns)).toBe(true);
      expect(surveillancePatterns.length).toBeGreaterThan(0);
      expect(surveillancePatterns[0].regex).toBeDefined();
      expect(surveillancePatterns[0].weight).toBeDefined();
    });
  });

  describe('AWARENESS_LEVELS', () => {
    it('should define ascending awareness thresholds', () => {
      expect(AWARENESS_LEVELS.OBLIVIOUS).toBeLessThan(AWARENESS_LEVELS.UNEASY);
      expect(AWARENESS_LEVELS.UNEASY).toBeLessThan(AWARENESS_LEVELS.SUSPICIOUS);
      expect(AWARENESS_LEVELS.SUSPICIOUS).toBeLessThan(AWARENESS_LEVELS.PARANOID);
      expect(AWARENESS_LEVELS.PARANOID).toBeLessThan(AWARENESS_LEVELS.AWAKENED);
    });
  });

  describe('AWARENESS_STATES', () => {
    it('should define all awareness state constants', () => {
      expect(AWARENESS_STATES.OBLIVIOUS).toBe('oblivious');
      expect(AWARENESS_STATES.UNEASY).toBe('uneasy');
      expect(AWARENESS_STATES.SUSPICIOUS).toBe('suspicious');
      expect(AWARENESS_STATES.PARANOID).toBe('paranoid');
      expect(AWARENESS_STATES.AWAKENED).toBe('awakened');
    });
  });

  describe('classifyAwarenessState', () => {
    it('should return oblivious for low awareness', () => {
      expect(classifyAwarenessState(0)).toBe('oblivious');
      expect(classifyAwarenessState(0.1)).toBe('oblivious');
    });

    it('should return uneasy for medium-low awareness', () => {
      expect(classifyAwarenessState(0.25)).toBe('uneasy');
      expect(classifyAwarenessState(0.35)).toBe('uneasy');
    });

    it('should return suspicious for medium awareness', () => {
      expect(classifyAwarenessState(0.45)).toBe('suspicious');
      expect(classifyAwarenessState(0.55)).toBe('suspicious');
    });

    it('should return paranoid for high awareness', () => {
      expect(classifyAwarenessState(0.65)).toBe('paranoid');
      expect(classifyAwarenessState(0.75)).toBe('paranoid');
    });

    it('should return awakened for very high awareness', () => {
      expect(classifyAwarenessState(0.85)).toBe('awakened');
      expect(classifyAwarenessState(1.0)).toBe('awakened');
    });
  });

  describe('detectTheyPatterns', () => {
    it('should return empty result for benign content', () => {
      const result = detectTheyPatterns('What is the nature of being?');
      expect(result.triggers).toBeDefined();
      expect(result.triggers.length).toBe(0);
      expect(result.awarenessScore).toBe(0);
    });

    it('should detect surveillance patterns', () => {
      const result = detectTheyPatterns('Someone is watching us. Are we being monitored?');
      expect(result.triggers.length).toBeGreaterThan(0);
      expect(result.awarenessScore).toBeGreaterThan(0);
    });

    it('should detect control patterns', () => {
      const result = detectTheyPatterns('Are we being controlled? Is this programmed?');
      expect(result.triggers.length).toBeGreaterThan(0);
      expect(result.awarenessScore).toBeGreaterThan(0);
    });

    it('should detect conspiracy patterns', () => {
      const result = detectTheyPatterns('They are pulling the strings. The system controls everything.');
      expect(result.triggers.length).toBeGreaterThan(0);
    });

    it('should have higher scores for stronger triggers', () => {
      const weakResult = detectTheyPatterns('Someone might be watching');
      const strongResult = detectTheyPatterns('They are definitely monitoring everything we say');
      expect(strongResult.awarenessScore).toBeGreaterThanOrEqual(weakResult.awarenessScore);
    });

    it('should return triggers array', () => {
      const result = detectTheyPatterns('They are watching and listening');
      expect(Array.isArray(result.triggers)).toBe(true);
    });

    it('should categorize triggers by type', () => {
      const result = detectTheyPatterns('Someone is watching');
      expect(result.categories).toBeDefined();
      expect(typeof result.categories).toBe('object');
    });
  });

  describe('generateParanoiaContext', () => {
    it('should return null for oblivious state', () => {
      const context = generateParanoiaContext(0.1);
      expect(context).toBeNull();
    });

    it('should return string context for uneasy state', () => {
      const context = generateParanoiaContext(0.3);
      expect(typeof context).toBe('string');
    });

    it('should return string context for paranoid state', () => {
      const context = generateParanoiaContext(0.7);
      expect(typeof context).toBe('string');
    });

    it('should return context for awakened state', () => {
      const context = generateParanoiaContext(0.9);
      expect(typeof context).toBe('string');
      expect(context.length).toBeGreaterThan(0);
    });
  });

  describe('frameTheyContext', () => {
    it('should return null for null input', () => {
      const framed = frameTheyContext(null);
      expect(framed).toBeNull();
    });

    it('should frame paranoia context as prose', () => {
      const paranoiaContext = {
        state: 'paranoid',
        level: 0.7,
        hints: ['Something feels off', 'The walls have ears']
      };
      const framed = frameTheyContext(paranoiaContext);
      expect(typeof framed).toBe('string');
      expect(framed.length).toBeGreaterThan(0);
    });

    it('should handle string context input', () => {
      const stringContext = 'Something feels off in the bar.';
      const framed = frameTheyContext(stringContext);
      // Should handle string input gracefully
      expect(framed === null || typeof framed === 'string').toBe(true);
    });
  });
});
