/**
 * Unit Tests: Setting Preserver
 *
 * Tests for compute/setting-preserver.js
 * Feature: 005-setting-preservation
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before imports (required by modules after security hardening)
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// Mock state
let mockQueryResults = [];
let queryCalls = [];

const mockPool = {
  query: jest.fn(async (sql, params) => {
    queryCalls.push({ sql, params });
    const result = mockQueryResults.shift();
    if (result instanceof Error) throw result;
    return result || { rows: [], rowCount: 0 };
  }),
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

// Module exports (populated in beforeAll)
let loadUserSettings, saveUserSettings, loadPersonaLocation, savePersonaLocation, compileUserSetting, getSystemConfig;

beforeAll(async () => {
  const module = await import('../../compute/setting-preserver.js');
  loadUserSettings = module.loadUserSettings;
  saveUserSettings = module.saveUserSettings;
  loadPersonaLocation = module.loadPersonaLocation;
  savePersonaLocation = module.savePersonaLocation;
  compileUserSetting = module.compileUserSetting;
  getSystemConfig = module.getSystemConfig;
});

describe('Setting Preserver', () => {
  beforeEach(() => {
    mockQueryResults = [];
    queryCalls = [];
    mockPool.query.mockClear();
  });

  describe('loadUserSettings()', () => {
    it('returns null for missing userId', async () => {
      const result = await loadUserSettings(null);
      expect(result).toBeNull();
    });

    it('returns null when no settings exist', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });
      const result = await loadUserSettings('user-123');
      expect(result).toBeNull();
    });

    it('returns settings when found', async () => {
      mockQueryResults.push({
        rows: [{
          user_id: 'user-123',
          time_of_day: 'dawn',
          music_preference: 'Fado',
          atmosphere_descriptors: { humidity: 'less' },
          location_preference: 'corner booth',
          custom_setting_text: null,
          system_config: { token_budget: 300 },
          updated_at: new Date()
        }],
        rowCount: 1
      });

      const result = await loadUserSettings('user-123');

      expect(result.userId).toBe('user-123');
      expect(result.timeOfDay).toBe('dawn');
      expect(result.musicPreference).toBe('Fado');
      expect(result.atmosphereDescriptors).toEqual({ humidity: 'less' });
      expect(result.locationPreference).toBe('corner booth');
      expect(result.systemConfig).toEqual({ token_budget: 300 });
    });

    it('uses default timeOfDay when null', async () => {
      mockQueryResults.push({
        rows: [{
          user_id: 'user-123',
          time_of_day: null,
          music_preference: null,
          atmosphere_descriptors: null,
          location_preference: null,
          custom_setting_text: null,
          system_config: null,
          updated_at: new Date()
        }],
        rowCount: 1
      });

      const result = await loadUserSettings('user-123');
      expect(result.timeOfDay).toBe('2 AM');
    });

    it('returns null on database error', async () => {
      mockQueryResults.push(new Error('Connection failed'));
      const result = await loadUserSettings('user-123');
      expect(result).toBeNull();
    });
  });

  describe('saveUserSettings()', () => {
    it('returns false for missing userId', async () => {
      const result = await saveUserSettings(null, { musicPreference: 'Fado' });
      expect(result.success).toBe(false);
      expect(result.updatedFields).toEqual([]);
    });

    it('returns false for invalid preferences', async () => {
      const result = await saveUserSettings('user-123', null);
      expect(result.success).toBe(false);
    });

    it('returns success with empty fields when nothing to update', async () => {
      const result = await saveUserSettings('user-123', {});
      expect(result.success).toBe(true);
      expect(result.updatedFields).toEqual([]);
    });

    it('saves music preference', async () => {
      mockQueryResults.push({ rows: [{ id: 'settings-1' }], rowCount: 1 });
      const result = await saveUserSettings('user-123', { musicPreference: 'Fado' });

      expect(result.success).toBe(true);
      expect(result.updatedFields).toEqual(['musicPreference']);
      expect(queryCalls.length).toBe(1);
      expect(queryCalls[0].sql).toContain('INSERT INTO user_settings');
    });

    it('saves multiple preferences', async () => {
      mockQueryResults.push({ rows: [{ id: 'settings-1' }], rowCount: 1 });
      const result = await saveUserSettings('user-123', {
        musicPreference: 'Bowie',
        timeOfDay: 'midnight',
        atmosphereDescriptors: { lighting: 'candlelight' }
      });

      expect(result.success).toBe(true);
      expect(result.updatedFields).toContain('musicPreference');
      expect(result.updatedFields).toContain('timeOfDay');
      expect(result.updatedFields).toContain('atmosphereDescriptors');
    });

    it('saves system config for operators', async () => {
      mockQueryResults.push({ rows: [{ id: 'settings-1' }], rowCount: 1 });
      const result = await saveUserSettings('user-123', {
        systemConfig: { token_budget: 300, drift_enabled: false }
      });

      expect(result.success).toBe(true);
      expect(result.updatedFields).toEqual(['systemConfig']);
    });

    it('returns false on database error', async () => {
      mockQueryResults.push(new Error('Insert failed'));
      const result = await saveUserSettings('user-123', { musicPreference: 'Fado' });
      expect(result.success).toBe(false);
    });
  });

  describe('loadPersonaLocation()', () => {
    it('returns null for missing parameters', async () => {
      expect(await loadPersonaLocation(null, 'persona-1')).toBeNull();
      expect(await loadPersonaLocation('user-1', null)).toBeNull();
    });

    it('returns null when no location exists', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });
      const result = await loadPersonaLocation('user-123', 'hegel-uuid');
      expect(result).toBeNull();
    });

    it('returns location when found', async () => {
      mockQueryResults.push({
        rows: [{
          preferred_location: 'bar counter',
          location_context: 'where Hegel holds court'
        }],
        rowCount: 1
      });

      const result = await loadPersonaLocation('user-123', 'hegel-uuid');
      expect(result.preferredLocation).toBe('bar counter');
      expect(result.locationContext).toBe('where Hegel holds court');
    });
  });

  describe('savePersonaLocation()', () => {
    it('returns false for missing parameters', async () => {
      const result = await savePersonaLocation(null, 'persona-1', { preferredLocation: 'bar' });
      expect(result.success).toBe(false);
    });

    it('returns success when no fields to update', async () => {
      const result = await savePersonaLocation('user-1', 'persona-1', {});
      expect(result.success).toBe(true);
    });

    it('returns false when relationship does not exist', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });
      const result = await savePersonaLocation('user-1', 'persona-1', {
        preferredLocation: 'corner booth'
      });
      expect(result.success).toBe(false);
    });

    it('saves location when relationship exists', async () => {
      mockQueryResults.push({ rows: [{ id: 'rel-1' }], rowCount: 1 });
      const result = await savePersonaLocation('user-1', 'persona-1', {
        preferredLocation: 'bar counter',
        locationContext: 'where we always talk'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('compileUserSetting()', () => {
    it('returns default setting when no preferences exist', async () => {
      // Mock loadUserSettings returning null
      mockQueryResults.push({ rows: [], rowCount: 0 });
      // Mock loadPersonaLocation returning null
      mockQueryResults.push({ rows: [], rowCount: 0 });

      const result = await compileUserSetting('user-123', 'persona-456', 'session-789');

      expect(result).toContain('2 AM');
      expect(result).toContain('O Fim');
    });

    it('includes music preference in compiled setting', async () => {
      // Mock loadUserSettings
      mockQueryResults.push({
        rows: [{
          user_id: 'user-123',
          time_of_day: '2 AM',
          music_preference: 'Fado',
          atmosphere_descriptors: {},
          location_preference: null,
          custom_setting_text: null,
          system_config: {},
          updated_at: new Date()
        }],
        rowCount: 1
      });
      // Mock loadPersonaLocation
      mockQueryResults.push({ rows: [], rowCount: 0 });

      const result = await compileUserSetting('user-123', 'persona-456', 'session-789');

      expect(result).toContain('Fado');
      expect(result).toContain('jukebox');
    });

    it('uses default fallback on error', async () => {
      mockQueryResults.push(new Error('Database unavailable'));
      mockQueryResults.push(new Error('Database unavailable'));

      const result = await compileUserSetting('user-123', 'persona-456', 'session-789');

      // Should return default setting
      expect(result).toContain('2 AM');
      expect(result).toContain('O Fim');
    });

    it('includes atmosphere descriptors', async () => {
      mockQueryResults.push({
        rows: [{
          user_id: 'user-123',
          time_of_day: '2 AM',
          music_preference: null,
          atmosphere_descriptors: { humidity: 'less', lighting: 'candlelight' },
          location_preference: null,
          custom_setting_text: null,
          system_config: {},
          updated_at: new Date()
        }],
        rowCount: 1
      });
      mockQueryResults.push({ rows: [], rowCount: 0 });

      const result = await compileUserSetting('user-123', 'persona-456', 'session-789');

      expect(result).toMatch(/less humid|humidity/i);
      expect(result).toContain('candlelight');
    });

    it('includes persona-specific location', async () => {
      // No user settings
      mockQueryResults.push({ rows: [], rowCount: 0 });
      // But has persona location
      mockQueryResults.push({
        rows: [{
          preferred_location: 'bar counter',
          location_context: 'where Hegel holds court'
        }],
        rowCount: 1
      });

      const result = await compileUserSetting('user-123', 'hegel-uuid', 'session-789');

      expect(result).toContain('bar counter');
    });
  });

  describe('getSystemConfig()', () => {
    it('returns empty object when no settings', async () => {
      mockQueryResults.push({ rows: [], rowCount: 0 });
      const result = await getSystemConfig('user-123');
      expect(result).toEqual({});
    });

    it('returns system config when available', async () => {
      mockQueryResults.push({
        rows: [{
          user_id: 'user-123',
          time_of_day: '2 AM',
          music_preference: null,
          atmosphere_descriptors: {},
          location_preference: null,
          custom_setting_text: null,
          system_config: { token_budget: 300, drift_enabled: false },
          updated_at: new Date()
        }],
        rowCount: 1
      });

      const result = await getSystemConfig('user-123');
      expect(result).toEqual({ token_budget: 300, drift_enabled: false });
    });
  });
});
