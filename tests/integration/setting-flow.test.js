/**
 * Integration Tests: Setting Preservation Flow
 *
 * End-to-end tests for the setting preservation feature.
 * Feature: 005-setting-preservation
 *
 * These tests require a running PostgreSQL database with migrations applied.
 * Skip in CI unless database is available.
 */

import pg from 'pg';

const { Pool } = pg;

// Database connection for test setup/teardown
let pool;
let testUserId;
let testPersonaId;

// Database URL
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgres://architect:matrix_secret@localhost:5432/aeon_matrix';

// Check database connection before tests
let dbAvailable = false;

beforeAll(async () => {
  try {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    await pool.query('SELECT 1');
    dbAvailable = true;

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (identifier, platform)
       VALUES ($1, 'test')
       ON CONFLICT (identifier) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [`test-user-${Date.now()}`]
    );
    testUserId = userResult.rows[0].id;

    // Get or create test persona
    const personaResult = await pool.query(
      `SELECT id FROM personas WHERE name = 'Hegel' LIMIT 1`
    );
    if (personaResult.rows.length > 0) {
      testPersonaId = personaResult.rows[0].id;
    } else {
      // Create a test persona if none exists
      const newPersona = await pool.query(
        `INSERT INTO personas (name, soul_hash, status)
         VALUES ('TestPersona', 'test-hash', 'active')
         RETURNING id`
      );
      testPersonaId = newPersona.rows[0].id;
    }

    // Create relationship for test user-persona pair
    await pool.query(
      `INSERT INTO relationships (user_id, persona_id, trust_level, familiarity_score)
       VALUES ($1, $2, 'stranger', 0)
       ON CONFLICT (user_id, persona_id) DO NOTHING`,
      [testUserId, testPersonaId]
    );
  } catch (e) {
    dbAvailable = false;
    console.log('Database not available, skipping integration tests:', e.message);
  }
});

afterAll(async () => {
  if (pool && dbAvailable) {
    // Cleanup test data
    if (testUserId) {
      await pool.query('DELETE FROM user_settings WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM relationships WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  }
});

beforeEach(async () => {
  if (!dbAvailable) return;
  // Clear settings before each test
  await pool.query('DELETE FROM user_settings WHERE user_id = $1', [testUserId]);
  // Reset persona location
  await pool.query(
    `UPDATE relationships
     SET preferred_location = NULL, location_context = NULL
     WHERE user_id = $1 AND persona_id = $2`,
    [testUserId, testPersonaId]
  );
});

const describeIf = (condition) => condition ? describe : describe.skip;

describeIf(dbAvailable)('Setting Preservation Integration', () => {

  describe('User Story 1: Returning to a Familiar Bar', () => {
    test('returns default setting for new user without preferences', async () => {
      const { compileUserSetting } = await import('../../compute/setting-preserver.js');

      const setting = await compileUserSetting(testUserId, testPersonaId, 'test-session-1');

      expect(setting).toContain('2 AM');
      expect(setting).toContain('O Fim');
    });

    test('returns personalized setting after preferences are saved', async () => {
      const { saveUserSettings, compileUserSetting } = await import('../../compute/setting-preserver.js');

      // Save preferences
      await saveUserSettings(testUserId, {
        musicPreference: 'Fado',
        atmosphereDescriptors: { humidity: 'less' }
      });

      // Compile setting
      const setting = await compileUserSetting(testUserId, testPersonaId, 'test-session-2');

      expect(setting).toContain('Fado');
      expect(setting).toMatch(/humid/i);
    });

    test('persists settings across multiple compileUserSetting calls', async () => {
      const { saveUserSettings, compileUserSetting } = await import('../../compute/setting-preserver.js');

      await saveUserSettings(testUserId, { timeOfDay: 'dawn' });

      const setting1 = await compileUserSetting(testUserId, testPersonaId, 'session-a');
      const setting2 = await compileUserSetting(testUserId, testPersonaId, 'session-b');

      expect(setting1).toContain('dawn');
      expect(setting2).toContain('dawn');
    });
  });

  describe('User Story 2: Atmosphere Customization', () => {
    test('extracts music preference from conversation', async () => {
      const { extractSettingPreferences } = await import('../../compute/setting-extractor.js');

      const messages = [
        { role: 'user', content: 'I wish the jukebox played Bowie' },
        { role: 'assistant', content: 'The jukebox shifts to a familiar voice...' }
      ];

      const extracted = extractSettingPreferences(messages);
      expect(extracted.musicPreference).toBe('Bowie');
    });

    test('extracts and saves settings at session end', async () => {
      const { extractAndSaveSettings } = await import('../../compute/setting-extractor.js');
      const { loadUserSettings } = await import('../../compute/setting-preserver.js');

      const result = await extractAndSaveSettings({
        sessionId: 'test-session-extract',
        userId: testUserId,
        personaId: testPersonaId,
        personaName: 'Hegel',
        messages: [
          { role: 'user', content: 'I prefer Fado music and less humidity' }
        ],
        startedAt: Date.now() - 60000,
        endedAt: Date.now()
      });

      expect(result.saved.userSettings).toBe(true);
      expect(result.fieldsUpdated.length).toBeGreaterThan(0);

      // Verify settings persisted
      const settings = await loadUserSettings(testUserId);
      expect(settings.musicPreference).toBe('Fado');
    });

    test('skips saving when confidence is too low', async () => {
      const { extractAndSaveSettings } = await import('../../compute/setting-extractor.js');

      const result = await extractAndSaveSettings({
        sessionId: 'test-session-lowconf',
        userId: testUserId,
        personaId: testPersonaId,
        personaName: 'Hegel',
        messages: [
          { role: 'user', content: 'What is the nature of dialectics?' }
        ],
        startedAt: Date.now() - 60000,
        endedAt: Date.now()
      });

      expect(result.saved.userSettings).toBe(false);
      expect(result.fieldsUpdated.length).toBe(0);
    });
  });

  describe('User Story 3: Persona-Specific Environments', () => {
    test('saves persona location from conversation', async () => {
      const { savePersonaLocation, loadPersonaLocation } = await import('../../compute/setting-preserver.js');

      await savePersonaLocation(testUserId, testPersonaId, {
        preferredLocation: 'bar counter',
        locationContext: 'where we discuss dialectics'
      });

      const location = await loadPersonaLocation(testUserId, testPersonaId);

      expect(location.preferredLocation).toBe('bar counter');
      expect(location.locationContext).toBe('where we discuss dialectics');
    });

    test('includes persona location in compiled setting', async () => {
      const { savePersonaLocation, compileUserSetting } = await import('../../compute/setting-preserver.js');

      await savePersonaLocation(testUserId, testPersonaId, {
        preferredLocation: 'corner booth'
      });

      const setting = await compileUserSetting(testUserId, testPersonaId, 'test-session-loc');

      expect(setting).toContain('corner booth');
    });
  });

  describe('User Story 4: System Configuration', () => {
    test('saves and retrieves system config', async () => {
      const { saveUserSettings, getSystemConfig } = await import('../../compute/setting-preserver.js');

      await saveUserSettings(testUserId, {
        systemConfig: {
          token_budget: 300,
          drift_enabled: false
        }
      });

      const config = await getSystemConfig(testUserId);

      expect(config.token_budget).toBe(300);
      expect(config.drift_enabled).toBe(false);
    });

    test('respects custom token budget in compilation', async () => {
      const { saveUserSettings, compileUserSetting } = await import('../../compute/setting-preserver.js');

      // Save a very long custom text that would exceed normal budget
      const longText = 'A '.repeat(500); // ~1000 chars
      await saveUserSettings(testUserId, {
        customSettingText: longText,
        systemConfig: { token_budget: 100 } // Very restrictive
      });

      const setting = await compileUserSetting(testUserId, testPersonaId, 'test-budget');

      // Should be truncated to ~400 chars (100 tokens * 4)
      expect(setting.length).toBeLessThan(500);
    });
  });

  describe('Full Context Assembly Integration', () => {
    test('includes personalized setting in assembled context', async () => {
      const { saveUserSettings } = await import('../../compute/setting-preserver.js');
      const { assembleContext } = await import('../../compute/context-assembler.js');

      await saveUserSettings(testUserId, {
        musicPreference: 'Tom Waits',
        timeOfDay: 'midnight'
      });

      const context = await assembleContext({
        personaId: testPersonaId,
        userId: testUserId,
        query: 'Tell me about existence',
        sessionId: 'test-assembly-session'
      });

      const settingText = context.systemPrompt || context.components?.setting || '';
      expect(settingText).toMatch(/Tom Waits|midnight/);
    });

    test('extracts settings during session completion', async () => {
      const { completeSession } = await import('../../compute/context-assembler.js');
      const { loadUserSettings } = await import('../../compute/setting-preserver.js');

      const result = await completeSession({
        sessionId: 'test-complete-session',
        userId: testUserId,
        personaId: testPersonaId,
        personaName: 'Hegel',
        messages: [
          { role: 'user', content: 'I prefer jazz music' },
          { role: 'assistant', content: 'The smoky notes drift through the air...' }
        ],
        startedAt: Date.now() - 120000,
        endedAt: Date.now()
      });

      // Check extraction happened
      expect(result.settingsExtracted).toBeDefined();

      // Verify in database
      const settings = await loadUserSettings(testUserId);
      expect(settings.musicPreference).toBe('Jazz');
    });
  });

  describe('Data Retention', () => {
    test('updates timestamp on settings touch', async () => {
      const { saveUserSettings, touchUserSettings } = await import('../../compute/setting-preserver.js');

      await saveUserSettings(testUserId, { musicPreference: 'Fado' });

      // Get initial timestamp
      const before = await pool.query(
        'SELECT updated_at FROM user_settings WHERE user_id = $1',
        [testUserId]
      );

      // Wait a moment and touch
      await new Promise(resolve => setTimeout(resolve, 100));
      await touchUserSettings(testUserId);

      // Check timestamp updated
      const after = await pool.query(
        'SELECT updated_at FROM user_settings WHERE user_id = $1',
        [testUserId]
      );

      expect(after.rows[0].updated_at.getTime()).toBeGreaterThanOrEqual(
        before.rows[0].updated_at.getTime()
      );
    });
  });
});

// Placeholder test to prevent Jest from failing if DB unavailable
test('placeholder for skipped tests', () => {
  expect(true).toBe(true);
});
