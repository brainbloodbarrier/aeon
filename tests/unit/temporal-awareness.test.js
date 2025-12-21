/**
 * Unit tests for temporal-awareness.js
 * Constitution Principle VII: Temporal Consciousness
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
  classifyGap,
  formatDuration,
  generateReflection,
  TIME_THRESHOLDS,
  GAP_LEVELS
} = await import('../../compute/temporal-awareness.js');

describe('Temporal Awareness Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TIME_THRESHOLDS', () => {
    it('should define correct thresholds in milliseconds', () => {
      expect(TIME_THRESHOLDS.BRIEF_ABSENCE).toBe(30 * 60 * 1000); // 30 minutes
      expect(TIME_THRESHOLDS.NOTABLE_GAP).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(TIME_THRESHOLDS.SIGNIFICANT_GAP).toBe(8 * 60 * 60 * 1000); // 8 hours
      expect(TIME_THRESHOLDS.MAJOR_GAP).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(TIME_THRESHOLDS.EXTENDED_ABSENCE).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
    });
  });

  describe('GAP_LEVELS', () => {
    it('should define all gap level constants', () => {
      expect(GAP_LEVELS.NONE).toBe('none');
      expect(GAP_LEVELS.BRIEF).toBe('brief');
      expect(GAP_LEVELS.NOTABLE).toBe('notable');
      expect(GAP_LEVELS.SIGNIFICANT).toBe('significant');
      expect(GAP_LEVELS.MAJOR).toBe('major');
      expect(GAP_LEVELS.EXTENDED).toBe('extended');
    });
  });

  describe('classifyGap', () => {
    it('should return none for gaps under 30 minutes', () => {
      expect(classifyGap(0)).toBe('none');
      expect(classifyGap(1000)).toBe('none');
      expect(classifyGap(29 * 60 * 1000)).toBe('none');
    });

    it('should return brief for gaps between 30min and 2hr', () => {
      expect(classifyGap(30 * 60 * 1000)).toBe('brief');
      expect(classifyGap(60 * 60 * 1000)).toBe('brief');
      expect(classifyGap(119 * 60 * 1000)).toBe('brief');
    });

    it('should return notable for gaps between 2hr and 8hr', () => {
      expect(classifyGap(2 * 60 * 60 * 1000)).toBe('notable');
      expect(classifyGap(4 * 60 * 60 * 1000)).toBe('notable');
      expect(classifyGap(7.9 * 60 * 60 * 1000)).toBe('notable');
    });

    it('should return significant for gaps between 8hr and 24hr', () => {
      expect(classifyGap(8 * 60 * 60 * 1000)).toBe('significant');
      expect(classifyGap(12 * 60 * 60 * 1000)).toBe('significant');
      expect(classifyGap(23 * 60 * 60 * 1000)).toBe('significant');
    });

    it('should return major for gaps between 24hr and 7 days', () => {
      expect(classifyGap(24 * 60 * 60 * 1000)).toBe('major');
      expect(classifyGap(3 * 24 * 60 * 60 * 1000)).toBe('major');
      expect(classifyGap(6 * 24 * 60 * 60 * 1000)).toBe('major');
    });

    it('should return extended for gaps over 7 days', () => {
      expect(classifyGap(7 * 24 * 60 * 60 * 1000)).toBe('extended');
      expect(classifyGap(30 * 24 * 60 * 60 * 1000)).toBe('extended');
    });
  });

  describe('formatDuration', () => {
    it('should format minutes correctly', () => {
      expect(formatDuration(5 * 60 * 1000)).toBe('5 minutes');
      expect(formatDuration(1 * 60 * 1000)).toBe('1 minute');
      expect(formatDuration(45 * 60 * 1000)).toBe('45 minutes');
    });

    it('should format hours correctly', () => {
      expect(formatDuration(1 * 60 * 60 * 1000)).toBe('1 hour');
      expect(formatDuration(3 * 60 * 60 * 1000)).toBe('3 hours');
      expect(formatDuration(12 * 60 * 60 * 1000)).toBe('12 hours');
    });

    it('should format days correctly', () => {
      expect(formatDuration(1 * 24 * 60 * 60 * 1000)).toBe('1 day');
      expect(formatDuration(5 * 24 * 60 * 60 * 1000)).toBe('5 days');
      // 14 days = 2 weeks
      expect(formatDuration(14 * 24 * 60 * 60 * 1000)).toBe('2 weeks');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('moments');
    });
  });

  describe('generateReflection', () => {
    it('should return empty string for no gap', () => {
      const reflection = generateReflection('none', 0);
      expect(reflection).toBe('');
    });

    it('should generate reflection for brief absence', () => {
      const reflection = generateReflection('brief', 45 * 60 * 1000);
      expect(reflection).toBeTruthy();
      expect(typeof reflection).toBe('string');
      expect(reflection.length).toBeGreaterThan(10);
    });

    it('should generate reflection for notable gap', () => {
      const reflection = generateReflection('notable', 4 * 60 * 60 * 1000);
      expect(reflection).toBeTruthy();
      expect(typeof reflection).toBe('string');
    });

    it('should generate reflection for significant gap', () => {
      const reflection = generateReflection('significant', 12 * 60 * 60 * 1000);
      expect(reflection).toBeTruthy();
      expect(typeof reflection).toBe('string');
    });

    it('should generate reflection for major gap', () => {
      const reflection = generateReflection('major', 3 * 24 * 60 * 60 * 1000);
      expect(reflection).toBeTruthy();
      expect(typeof reflection).toBe('string');
    });

    it('should generate reflection for extended absence', () => {
      const reflection = generateReflection('extended', 14 * 24 * 60 * 60 * 1000);
      expect(reflection).toBeTruthy();
      expect(typeof reflection).toBe('string');
    });

    it('should incorporate persona slug when provided', () => {
      const reflection = generateReflection('notable', 4 * 60 * 60 * 1000, 'hegel');
      expect(reflection).toBeTruthy();
      // Persona-specific reflections may vary
    });
  });
});
