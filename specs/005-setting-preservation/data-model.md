# Data Model: Setting Preservation

**Feature**: 005-setting-preservation
**Date**: 2025-12-13

## Entity Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     SETTING PRESERVATION DATA MODEL                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐        ┌─────────────────┐                    │
│  │     users       │        │    personas     │                    │
│  │   (existing)    │        │   (existing)    │                    │
│  └────────┬────────┘        └────────┬────────┘                    │
│           │                          │                              │
│           │ 1                        │ 1                            │
│           │                          │                              │
│           ▼                          │                              │
│  ┌─────────────────┐                 │                              │
│  │  user_settings  │                 │                              │
│  │     (NEW)       │                 │                              │
│  │ - time_of_day   │                 │                              │
│  │ - music_pref    │                 │                              │
│  │ - atmosphere    │                 │                              │
│  │ - location_pref │                 │                              │
│  │ - custom_text   │                 │                              │
│  │ - sys_config    │                 │                              │
│  └─────────────────┘                 │                              │
│           │                          │                              │
│           │ 1                        │                              │
│           │                          │                              │
│           ▼                          ▼                              │
│  ┌───────────────────────────────────────────┐                     │
│  │              relationships                 │                     │
│  │              (EXTENDED)                    │                     │
│  │ + preferred_location (NEW)                 │                     │
│  │ + location_context (NEW)                   │                     │
│  └───────────────────────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Entities

### 1. user_settings (NEW)

Global setting preferences for a user. One record per user (created on first preference capture).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique identifier |
| `user_id` | UUID | FK → users(id), UNIQUE, ON DELETE CASCADE | User this setting belongs to |
| `time_of_day` | VARCHAR(50) | DEFAULT '2 AM' | Preferred time ("2 AM", "dawn", "midnight") |
| `music_preference` | VARCHAR(100) | DEFAULT NULL | Preferred music ("Fado", "Bowie", "silence") |
| `atmosphere_descriptors` | JSONB | DEFAULT '{}' | Sensory preferences `{"humidity": "less", "lighting": "candlelight"}` |
| `location_preference` | VARCHAR(100) | DEFAULT NULL | Preferred spot in bar ("corner booth", "bar counter") |
| `custom_setting_text` | TEXT | DEFAULT NULL | User's own description of ideal atmosphere |
| `system_config` | JSONB | DEFAULT '{}' | Operator overrides `{"token_budget": 300, "drift_enabled": false}` |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification (used for 90-day retention) |

**Indexes**:
- `idx_user_settings_user` on `user_id` (for fast lookup)
- `idx_user_settings_updated` on `updated_at` (for retention purge)

**Constraints**:
- `user_id` must reference existing user
- One record per user (UNIQUE constraint)
- Cascades on user deletion

**Validation Rules**:
- `time_of_day`: Free text, no validation (user's imagination)
- `music_preference`: Free text, displayed as-is
- `atmosphere_descriptors`: Valid JSON object
- `system_config`: Valid JSON object; keys must be known config options

---

### 2. relationships (EXTENDED)

Existing table extended with persona-specific location preferences.

| Field (NEW) | Type | Constraints | Description |
|-------------|------|-------------|-------------|
| `preferred_location` | VARCHAR(100) | DEFAULT NULL | Where this persona-user pair meets ("bar counter", "corner booth") |
| `location_context` | TEXT | DEFAULT NULL | Additional detail ("where Hegel holds court", "by the window Soares watches from") |

**Migration Notes**:
- Backward compatible: existing rows get NULL values
- No data migration required
- Existing constraints preserved

---

### 3. context_templates (EXTENDED SEED DATA)

Existing table; add parameterized setting template.

**New Template Record**:
```sql
INSERT INTO context_templates (template_type, subtype, template, priority) VALUES
('setting', 'personalized',
 'It is {time} at {location}. {atmosphere}. {music}. You exist in this moment.',
 20);
```

Priority 20 ensures personalized template is selected over default (priority 10) when user has preferences.

---

## State Transitions

### User Settings Lifecycle

```text
┌──────────────┐
│   NO_RECORD  │ ◄── New user, no preferences
└──────┬───────┘
       │ First preference captured
       ▼
┌──────────────┐
│    ACTIVE    │ ◄── Has preferences, updated_at recent
└──────┬───────┘
       │ 90 days without activity
       ▼
┌──────────────┐
│   STALE      │ ◄── updated_at > 90 days old
└──────┬───────┘
       │ Purge job runs
       ▼
┌──────────────┐
│   DELETED    │ ◄── Record removed, user returns to NO_RECORD state
└──────────────┘
```

**Transition Triggers**:
- NO_RECORD → ACTIVE: `setting-extractor.js` captures preference at session end
- ACTIVE → ACTIVE: Any session updates `updated_at`
- ACTIVE → STALE: Time passage (no user activity for 90 days)
- STALE → DELETED: Daily purge job (`purge_stale_settings()`)
- DELETED → ACTIVE: User returns, new preference captured

---

### Relationship Location Lifecycle

```text
┌──────────────┐
│  NO_LOCATION │ ◄── Existing relationship, no location preference
└──────┬───────┘
       │ User mentions location for this persona
       ▼
┌──────────────┐
│ HAS_LOCATION │ ◄── preferred_location set
└──────────────┘
       │ User mentions different location
       ▼
┌──────────────┐
│ HAS_LOCATION │ ◄── preferred_location updated (most recent wins)
└──────────────┘
```

---

## Relationships Diagram

```text
users (1) ────────── (0..1) user_settings
  │
  │
  └───────── (N) relationships (N) ───────── personas
                    │
                    │ EXTENDED WITH:
                    │ - preferred_location
                    │ - location_context
```

**Cardinality**:
- One user has zero or one user_settings record
- One user has many relationships (one per interacted persona)
- One persona has many relationships (one per interacting user)
- Existing `relationships` constraints preserved

---

## Query Patterns

### Load User Setting for Context Assembly

```sql
SELECT
    us.time_of_day,
    us.music_preference,
    us.atmosphere_descriptors,
    us.location_preference,
    us.custom_setting_text,
    us.system_config
FROM user_settings us
WHERE us.user_id = $1;
```

### Load Persona-Specific Location

```sql
SELECT
    r.preferred_location,
    r.location_context
FROM relationships r
WHERE r.user_id = $1 AND r.persona_id = $2;
```

### Compile Full Setting Context

```sql
SELECT
    COALESCE(us.time_of_day, '2 AM') AS time_of_day,
    COALESCE(us.music_preference, 'Tom Jobim on the jukebox') AS music,
    COALESCE(us.location_preference, r.preferred_location, 'the bar') AS location,
    us.atmosphere_descriptors,
    r.preferred_location AS persona_location,
    r.location_context
FROM users u
LEFT JOIN user_settings us ON us.user_id = u.id
LEFT JOIN relationships r ON r.user_id = u.id AND r.persona_id = $2
WHERE u.id = $1;
```

### Purge Stale Settings (Daily Job)

```sql
DELETE FROM user_settings
WHERE updated_at < NOW() - INTERVAL '90 days';
```

---

## Data Volume Estimates

| Entity | Expected Records | Growth Rate |
|--------|------------------|-------------|
| user_settings | 1 per active user | Bounded by user count |
| relationships (location fields) | N/A (extends existing) | No new records |

**Storage Impact**: Minimal. VARCHAR(100) + TEXT + JSONB ≈ 1KB per user.

---

## Backward Compatibility

| Existing Component | Impact | Mitigation |
|--------------------|--------|------------|
| `context-assembler.js` | Uses `getSettingContext()` | Replace with `compileUserSetting()` with fallback |
| `context_templates` | Default template exists | Personalized template added alongside, not replacing |
| `relationships` | Existing data preserved | New columns nullable, default NULL |
| `completeSession()` | Calls `updateFamiliarity()` | Add `extractSettings()` call after |

All changes are additive. Existing functionality preserved.
