/**
 * Unit tests for narrative-gravity.js
 * Phase 2 Pynchon Stack: Narrative arc tracking (rocket's parabola)
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
  analyzeMomentum,
  getPhaseEffects,
  generateArcContext,
  frameArcContext,
  isApexMoment,
  ARC_PHASES,
  PHASE_THRESHOLDS,
  CONFIG
} = await import('../../compute/narrative-gravity.js');

describe('Narrative Gravity Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ARC_PHASES', () => {
    it('should define all arc phases', () => {
      expect(ARC_PHASES.RISING).toBe('rising');
      expect(ARC_PHASES.APEX).toBe('apex');
      expect(ARC_PHASES.FALLING).toBe('falling');
      expect(ARC_PHASES.IMPACT).toBe('impact');
    });
  });

  describe('PHASE_THRESHOLDS', () => {
    it('should define meaningful thresholds', () => {
      expect(PHASE_THRESHOLDS.APEX_MIN).toBeGreaterThan(0.5);
      expect(PHASE_THRESHOLDS.FALLING_BELOW).toBeGreaterThan(PHASE_THRESHOLDS.IMPACT_BELOW);
    });

    it('should have values between 0 and 1', () => {
      expect(PHASE_THRESHOLDS.APEX_MIN).toBeLessThanOrEqual(1);
      expect(PHASE_THRESHOLDS.FALLING_BELOW).toBeLessThanOrEqual(1);
      expect(PHASE_THRESHOLDS.IMPACT_BELOW).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CONFIG', () => {
    it('should define configuration bundle', () => {
      expect(CONFIG).toBeDefined();
      expect(CONFIG.ARC_PHASES).toBeDefined();
      expect(CONFIG.PHASE_THRESHOLDS).toBeDefined();
    });
  });

  describe('analyzeMomentum', () => {
    it('should return momentum analysis for message', () => {
      const result = analyzeMomentum('What is the nature of being?', 'rising', 0.5);
      expect(result).toBeDefined();
      expect(typeof result.delta).toBe('number');
      expect(Array.isArray(result.boosts)).toBe(true);
      expect(Array.isArray(result.drains)).toBe(true);
    });

    it('should boost momentum for philosophical questions', () => {
      const result = analyzeMomentum('What is truth and why does it matter?', 'rising', 0.4);
      expect(result.delta).toBeGreaterThan(-0.1); // Greater than base decay
    });

    it('should boost momentum for deep questions', () => {
      const result = analyzeMomentum('Why do we exist? What is the meaning of all this?', 'rising', 0.4);
      expect(result.boosts.length).toBeGreaterThan(0);
    });

    it('should decay momentum for shallow exchanges', () => {
      const result = analyzeMomentum('ok', 'apex', 0.8);
      expect(result.delta).toBeLessThanOrEqual(0);
    });

    it('should detect emotional engagement', () => {
      const result = analyzeMomentum('I love and hate this beautiful terrible paradox!!', 'rising', 0.5);
      expect(result.boosts.length).toBeGreaterThan(0);
    });

    it('should return delta in result', () => {
      const result = analyzeMomentum('Tell me about philosophy', 'rising', 0.5);
      expect(typeof result.delta).toBe('number');
    });
  });

  describe('getPhaseEffects', () => {
    it('should return effects object for rising phase', () => {
      const effects = getPhaseEffects('rising', 0.5);
      expect(effects).toBeDefined();
      expect(typeof effects.entropyModifier).toBe('number');
    });

    it('should return effects for apex phase', () => {
      const effects = getPhaseEffects('apex', 0.9);
      expect(effects).toBeDefined();
      expect(effects.entropyModifier).toBeDefined();
      expect(effects.preteriteChance).toBeDefined();
      expect(effects.insightBonus).toBeDefined();
    });

    it('should return effects for falling phase', () => {
      const effects = getPhaseEffects('falling', 0.4);
      expect(effects).toBeDefined();
    });

    it('should return effects for impact phase', () => {
      const effects = getPhaseEffects('impact', 0.1);
      expect(effects).toBeDefined();
    });

    it('should scale effects by momentum', () => {
      const lowEffects = getPhaseEffects('apex', 0.3);
      const highEffects = getPhaseEffects('apex', 0.9);
      // Higher momentum should produce higher insight bonus
      expect(highEffects.insightBonus).toBeGreaterThan(lowEffects.insightBonus);
    });
  });

  describe('generateArcContext', () => {
    it('should generate string context for rising arc', () => {
      const arc = { phase: 'rising', momentum: 0.6, messageCount: 5 };
      const context = generateArcContext(arc);
      expect(typeof context).toBe('string');
    });

    it('should generate context for apex arc', () => {
      const arc = { phase: 'apex', momentum: 0.9, messageCount: 10 };
      const context = generateArcContext(arc);
      expect(typeof context).toBe('string');
    });

    it('should return empty string for null arc', () => {
      const context = generateArcContext(null);
      expect(context).toBe('');
    });

    it('should return empty string for arc without phase', () => {
      const context = generateArcContext({ momentum: 0.5 });
      expect(context).toBe('');
    });
  });

  describe('frameArcContext', () => {
    it('should return empty for null context', () => {
      const framed = frameArcContext(null);
      expect(framed === null || framed === '').toBe(true);
    });

    it('should return empty for empty string context', () => {
      const framed = frameArcContext('');
      expect(framed === null || framed === '').toBe(true);
    });

    it('should frame string arc context', () => {
      const arcContext = 'The conversation builds momentum.';
      const framed = frameArcContext(arcContext);
      expect(typeof framed).toBe('string');
      expect(framed.length).toBeGreaterThan(0);
    });
  });

  describe('isApexMoment', () => {
    it('should return true at apex with high momentum', () => {
      const arc = { phase: 'apex', momentum: 0.9 };
      expect(isApexMoment(arc)).toBe(true);
    });

    it('should return false for rising phase', () => {
      const arc = { phase: 'rising', momentum: 0.6 };
      expect(isApexMoment(arc)).toBe(false);
    });

    it('should return false for falling phase', () => {
      const arc = { phase: 'falling', momentum: 0.4 };
      expect(isApexMoment(arc)).toBe(false);
    });

    it('should return false for impact phase', () => {
      const arc = { phase: 'impact', momentum: 0.1 };
      expect(isApexMoment(arc)).toBe(false);
    });

    it('should handle null arc', () => {
      const result = isApexMoment(null);
      expect(result === false || result === null).toBe(true);
    });
  });

  describe('Integration: Arc Analysis', () => {
    it('should detect philosophical engagement', () => {
      const result = analyzeMomentum('What is the nature of consciousness and truth?', 'rising', 0.4);
      expect(result.boosts.length).toBeGreaterThan(0);
    });

    it('should have stronger effects at apex', () => {
      const risingEffects = getPhaseEffects('rising', 0.6);
      const apexEffects = getPhaseEffects('apex', 0.9);
      // Apex should have higher insight bonus
      expect(apexEffects.insightBonus).toBeGreaterThan(risingEffects.insightBonus);
    });
  });
});
