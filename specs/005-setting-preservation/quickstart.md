# Quickstart: Setting Preservation

**Feature**: 005-setting-preservation
**Date**: 2025-12-13

## Overview

Setting Preservation enables O Fim to remember each user's atmosphere preferences across sessions. This guide covers setup, testing, and verification.

## Prerequisites

- AEON system running (Docker Compose or local)
- PostgreSQL 16 database (`aeon_matrix`)
- Node.js 18+
- Previous migrations applied (001-005)

## Setup Steps

### 1. Apply Database Migration

```bash
# From repository root
psql -d aeon_matrix -f db/migrations/006_setting_preservation.sql
```

Or via Docker:
```bash
docker-compose exec db psql -U architect -d aeon_matrix -f /migrations/006_setting_preservation.sql
```

### 2. Verify Migration

```sql
-- Check tables/columns created
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_settings';

-- Should return: id, user_id, time_of_day, music_preference, atmosphere_descriptors,
--                location_preference, custom_setting_text, system_config, created_at, updated_at

SELECT column_name FROM information_schema.columns
WHERE table_name = 'relationships' AND column_name LIKE '%location%';

-- Should return: preferred_location, location_context
```

### 3. Test Setting Preservation

```javascript
// test-setting-preservation.js
import { compileUserSetting, saveUserSettings } from './compute/setting-preserver.js';
import { extractSettingPreferences } from './compute/setting-extractor.js';

// Test 1: Default setting for new user
const defaultSetting = await compileUserSetting(
  'test-user-uuid',
  'test-persona-uuid',
  'test-session-uuid'
);
console.log('Default:', defaultSetting);
// Expected: "It is 2 AM at O Fim. The humidity is eternal..."

// Test 2: Save preferences
await saveUserSettings('test-user-uuid', {
  musicPreference: 'Fado',
  atmosphereDescriptors: { humidity: 'less', lighting: 'candlelight' }
});

// Test 3: Personalized setting
const personalizedSetting = await compileUserSetting(
  'test-user-uuid',
  'test-persona-uuid',
  'test-session-uuid'
);
console.log('Personalized:', personalizedSetting);
// Expected: Contains "Fado", "less humid", "candlelight"

// Test 4: Preference extraction
const messages = [
  { role: 'user', content: 'I wish the jukebox played Bowie' },
  { role: 'assistant', content: 'The jukebox shifts...' }
];
const extracted = extractSettingPreferences(messages);
console.log('Extracted:', extracted);
// Expected: { musicPreference: 'Bowie', ... }
```

Run:
```bash
node test-setting-preservation.js
```

## Usage Examples

### Basic Context Assembly

```javascript
import { assembleContext } from './compute/context-assembler.js';

// Context now includes personalized settings automatically
const context = await assembleContext({
  personaId: 'hegel-uuid',
  userId: 'user-uuid',
  query: 'Tell me about dialectics',
  sessionId: 'session-uuid'
});

console.log(context.systemPrompt);
// Includes personalized setting: "It is dawn at O Fim. Fado drifts from the jukebox..."
```

### Session Completion with Setting Extraction

```javascript
import { completeSession } from './compute/context-assembler.js';

const result = await completeSession({
  sessionId: 'session-uuid',
  userId: 'user-uuid',
  personaId: 'hegel-uuid',
  personaName: 'Hegel',
  messages: conversationHistory,
  startedAt: startTime,
  endedAt: Date.now()
});

// Settings automatically extracted and saved
console.log(result);
// { relationship: {...}, memoriesStored: 2, settingsExtracted: ['musicPreference'] }
```

### Operator Configuration

```javascript
import { saveUserSettings } from './compute/setting-preserver.js';

// Operator can override system config for specific users
await saveUserSettings('user-uuid', {
  systemConfig: {
    token_budget: 300,        // Increase setting token budget
    drift_enabled: false      // Disable drift detection
  }
});
```

## Verification Checklist

- [ ] Migration applied without errors
- [ ] `user_settings` table exists with correct columns
- [ ] `relationships` table has `preferred_location` column
- [ ] Default setting returned for new users
- [ ] Saved preferences reflected in compiled setting
- [ ] Extraction patterns detect music, atmosphere, location
- [ ] `operator_logs` records setting operations
- [ ] Token budget respected (max 200 tokens for setting)

## Troubleshooting

### "relation user_settings does not exist"

Migration not applied. Run:
```bash
psql -d aeon_matrix -f db/migrations/006_setting_preservation.sql
```

### Settings not persisting

Check `operator_logs` for errors:
```sql
SELECT * FROM operator_logs
WHERE operation = 'error_graceful'
  AND details->>'error_type' LIKE '%setting%'
ORDER BY created_at DESC LIMIT 10;
```

### Preferences not extracted

Verify message format includes user role:
```javascript
// Correct
{ role: 'user', content: 'I prefer Fado' }

// Wrong (will be ignored)
{ role: 'system', content: 'I prefer Fado' }
```

### Token budget exceeded

Check compiled setting length:
```javascript
const setting = await compileUserSetting(userId, personaId, sessionId);
console.log('Setting length:', setting.length, 'chars (~', Math.ceil(setting.length/4), 'tokens)');
```

If consistently over 800 chars, review `custom_setting_text` length.

## Cron Job Setup (Data Retention)

The `purge_stale_settings()` function should run daily to enforce 90-day retention.

### Using pg_cron (recommended for PostgreSQL)

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily purge at 3 AM
SELECT cron.schedule('purge-stale-settings', '0 3 * * *', 'SELECT purge_stale_settings()');

-- Verify scheduled job
SELECT * FROM cron.job;
```

### Using System Cron

```bash
# Add to crontab: crontab -e
0 3 * * * psql -d aeon_matrix -c "SELECT purge_stale_settings()"
```

### Using Node.js (if database cron not available)

```javascript
// scripts/purge-settings.js
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function purge() {
  const result = await pool.query('SELECT purge_stale_settings()');
  console.log(`Purged ${result.rows[0].purge_stale_settings} stale settings`);
  await pool.end();
}

purge().catch(console.error);
```

Run daily: `0 3 * * * node /path/to/scripts/purge-settings.js`

## Implementation Status

All implementation tasks are complete:
- [x] Database migration (006_setting_preservation.sql)
- [x] `setting-preserver.js` compute module
- [x] `setting-extractor.js` compute module
- [x] `context-assembler.js` integration
- [x] Unit tests
- [x] Integration tests
- [x] CLAUDE.md documentation
