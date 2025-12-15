# Internal API Contract: Setting Preserver

**Module**: `compute/setting-preserver.js`
**Feature**: 005-setting-preservation
**Date**: 2025-12-13

## Overview

This module handles loading, saving, and compiling user setting preferences for context assembly. It integrates with the existing `context-assembler.js` pipeline.

---

## Exported Functions

### loadUserSettings(userId)

Retrieve stored setting preferences for a user.

**Signature**:
```typescript
function loadUserSettings(userId: string): Promise<UserSettings | null>
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | string (UUID) | Yes | User identifier |

**Returns**: `Promise<UserSettings | null>`
- Returns `UserSettings` object if preferences exist
- Returns `null` if no preferences stored (use defaults)

**UserSettings Object**:
```typescript
interface UserSettings {
  userId: string;
  timeOfDay: string;           // Default: "2 AM"
  musicPreference: string | null;
  atmosphereDescriptors: Record<string, string>;
  locationPreference: string | null;
  customSettingText: string | null;
  systemConfig: Record<string, any>;
  updatedAt: Date;
}
```

**Errors**:
- Database connection failures return `null` (graceful degradation)
- Invalid UUID throws validation error

**Example**:
```javascript
const settings = await loadUserSettings('user-uuid-123');
if (settings) {
  console.log(`User prefers ${settings.musicPreference}`);
}
```

---

### saveUserSettings(userId, preferences)

Store or update user setting preferences. Creates record if not exists, updates if exists.

**Signature**:
```typescript
function saveUserSettings(
  userId: string,
  preferences: Partial<UserSettingsInput>
): Promise<{ success: boolean; updatedFields: string[] }>
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | string (UUID) | Yes | User identifier |
| `preferences` | Partial<UserSettingsInput> | Yes | Fields to update |

**UserSettingsInput Object**:
```typescript
interface UserSettingsInput {
  timeOfDay?: string;
  musicPreference?: string;
  atmosphereDescriptors?: Record<string, string>;
  locationPreference?: string;
  customSettingText?: string;
  systemConfig?: Record<string, any>;
}
```

**Returns**: `Promise<{ success: boolean; updatedFields: string[] }>`

**Behavior**:
- Uses `INSERT ... ON CONFLICT UPDATE` (upsert)
- Updates `updated_at` timestamp on every save
- Only provided fields are updated; others preserved

**Example**:
```javascript
const result = await saveUserSettings('user-uuid-123', {
  musicPreference: 'Fado',
  atmosphereDescriptors: { humidity: 'less', lighting: 'candlelight' }
});
// result: { success: true, updatedFields: ['musicPreference', 'atmosphereDescriptors'] }
```

---

### compileUserSetting(userId, personaId, sessionId)

Compile a personalized setting context string for context assembly. This replaces `getSettingContext()`.

**Signature**:
```typescript
function compileUserSetting(
  userId: string,
  personaId: string,
  sessionId: string
): Promise<string>
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | string (UUID) | Yes | User identifier |
| `personaId` | string (UUID) | Yes | Persona being invoked |
| `sessionId` | string (UUID) | Yes | Current session (for logging) |

**Returns**: `Promise<string>` - Compiled setting text (max 200 tokens)

**Behavior**:
1. Load user settings from `user_settings` table
2. Load persona-specific location from `relationships` table
3. If no preferences: return default template unchanged
4. If preferences exist: substitute into personalized template
5. Truncate to 200 tokens if necessary
6. Log operation to `operator_logs` (invisible)

**Default Output** (no preferences):
```text
It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold. You exist in this moment.
```

**Personalized Output** (with preferences):
```text
It is dawn at O Fim. The candlelight flickers, less humid tonight. Fado drifts from the jukebox. You exist in this moment at your usual corner booth.
```

**Example**:
```javascript
const setting = await compileUserSetting(
  'user-uuid-123',
  'hegel-uuid',
  'session-uuid-456'
);
// Returns personalized or default setting string
```

---

### loadPersonaLocation(userId, personaId)

Load the preferred meeting location for a specific persona-user pair.

**Signature**:
```typescript
function loadPersonaLocation(
  userId: string,
  personaId: string
): Promise<PersonaLocation | null>
```

**Returns**: `Promise<PersonaLocation | null>`

**PersonaLocation Object**:
```typescript
interface PersonaLocation {
  preferredLocation: string | null;
  locationContext: string | null;
}
```

**Example**:
```javascript
const location = await loadPersonaLocation('user-uuid', 'hegel-uuid');
// { preferredLocation: 'bar counter', locationContext: 'where Hegel holds court' }
```

---

### savePersonaLocation(userId, personaId, location)

Save or update the preferred meeting location for a persona-user pair.

**Signature**:
```typescript
function savePersonaLocation(
  userId: string,
  personaId: string,
  location: { preferredLocation?: string; locationContext?: string }
): Promise<{ success: boolean }>
```

**Behavior**:
- Updates existing relationship record
- Does NOT create relationship if missing (relationship must already exist)
- Returns `{ success: false }` if relationship doesn't exist

---

## Database Function Contracts

### purge_stale_settings()

SQL function to remove settings older than 90 days.

**Signature**:
```sql
CREATE OR REPLACE FUNCTION purge_stale_settings()
RETURNS INTEGER
```

**Returns**: Number of records deleted

**Behavior**:
- Deletes from `user_settings` where `updated_at < NOW() - INTERVAL '90 days'`
- Intended to run as daily cron job

---

## Integration Points

### Context Assembler Integration

Replace in `context-assembler.js`:

```javascript
// BEFORE (static):
const setting = includeSetting ? await getSettingContext(sessionId) : null;

// AFTER (dynamic):
import { compileUserSetting } from './setting-preserver.js';
const setting = includeSetting
  ? await compileUserSetting(userId, personaId, sessionId)
  : null;
```

### Session Completion Integration

Add to `completeSession()` in `context-assembler.js`:

```javascript
// After memory extraction, before logging completion:
import { extractAndSaveSettings } from './setting-extractor.js';
await extractAndSaveSettings(sessionData);
```

---

## Error Handling

| Scenario | Behavior | Logged Operation |
|----------|----------|------------------|
| Database unavailable | Return default/null | `error_graceful` |
| Invalid user ID | Return default/null | `error_graceful` |
| Compilation failure | Return default template | `error_graceful` |
| Save failure | Return `{ success: false }` | `error_graceful` |

All errors are graceful per Constitution II (Invisible Infrastructure).
