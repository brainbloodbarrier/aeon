/**
 * Unit tests for entropy-tracker.js
 * Pynchon Stack: Entropy and decay tracking
 */

import { jest } from '@jest/globals';

// Mock the database pool before importing the module
const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn()
};

jest.unstable_mockModule('pg', () => ({
  default: {
    Pool: jest.fn(() => mockPool)
  }
}));

// Import after mocking
const {
  classifyEntropyState,
  getEntropyEffects,
  getRandomEffect,
  getRandomMarker,
  ENTROPY_THRESHOLDS,
  ENTROPY_STATES,
  ENTROPY_CONFIG
} = await import('../../compute/entropy-tracker.js');

describe('Entropy Tracker Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ENTROPY_THRESHOLDS', () => {
    it('should define ascending threshold values', () => {
      expect(ENTROPY_THRESHOLDS.STABLE).toBeLessThan(ENTROPY_THRESHOLDS.UNSETTLED);
      expect(ENTROPY_THRESHOLDS.UNSETTLED).toBeLessThan(ENTROPY_THRESHOLDS.DECAYING);
      expect(ENTROPY_THRESHOLDS.DECAYING).toBeLessThan(ENTROPY_THRESHOLDS.FRAGMENTING);
      expect(ENTROPY_THRESHOLDS.FRAGMENTING).toBeLessThan(ENTROPY_THRESHOLDS.DISSOLVING);
    });

    it('should have values between 0 and 1', () => {
      Object.values(ENTROPY_THRESHOLDS).forEach(threshold => {
        expect(threshold).toBeGreaterThanOrEqual(0);
        expect(threshold).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('ENTROPY_STATES', () => {
    it('should define all entropy state constants', () => {
      expect(ENTROPY_STATES.STABLE).toBe('stable');
      expect(ENTROPY_STATES.UNSETTLED).toBe('unsettled');
      expect(ENTROPY_STATES.DECAYING).toBe('decaying');
      expect(ENTROPY_STATES.FRAGMENTING).toBe('fragmenting');
      expect(ENTROPY_STATES.DISSOLVING).toBe('dissolving');
    });
  });

  describe('ENTROPY_CONFIG', () => {
    it('should define configuration values', () => {
      expect(ENTROPY_CONFIG.minEntropy).toBe(0);
      expect(ENTROPY_CONFIG.maxEntropy).toBe(1);
      expect(ENTROPY_CONFIG.baseSessionDelta).toBeGreaterThan(0);
      expect(ENTROPY_CONFIG.baseSessionDelta).toBeLessThan(0.1);
    });
  });

  describe('classifyEntropyState', () => {
    it('should return stable for low entropy', () => {
      expect(classifyEntropyState(0)).toBe('stable');
      expect(classifyEntropyState(0.1)).toBe('stable');
      expect(classifyEntropyState(ENTROPY_THRESHOLDS.STABLE - 0.01)).toBe('stable');
    });

    it('should return unsettled for medium-low entropy', () => {
      expect(classifyEntropyState(ENTROPY_THRESHOLDS.STABLE)).toBe('unsettled');
      expect(classifyEntropyState(0.3)).toBe('unsettled');
    });

    it('should return decaying for medium entropy', () => {
      expect(classifyEntropyState(ENTROPY_THRESHOLDS.UNSETTLED)).toBe('decaying');
      expect(classifyEntropyState(0.5)).toBe('decaying');
    });

    it('should return fragmenting for medium-high entropy', () => {
      expect(classifyEntropyState(ENTROPY_THRESHOLDS.DECAYING)).toBe('fragmenting');
      expect(classifyEntropyState(0.7)).toBe('fragmenting');
    });

    it('should return dissolving for high entropy', () => {
      expect(classifyEntropyState(ENTROPY_THRESHOLDS.FRAGMENTING)).toBe('dissolving');
      expect(classifyEntropyState(0.9)).toBe('dissolving');
      expect(classifyEntropyState(1.0)).toBe('dissolving');
    });
  });

  describe('getEntropyEffects', () => {
    it('should return empty array for stable entropy', () => {
      const effects = getEntropyEffects(0.1);
      expect(Array.isArray(effects)).toBe(true);
      expect(effects.length).toBe(0);
    });

    it('should return effects for unsettled entropy', () => {
      const effects = getEntropyEffects(0.3);
      expect(Array.isArray(effects)).toBe(true);
      // May have some effects
    });

    it('should return more effects for higher entropy', () => {
      const lowEffects = getEntropyEffects(0.3);
      const highEffects = getEntropyEffects(0.8);
      expect(highEffects.length).toBeGreaterThanOrEqual(lowEffects.length);
    });
  });

  describe('getRandomEffect', () => {
    it('should return null for stable entropy', () => {
      const effect = getRandomEffect(0.1);
      expect(effect).toBeNull();
    });

    it('should return a string effect for higher entropy', () => {
      // Run multiple times to account for randomness
      let foundEffect = false;
      for (let i = 0; i < 10; i++) {
        const effect = getRandomEffect(0.7);
        if (effect !== null) {
          expect(typeof effect).toBe('string');
          foundEffect = true;
          break;
        }
      }
      // At high entropy, we should usually get an effect
      expect(foundEffect).toBe(true);
    });
  });

  describe('getRandomMarker', () => {
    it('should return a string for any entropy level', () => {
      const marker = getRandomMarker(0.1);
      // May return a marker even at low entropy (stable markers exist)
      if (marker !== null) {
        expect(typeof marker).toBe('string');
      }
    });

    it('should return a string marker for higher entropy', () => {
      // Run multiple times to account for randomness
      let foundMarker = false;
      for (let i = 0; i < 10; i++) {
        const marker = getRandomMarker(0.7);
        if (marker !== null) {
          expect(typeof marker).toBe('string');
          foundMarker = true;
          break;
        }
      }
      expect(foundMarker).toBe(true);
    });
  });
});
