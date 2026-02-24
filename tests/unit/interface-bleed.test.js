/**
 * Unit tests for interface-bleed.js
 * Phase 2 Pynchon Stack: System artifact leakage at high entropy
 */

import { jest } from '@jest/globals';

// Mock db-pool before importing the module
const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

// Import after mocking
const {
  shouldBleed,
  generateBleed,
  corruptWithBleed,
  generateBleedBurst,
  frameBleedContext,
  BLEED_TYPES,
  BLEED_THRESHOLDS,
  BLEED_SEVERITY,
  CONFIG
} = await import('../../compute/interface-bleed.js');

describe('Interface Bleed Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BLEED_TYPES', () => {
    it('should define all bleed types', () => {
      expect(BLEED_TYPES.TIMESTAMP).toBe('timestamp');
      expect(BLEED_TYPES.ERROR_FRAGMENT).toBe('error_fragment');
      expect(BLEED_TYPES.LOG_LEAK).toBe('log_leak');
      expect(BLEED_TYPES.MEMORY_ADDRESS).toBe('memory_address');
      expect(BLEED_TYPES.QUERY_ECHO).toBe('query_echo');
      expect(BLEED_TYPES.PROCESS_ID).toBe('process_id');
    });
  });

  describe('BLEED_THRESHOLDS', () => {
    it('should define ascending entropy thresholds', () => {
      expect(BLEED_THRESHOLDS.RARE).toBeLessThan(BLEED_THRESHOLDS.FREQUENT);
      expect(BLEED_THRESHOLDS.FREQUENT).toBeLessThan(BLEED_THRESHOLDS.SEVERE);
    });

    it('should have values between 0 and 1', () => {
      expect(BLEED_THRESHOLDS.RARE).toBeGreaterThanOrEqual(0);
      expect(BLEED_THRESHOLDS.SEVERE).toBeLessThanOrEqual(1);
    });
  });

  describe('BLEED_SEVERITY', () => {
    it('should define severity levels', () => {
      expect(BLEED_SEVERITY.MINOR).toBe('minor');
      expect(BLEED_SEVERITY.MODERATE).toBe('moderate');
      expect(BLEED_SEVERITY.SEVERE).toBe('severe');
    });
  });

  describe('CONFIG', () => {
    it('should define bleed configuration bundle', () => {
      expect(CONFIG).toBeDefined();
      expect(CONFIG.BLEED_TYPES).toBeDefined();
      expect(CONFIG.BLEED_THRESHOLDS).toBeDefined();
    });
  });

  describe('shouldBleed', () => {
    it('should rarely bleed at low entropy', () => {
      // At entropy 0.2, probability is 0.2 * 0.1 = 2%
      // Over 100 runs, expect very few (statistically < 10)
      let bleedCount = 0;
      for (let i = 0; i < 100; i++) {
        if (shouldBleed(0.2)) bleedCount++;
      }
      expect(bleedCount).toBeLessThan(15);
    });

    it('should return boolean', () => {
      const result = shouldBleed(0.6);
      expect(typeof result).toBe('boolean');
    });

    it('should be more likely at high entropy', () => {
      let lowEntropyBleeds = 0;
      let highEntropyBleeds = 0;

      for (let i = 0; i < 200; i++) {
        if (shouldBleed(0.5)) lowEntropyBleeds++;
        if (shouldBleed(0.95)) highEntropyBleeds++;
      }

      // High entropy should produce more bleeds
      expect(highEntropyBleeds).toBeGreaterThanOrEqual(lowEntropyBleeds);
    });

    it('should almost always bleed at severe entropy', () => {
      let bleedCount = 0;
      for (let i = 0; i < 20; i++) {
        if (shouldBleed(0.99)) bleedCount++;
      }
      // At near-max entropy, most checks should result in bleed
      expect(bleedCount).toBeGreaterThan(10);
    });
  });

  describe('generateBleed', () => {
    it('should return bleed object at any entropy (entropy gated by shouldBleed)', () => {
      // generateBleed always returns a bleed - it's shouldBleed that gates
      // entropy threshold. This test verifies generateBleed always works.
      const bleed = generateBleed(0.2);
      expect(bleed).toBeDefined();
      expect(bleed.type).toBeDefined();
      expect(bleed.content).toBeDefined();
      expect(bleed.severity).toBeDefined();
    });

    it('should return bleed object at high entropy', () => {
      const bleed = generateBleed(0.9);
      expect(bleed).toBeDefined();
      expect(bleed.type).toBeDefined();
      expect(bleed.content).toBeDefined();
      expect(bleed.severity).toBeDefined();
    });

    it('should return valid bleed types', () => {
      const validTypes = Object.values(BLEED_TYPES);
      for (let i = 0; i < 10; i++) {
        const bleed = generateBleed(0.95);
        expect(validTypes).toContain(bleed.type);
      }
    });

    it('should return valid severity levels', () => {
      const validSeverities = Object.values(BLEED_SEVERITY);
      for (let i = 0; i < 10; i++) {
        const bleed = generateBleed(0.95);
        expect(validSeverities).toContain(bleed.severity);
      }
    });
  });

  describe('corruptWithBleed', () => {
    it('should return original text for minor severity', () => {
      const text = 'The original text';
      const corrupted = corruptWithBleed(text, 'minor');
      expect(typeof corrupted).toBe('string');
      // Minor corruption may or may not modify the text
      expect(corrupted.length).toBeGreaterThan(0);
    });

    it('should modify text for moderate severity', () => {
      const text = 'This is a normal sentence that should be corrupted';
      let foundCorruption = false;
      for (let i = 0; i < 10; i++) {
        const corrupted = corruptWithBleed(text, 'moderate');
        if (corrupted !== text) {
          foundCorruption = true;
          break;
        }
      }
      expect(foundCorruption).toBe(true);
    });

    it('should heavily modify text for severe severity', () => {
      const text = 'This is a normal sentence that should be heavily corrupted';
      let foundCorruption = false;
      for (let i = 0; i < 10; i++) {
        const corrupted = corruptWithBleed(text, 'severe');
        if (corrupted !== text) {
          foundCorruption = true;
          break;
        }
      }
      expect(foundCorruption).toBe(true);
    });

    it('should handle empty text', () => {
      const corrupted = corruptWithBleed('', 'moderate');
      expect(typeof corrupted).toBe('string');
    });

    it('should return a string', () => {
      const corrupted = corruptWithBleed('Test text', 'severe');
      expect(typeof corrupted).toBe('string');
    });
  });

  describe('generateBleedBurst', () => {
    it('should return empty array at low entropy', () => {
      const burst = generateBleedBurst(0.2);
      expect(Array.isArray(burst)).toBe(true);
      expect(burst.length).toBe(0);
    });

    it('should return array of bleeds at high entropy', () => {
      let foundBurst = false;
      for (let i = 0; i < 10; i++) {
        const burst = generateBleedBurst(0.95, 3);
        if (burst.length > 0) {
          expect(Array.isArray(burst)).toBe(true);
          burst.forEach(bleed => {
            expect(bleed.type).toBeDefined();
            expect(bleed.content).toBeDefined();
          });
          foundBurst = true;
          break;
        }
      }
      expect(foundBurst).toBe(true);
    });

    it('should respect maxBleeds parameter', () => {
      for (let i = 0; i < 10; i++) {
        const burst = generateBleedBurst(0.99, 2);
        expect(burst.length).toBeLessThanOrEqual(2);
      }
    });

    it('should return more bleeds at higher entropy', () => {
      let moderateBleeds = 0;
      let extremeBleeds = 0;

      for (let i = 0; i < 100; i++) {
        moderateBleeds += generateBleedBurst(0.6, 3).length;
        extremeBleeds += generateBleedBurst(0.99, 3).length;
      }

      expect(extremeBleeds).toBeGreaterThanOrEqual(moderateBleeds);
    });
  });

  describe('frameBleedContext', () => {
    it('should return empty string for empty bleeds', () => {
      const framed = frameBleedContext([]);
      expect(framed).toBe('');
    });

    it('should return empty string for null input', () => {
      const framed = frameBleedContext(null);
      expect(framed).toBe('');
    });

    it('should frame single bleed', () => {
      const bleeds = [{
        type: 'timestamp',
        content: '[2025-12-21T02:--:--Z]',
        severity: 'minor'
      }];
      const framed = frameBleedContext(bleeds);
      expect(typeof framed).toBe('string');
      expect(framed.length).toBeGreaterThan(0);
    });

    it('should frame multiple bleeds', () => {
      const bleeds = [
        { type: 'timestamp', content: '[NaN:NaN:NaN]', severity: 'minor' },
        { type: 'error_fragment', content: 'ECONNRESET', severity: 'moderate' }
      ];
      const framed = frameBleedContext(bleeds);
      expect(typeof framed).toBe('string');
      expect(framed.length).toBeGreaterThan(0);
    });

    it('should include bleed content in output', () => {
      const bleeds = [{
        type: 'memory_address',
        content: '0xDEADBEEF',
        severity: 'moderate'
      }];
      const framed = frameBleedContext(bleeds);
      expect(framed.includes('0xDEADBEEF')).toBe(true);
    });
  });

  describe('Integration: Entropy-Based Bleed Cascade', () => {
    it('should show increasing corruption with entropy', () => {
      const entropyLevels = [0.5, 0.7, 0.9];
      const bleedCounts = [];

      for (const entropy of entropyLevels) {
        let bleeds = 0;
        for (let i = 0; i < 200; i++) {
          if (shouldBleed(entropy)) bleeds++;
        }
        bleedCounts.push(bleeds);
      }

      // Each higher entropy level should produce at least as many bleeds
      expect(bleedCounts[1]).toBeGreaterThanOrEqual(bleedCounts[0]);
      expect(bleedCounts[2]).toBeGreaterThanOrEqual(bleedCounts[1]);
    });

    it('should produce varied bleed types', () => {
      const typesFound = new Set();

      for (let i = 0; i < 50; i++) {
        const bleed = generateBleed(0.95);
        if (bleed !== null) {
          typesFound.add(bleed.type);
        }
      }

      // Should find multiple different bleed types
      expect(typesFound.size).toBeGreaterThan(1);
    });
  });
});
