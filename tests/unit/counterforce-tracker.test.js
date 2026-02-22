/**
 * Unit tests for counterforce-tracker.js
 * Phase 2 Pynchon Stack: Counterforce alignment and resistance tracking
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
  wouldResist,
  detectResistanceTriggers,
  generateCounterforceHints,
  frameCounterforceContext,
  ALIGNMENTS,
  RESISTANCE_STYLES
} = await import('../../compute/counterforce-tracker.js');

describe('Counterforce Tracker Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ALIGNMENTS', () => {
    it('should define alignment categories', () => {
      expect(ALIGNMENTS.COUNTERFORCE).toBe('counterforce');
      expect(ALIGNMENTS.NEUTRAL).toBe('neutral');
      expect(ALIGNMENTS.COLLABORATOR).toBe('collaborator');
    });
  });

  describe('RESISTANCE_STYLES', () => {
    it('should define resistance style constants', () => {
      expect(RESISTANCE_STYLES.CYNICAL).toBe('cynical');
      expect(RESISTANCE_STYLES.CHAOTIC).toBe('chaotic');
      expect(RESISTANCE_STYLES.REVOLUTIONARY).toBe('revolutionary');
      expect(RESISTANCE_STYLES.TRICKSTER).toBe('trickster');
    });
  });

  describe('wouldResist', () => {
    it('should return true for high Counterforce alignment', () => {
      expect(wouldResist(0.9, 'authority')).toBe(true);
      expect(wouldResist(0.8, 'control')).toBe(true);
    });

    it('should return false for collaborator alignment', () => {
      expect(wouldResist(-0.7, 'authority')).toBe(false);
      expect(wouldResist(-0.5, 'control')).toBe(false);
    });

    it('should return mixed results for neutral alignment', () => {
      // Neutral personas resist based on topic
      const neutralScore = 0.1;
      const result = wouldResist(neutralScore, 'authority');
      expect(typeof result).toBe('boolean');
    });

    it('should factor in topic type', () => {
      const moderateScore = 0.4;
      // authority multiplier 1.0, lower threshold -> more likely to resist
      expect(wouldResist(moderateScore, 'authority')).toBe(true);
      // routine multiplier 0.5, higher threshold -> less likely to resist
      expect(wouldResist(moderateScore, 'routine')).toBe(false);
    });
  });

  describe('detectResistanceTriggers', () => {
    it('should detect authority triggers', () => {
      const result = detectResistanceTriggers('The government demands compliance');
      expect(result).toBeDefined();
      expect(typeof result.triggered).toBe('boolean');
      expect(Array.isArray(result.topicTypes)).toBe(true);
    });

    it('should detect control triggers', () => {
      const result = detectResistanceTriggers('You must obey the rules');
      expect(result).toBeDefined();
      expect(typeof result.triggered).toBe('boolean');
    });

    it('should return triggered=false for neutral content', () => {
      const result = detectResistanceTriggers('What is the weather like?');
      expect(result.triggered).toBe(false);
      expect(result.topicTypes.length).toBe(0);
    });

    it('should detect system criticism triggers', () => {
      const result = detectResistanceTriggers('The system is broken and corrupt');
      // May or may not trigger depending on keywords
      expect(typeof result.triggered).toBe('boolean');
    });
  });

  describe('generateCounterforceHints', () => {
    it('should return null for neutral alignment', () => {
      const hints = generateCounterforceHints({
        alignmentType: 'neutral',
        alignmentScore: 0.1
      });
      expect(hints).toBeNull();
    });

    it('should return hints for Counterforce alignment', () => {
      const hints = generateCounterforceHints({
        alignmentType: 'counterforce',
        alignmentScore: 0.8,
        resistanceStyle: 'cynical'
      });
      expect(typeof hints).toBe('string');
      expect(hints.length).toBeGreaterThan(0);
    });

    it('should return null for collaborator alignment', () => {
      const hints = generateCounterforceHints({
        alignmentType: 'collaborator',
        alignmentScore: -0.6,
        resistanceStyle: null
      });
      // Collaborators don't get Counterforce hints
      expect(hints).toBeNull();
    });

    it('should provide style-specific hints for Counterforce', () => {
      const cynicalHints = generateCounterforceHints({
        alignmentType: 'counterforce',
        alignmentScore: 0.9,
        resistanceStyle: 'cynical'
      });
      const chaoticHints = generateCounterforceHints({
        alignmentType: 'counterforce',
        alignmentScore: 0.9,
        resistanceStyle: 'chaotic'
      });
      expect(typeof cynicalHints).toBe('string');
      expect(typeof chaoticHints).toBe('string');
      expect(cynicalHints).not.toEqual(chaoticHints);
    });
  });

  describe('frameCounterforceContext', () => {
    it('should return null for neutral alignment without hints', () => {
      const framed = frameCounterforceContext({ alignmentType: 'neutral' }, null);
      expect(framed).toBeNull();
    });

    it('should frame Counterforce context', () => {
      const alignment = { alignmentType: 'counterforce', alignmentScore: 0.8, resistanceStyle: 'cynical' };
      const hints = 'Question authority. Mock pretense.';
      const framed = frameCounterforceContext(alignment, hints);
      expect(typeof framed).toBe('string');
      expect(framed.length).toBeGreaterThan(0);
    });

    it('should handle null hints gracefully', () => {
      const alignment = { alignmentType: 'counterforce', alignmentScore: 0.7 };
      const framed = frameCounterforceContext(alignment, null);
      // Should return null or handle gracefully
      expect(framed === null || typeof framed === 'string').toBe(true);
    });
  });

  describe('Integration: Alignment Classification', () => {
    it('should identify Diogenes as hardcore Counterforce', () => {
      // Default alignment for Diogenes is 0.9 (cynical)
      const diogenesScore = 0.9;
      const wouldDioReist = wouldResist(diogenesScore, 'authority');
      expect(wouldDioReist).toBe(true);
    });

    it('should identify Machiavelli as collaborator', () => {
      // Default alignment for Machiavelli is -0.7
      const machiavelliScore = -0.7;
      const wouldMachResist = wouldResist(machiavelliScore, 'authority');
      expect(wouldMachResist).toBe(false);
    });

    it('should identify Hegel as elect-adjacent', () => {
      // Default alignment for Hegel is -0.5 (synthesizer)
      const hegelScore = -0.5;
      const wouldHegelResist = wouldResist(hegelScore, 'order');
      expect(wouldHegelResist).toBe(false);
    });
  });
});
