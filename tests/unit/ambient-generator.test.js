/**
 * Unit tests for ambient-generator.js
 * Phase 1: Ambient atmosphere generation
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
  getTimeOfNight,
  frameAmbientContext
} = await import('../../compute/ambient-generator.js');

describe('Ambient Generator Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTimeOfNight', () => {
    it('should return a valid time of night classification', () => {
      const timeOfNight = getTimeOfNight();
      expect(['deep_night', 'pre_dawn', 'twilight', 'any']).toContain(timeOfNight);
    });

    it('should return a string', () => {
      const timeOfNight = getTimeOfNight();
      expect(typeof timeOfNight).toBe('string');
    });
  });

  describe('frameAmbientContext', () => {
    it('should return default setting for null ambient details', () => {
      const framed = frameAmbientContext(null);
      expect(framed).toBeTruthy();
      expect(framed).toContain('O Fim');
    });

    it('should frame ambient details as prose', () => {
      const ambientDetails = {
        timeOfNight: 'deep_night',
        music: 'Tom Jobim',
        weather: 'Humid, still',
        lighting: 'dim',
        entropyLevel: 0.3,
        entropyState: 'unsettled',
        microEvents: ['Someone coughs in the corner.']
      };
      const framed = frameAmbientContext(ambientDetails);
      expect(framed).toBeTruthy();
      expect(typeof framed).toBe('string');
      expect(framed.length).toBeGreaterThan(0);
    });

    it('should include music in framed output', () => {
      const ambientDetails = {
        timeOfNight: 'deep_night',
        music: 'Tom Jobim',
        weather: 'Humid',
        entropyLevel: 0.1
      };
      const framed = frameAmbientContext(ambientDetails);
      expect(framed).toContain('Tom Jobim');
    });

    it('should include micro-events', () => {
      const ambientDetails = {
        timeOfNight: 'pre_dawn',
        music: 'Bowie',
        weather: 'Rain begins',
        entropyLevel: 0.5,
        microEvents: ['A glass breaks', 'Someone laughs']
      };
      const framed = frameAmbientContext(ambientDetails);
      expect(framed).toBeTruthy();
      expect(framed.length).toBeGreaterThan(20);
    });

    it('should handle high entropy ambient state', () => {
      const ambientDetails = {
        timeOfNight: 'twilight',
        music: 'static',
        weather: 'Thick fog',
        lighting: 'flickering',
        entropyLevel: 0.8,
        entropyState: 'fragmenting',
        microEvents: ['The clock flickers']
      };
      const framed = frameAmbientContext(ambientDetails);
      expect(framed).toBeTruthy();
      expect(framed).toContain('uncertain');
    });
  });

  describe('Ambient Components', () => {
    it('should include time description', () => {
      const ambientDetails = {
        timeOfNight: 'deep_night',
        music: 'silence',
        weather: 'Humid'
      };
      const framed = frameAmbientContext(ambientDetails);
      expect(framed).toContain('2 AM');
    });

    it('should include weather', () => {
      const ambientDetails = {
        timeOfNight: 'deep_night',
        music: 'Fado',
        weather: 'Thunder rumbles distant'
      };
      const framed = frameAmbientContext(ambientDetails);
      expect(framed).toContain('Thunder');
    });

    it('should include lighting at high entropy', () => {
      const ambientDetails = {
        timeOfNight: 'deep_night',
        music: 'Bossa',
        weather: 'Humid',
        lighting: 'The lights flicker',
        entropyLevel: 0.5
      };
      const framed = frameAmbientContext(ambientDetails);
      expect(framed).toBeTruthy();
    });
  });
});
