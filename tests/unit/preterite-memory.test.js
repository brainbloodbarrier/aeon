/**
 * Unit tests for preterite-memory.js
 * Pynchon Stack: Elect vs Preterite memory classification
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
  calculateElectionScore,
  classifyMemoryElection,
  corruptFragment,
  ELECTION_THRESHOLDS,
  ELECTION_STATUS,
  PRETERITE_REASONS
} = await import('../../compute/preterite-memory.js');

describe('Preterite Memory Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ELECTION_THRESHOLDS', () => {
    it('should define elect threshold higher than preterite', () => {
      expect(ELECTION_THRESHOLDS.ELECT).toBeGreaterThan(ELECTION_THRESHOLDS.PRETERITE);
    });

    it('should have values between 0 and 1', () => {
      expect(ELECTION_THRESHOLDS.ELECT).toBeLessThanOrEqual(1);
      expect(ELECTION_THRESHOLDS.PRETERITE).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ELECTION_STATUS', () => {
    it('should define all status constants', () => {
      expect(ELECTION_STATUS.ELECT).toBe('elect');
      expect(ELECTION_STATUS.BORDERLINE).toBe('borderline');
      expect(ELECTION_STATUS.PRETERITE).toBe('preterite');
    });
  });

  describe('PRETERITE_REASONS', () => {
    it('should define all preterite reasons', () => {
      expect(PRETERITE_REASONS.DEEMED_INSIGNIFICANT).toBe('deemed_insignificant');
      expect(PRETERITE_REASONS.OVERSHADOWED).toBe('overshadowed');
      expect(PRETERITE_REASONS.ENTROPY_CLAIMED).toBe('entropy_claimed');
      expect(PRETERITE_REASONS.TOO_ORDINARY).toBe('too_ordinary');
      expect(PRETERITE_REASONS.NO_WITNESS).toBe('no_witness');
      expect(PRETERITE_REASONS.PATTERN_MISMATCH).toBe('pattern_mismatch');
    });
  });

  describe('calculateElectionScore', () => {
    it('should return a score between 0 and 1', () => {
      const memory = {
        content: 'A simple memory',
        importance_score: 0.5,
        created_at: new Date()
      };
      const score = calculateElectionScore(memory);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should score emotional content higher', () => {
      const emotionalMemory = {
        content: 'This was a deeply moving revelation that changed everything',
        importance_score: 0.5,
        created_at: new Date()
      };
      const neutralMemory = {
        content: 'The weather was okay',
        importance_score: 0.5,
        created_at: new Date()
      };
      const emotionalScore = calculateElectionScore(emotionalMemory);
      const neutralScore = calculateElectionScore(neutralMemory);
      expect(emotionalScore).toBeGreaterThan(neutralScore);
    });

    it('should score longer content higher', () => {
      const longMemory = {
        content: 'This is a much longer piece of content that contains many details and nuances about a significant conversation that took place at the bar, involving philosophical discourse about the nature of reality and consciousness.',
        importance_score: 0.5,
        created_at: new Date()
      };
      const shortMemory = {
        content: 'Hi',
        importance_score: 0.5,
        created_at: new Date()
      };
      const longScore = calculateElectionScore(longMemory);
      const shortScore = calculateElectionScore(shortMemory);
      expect(longScore).toBeGreaterThan(shortScore);
    });

    it('should factor in importance_score', () => {
      const importantMemory = {
        content: 'A memory',
        importance_score: 0.9,
        created_at: new Date()
      };
      const unimportantMemory = {
        content: 'A memory',
        importance_score: 0.1,
        created_at: new Date()
      };
      const importantScore = calculateElectionScore(importantMemory);
      const unimportantScore = calculateElectionScore(unimportantMemory);
      expect(importantScore).toBeGreaterThan(unimportantScore);
    });
  });

  describe('classifyMemoryElection', () => {
    it('should classify memories with valid status', () => {
      const memory = {
        content: 'This was a profound philosophical revelation about the nature of existence and consciousness.',
        importance_score: 0.95,
        created_at: new Date()
      };
      const classification = classifyMemoryElection(memory);
      expect(['elect', 'borderline', 'preterite']).toContain(classification.status);
    });

    it('should classify low-scoring memories as preterite', () => {
      const memory = {
        content: 'ok',
        importance_score: 0.05,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days old
      };
      const classification = classifyMemoryElection(memory);
      expect(classification.status).toBe('preterite');
      expect(classification.reason).toBeTruthy();
    });

    it('should return valid classification structure', () => {
      const memory = {
        content: 'A moderately interesting conversation about various topics at the bar.',
        importance_score: 0.5,
        created_at: new Date()
      };
      const classification = classifyMemoryElection(memory);
      expect(['elect', 'borderline', 'preterite']).toContain(classification.status);
      expect(classification.score).toBeDefined();
    });

    it('should include score in classification', () => {
      const memory = {
        content: 'Any memory content',
        importance_score: 0.5,
        created_at: new Date()
      };
      const classification = classifyMemoryElection(memory);
      expect(typeof classification.score).toBe('number');
      expect(classification.score).toBeGreaterThanOrEqual(0);
      expect(classification.score).toBeLessThanOrEqual(1);
    });

    it('should include retrievable flag', () => {
      const memory = {
        content: 'Some memory content here',
        importance_score: 0.6,
        created_at: new Date()
      };
      const classification = classifyMemoryElection(memory);
      expect(typeof classification.retrievable).toBe('boolean');
    });
  });

  describe('corruptFragment', () => {
    it('should return a string', () => {
      const content = 'This is the original memory content.';
      const corrupted = corruptFragment(content);
      expect(typeof corrupted).toBe('string');
    });

    it('should modify the content in some way', () => {
      const content = 'This is a clear memory that should be corrupted by entropy.';
      // Run multiple times - corruption has randomness
      let foundCorruption = false;
      for (let i = 0; i < 10; i++) {
        const corrupted = corruptFragment(content);
        if (corrupted !== content) {
          foundCorruption = true;
          break;
        }
      }
      expect(foundCorruption).toBe(true);
    });

    it('should apply redaction markers', () => {
      const content = 'The secret password was hidden in the document.';
      // Run multiple times
      let hasRedaction = false;
      for (let i = 0; i < 20; i++) {
        const corrupted = corruptFragment(content);
        if (corrupted.includes('[...]') || corrupted.includes('[redacted]') || corrupted.includes('...')) {
          hasRedaction = true;
          break;
        }
      }
      // Redaction should occur sometimes
      expect(hasRedaction).toBe(true);
    });

    it('should handle empty content gracefully', () => {
      const corrupted = corruptFragment('');
      expect(typeof corrupted).toBe('string');
    });

    it('should handle short content', () => {
      const corrupted = corruptFragment('Hi');
      expect(typeof corrupted).toBe('string');
    });
  });
});
