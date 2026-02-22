/**
 * Unit Tests: Setting Extractor
 *
 * Tests for compute/setting-extractor.js
 * Feature: 005-setting-preservation
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before imports (required by modules after security hardening)
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// Mock state for tracking calls
let saveUserSettingsCalls = [];
let savePersonaLocationCalls = [];

// Mock pg Pool
const mockPool = {
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
  on: jest.fn(),
  end: jest.fn()
};

// ESM-compatible module mocking (must be before dynamic imports)
jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn()
}));

jest.unstable_mockModule('../../compute/setting-preserver.js', () => ({
  saveUserSettings: jest.fn(async (userId, prefs) => {
    saveUserSettingsCalls.push({ userId, prefs });
    return { success: true, updatedFields: Object.keys(prefs) };
  }),
  savePersonaLocation: jest.fn(async (userId, personaId, location) => {
    savePersonaLocationCalls.push({ userId, personaId, location });
    return { success: true };
  })
}));

// Module exports (populated in beforeAll)
let extractSettingPreferences, extractAndSaveSettings, SETTING_PATTERNS;

beforeAll(async () => {
  const module = await import('../../compute/setting-extractor.js');
  extractSettingPreferences = module.extractSettingPreferences;
  extractAndSaveSettings = module.extractAndSaveSettings;
  SETTING_PATTERNS = module.SETTING_PATTERNS;
});

describe('Setting Extractor', () => {
  beforeEach(() => {
    saveUserSettingsCalls = [];
    savePersonaLocationCalls = [];
    jest.clearAllMocks();
  });

  describe('extractSettingPreferences()', () => {
    it('returns empty preferences for empty messages', () => {
      const result = extractSettingPreferences([]);
      expect(result.musicPreference).toBeNull();
      expect(result.atmosphereDescriptors).toEqual({});
      expect(result.locationPreference).toBeNull();
      expect(result.timeOfDay).toBeNull();
      expect(result.personaLocations).toEqual([]);
      expect(result.confidence).toBe(0);
    });

    it('returns empty preferences for invalid input', () => {
      const result = extractSettingPreferences(null);
      expect(result.confidence).toBe(0);
    });

    it('only processes user messages', () => {
      const messages = [
        { role: 'assistant', content: 'I prefer Fado' },
        { role: 'system', content: 'Play jazz' }
      ];
      const result = extractSettingPreferences(messages);
      expect(result.musicPreference).toBeNull();
    });

    describe('music patterns', () => {
      it('extracts "I wish the jukebox played X"', () => {
        const messages = [
          { role: 'user', content: 'I wish the jukebox played Fado instead' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.musicPreference).toBe('Fado');
      });

      it('extracts direct artist mentions', () => {
        const messages = [
          { role: 'user', content: 'How about some jazz tonight?' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.musicPreference).toBe('Jazz');
      });

      it('extracts "silence" as music preference', () => {
        const messages = [
          { role: 'user', content: 'I prefer silence to think' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.musicPreference).toBe('Silence');
      });
    });

    describe('atmosphere patterns', () => {
      it('extracts "less humidity"', () => {
        const messages = [
          { role: 'user', content: 'Could we have less humidity tonight?' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.atmosphereDescriptors.humidity).toBe('less');
      });

      it('extracts "more X" modifier', () => {
        const messages = [
          { role: 'user', content: 'More warmth would be nice' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.atmosphereDescriptors.temperature).toBe('more');
      });

      it('extracts candlelight', () => {
        const messages = [
          { role: 'user', content: 'Candlelight would set the mood' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.atmosphereDescriptors.lighting).toBe('candlelight');
      });

      it('extracts multiple atmosphere descriptors', () => {
        const messages = [
          { role: 'user', content: 'Less humidity, candlelight, and quieter please' }
        ];
        const result = extractSettingPreferences(messages);
        expect(Object.keys(result.atmosphereDescriptors).length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('location patterns', () => {
      it('extracts "corner booth"', () => {
        const messages = [
          { role: 'user', content: 'I like the corner booth' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.locationPreference).toBe('corner booth');
      });

      it('extracts "bar counter"', () => {
        const messages = [
          { role: 'user', content: 'Let me sit at the bar counter' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.locationPreference).toBe('bar counter');
      });

      it('extracts "my usual spot"', () => {
        const messages = [
          { role: 'user', content: 'Back to my usual spot' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.locationPreference).toContain('spot');
      });
    });

    describe('timeOfDay patterns', () => {
      it('extracts "what if it were dawn"', () => {
        const messages = [
          { role: 'user', content: 'What if it were dawn right now?' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.timeOfDay).toBe('dawn');
      });

      it('extracts "imagine it is midnight"', () => {
        const messages = [
          { role: 'user', content: 'Imagine it is midnight' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.timeOfDay).toBe('midnight');
      });

      it('extracts direct time mentions', () => {
        const messages = [
          { role: 'user', content: 'I prefer sunset hours' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.timeOfDay).toBe('sunset');
      });
    });

    describe('persona location patterns', () => {
      it('extracts "Hegel at the bar counter"', () => {
        const messages = [
          { role: 'user', content: 'I usually find Hegel at the bar counter' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.personaLocations.length).toBe(1);
        expect(result.personaLocations[0].personaName).toBe('Hegel');
        expect(result.personaLocations[0].location).toBe('bar counter');
      });

      it('extracts multiple persona locations', () => {
        const messages = [
          { role: 'user', content: 'Hegel at the bar, Socrates by the window' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.personaLocations.length).toBeGreaterThanOrEqual(1);
      });

      it('deduplicates persona locations (last wins)', () => {
        const messages = [
          { role: 'user', content: 'Hegel at the bar counter' },
          { role: 'user', content: 'Hegel by the window seat' }
        ];
        const result = extractSettingPreferences(messages);
        const hegelLocations = result.personaLocations.filter(
          p => p.personaName.toLowerCase() === 'hegel'
        );
        expect(hegelLocations.length).toBe(1);
        // Last message should win - window seat
        expect(hegelLocations[0].location).toContain('window');
      });
    });

    describe('confidence scoring', () => {
      it('returns 0 confidence when nothing extracted', () => {
        const messages = [
          { role: 'user', content: 'Tell me about philosophy' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.confidence).toBe(0);
      });

      it('returns higher confidence with multiple matches', () => {
        const messages = [
          { role: 'user', content: 'I prefer Fado, less humidity, at the corner booth' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('returns confidence < 1 for single matches', () => {
        const messages = [
          { role: 'user', content: 'Play some jazz' }
        ];
        const result = extractSettingPreferences(messages);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('extractAndSaveSettings()', () => {
    it('skips saving when confidence is below threshold', async () => {
      const result = await extractAndSaveSettings({
        sessionId: 'session-1',
        userId: 'user-1',
        personaId: 'persona-1',
        personaName: 'Hegel',
        messages: [
          { role: 'user', content: 'Tell me about dialectics' }
        ],
        startedAt: Date.now() - 1000,
        endedAt: Date.now()
      });

      expect(result.saved.userSettings).toBe(false);
      expect(saveUserSettingsCalls.length).toBe(0);
    });

    it('saves user settings when preferences extracted', async () => {
      const result = await extractAndSaveSettings({
        sessionId: 'session-1',
        userId: 'user-123',
        personaId: 'persona-1',
        personaName: 'Hegel',
        messages: [
          { role: 'user', content: 'I prefer Fado music' }
        ],
        startedAt: Date.now() - 1000,
        endedAt: Date.now()
      });

      expect(result.saved.userSettings).toBe(true);
      expect(result.fieldsUpdated).toContain('musicPreference');
    });

    it('saves persona location when detected for current persona', async () => {
      const result = await extractAndSaveSettings({
        sessionId: 'session-1',
        userId: 'user-123',
        personaId: 'hegel-uuid',
        personaName: 'Hegel',
        messages: [
          { role: 'user', content: 'I prefer Fado. Hegel at the bar counter always' }
        ],
        startedAt: Date.now() - 1000,
        endedAt: Date.now()
      });

      expect(result.saved.personaLocation).toBe(true);
      expect(savePersonaLocationCalls.length).toBe(1);
      expect(savePersonaLocationCalls[0].location.preferredLocation).toBe('bar counter');
    });

    it('does not save persona location for different persona', async () => {
      const result = await extractAndSaveSettings({
        sessionId: 'session-1',
        userId: 'user-123',
        personaId: 'socrates-uuid',
        personaName: 'Socrates',
        messages: [
          { role: 'user', content: 'Fado music. Hegel at the bar counter' }
        ],
        startedAt: Date.now() - 1000,
        endedAt: Date.now()
      });

      // Hegel location should not be saved since we're talking to Socrates
      expect(result.saved.personaLocation).toBe(false);
    });
  });

  describe('SETTING_PATTERNS export', () => {
    it('exports music patterns', () => {
      expect(Array.isArray(SETTING_PATTERNS.music)).toBe(true);
      expect(SETTING_PATTERNS.music.length).toBeGreaterThan(0);
    });

    it('exports atmosphere patterns', () => {
      expect(Array.isArray(SETTING_PATTERNS.atmosphere)).toBe(true);
      expect(SETTING_PATTERNS.atmosphere.length).toBeGreaterThan(0);
    });

    it('exports location patterns', () => {
      expect(Array.isArray(SETTING_PATTERNS.location)).toBe(true);
      expect(SETTING_PATTERNS.location.length).toBeGreaterThan(0);
    });

    it('exports timeOfDay patterns', () => {
      expect(Array.isArray(SETTING_PATTERNS.timeOfDay)).toBe(true);
      expect(SETTING_PATTERNS.timeOfDay.length).toBeGreaterThan(0);
    });

    it('exports personaLocation patterns', () => {
      expect(Array.isArray(SETTING_PATTERNS.personaLocation)).toBe(true);
      expect(SETTING_PATTERNS.personaLocation.length).toBeGreaterThan(0);
    });
  });
});
