# Research: Setting Preservation

**Feature**: 005-setting-preservation
**Date**: 2025-12-13

## Research Questions

### 1. Preference Extraction Patterns

**Question**: How should setting preferences be extracted from conversation text at session end?

**Decision**: Pattern-based extraction using keyword matching and sentiment analysis for atmosphere descriptors.

**Rationale**:
- AEON already uses pattern matching in `memory-extractor.js` for memorable exchanges
- Session-end processing avoids real-time latency impact
- Simple patterns are sufficient for atmosphere preferences (music, lighting, location, time)
- No ML/NLP dependency required—keeps stack simple

**Alternatives Considered**:
1. Real-time extraction during conversation — Rejected: Adds latency, complexity
2. LLM-based extraction — Rejected: Expensive, overkill for structured preferences
3. Explicit user commands — Rejected: Breaks immersion, violates Constitution II (invisible)

**Implementation Approach**:
```javascript
const SETTING_PATTERNS = {
  music: [
    /(?:play|prefer|like|love)\s+(?:some\s+)?(\w+(?:\s+\w+)?)\s*(?:music|playing)?/i,
    /jukebox\s+(?:plays?|playing)\s+(\w+)/i,
    /(?:fado|jobim|bowie|silence)/i
  ],
  atmosphere: [
    /(?:less|more)\s+(\w+)/i,  // "less humidity", "more candlelight"
    /(?:prefer|like)\s+(?:it\s+)?(\w+)/i
  ],
  location: [
    /(?:corner|booth|counter|bar|window|table)/i,
    /(?:my|usual)\s+(?:spot|place|seat)/i
  ],
  timeOfDay: [
    /(?:what if|imagine|prefer)\s+(?:it\s+were?\s+)?(\w+)/i  // "what if it were dawn"
  ]
};
```

---

### 2. Data Retention Implementation

**Question**: How should 90-day retention with automatic purge be implemented?

**Decision**: Use PostgreSQL `updated_at` timestamp with scheduled cleanup job.

**Rationale**:
- PostgreSQL already tracks `updated_at` on relationships table (see migration 005)
- Simple `WHERE updated_at < NOW() - INTERVAL '90 days'` clause
- Can run as daily cron job or pg_cron extension
- Follows existing AEON database patterns

**Alternatives Considered**:
1. TTL index (MongoDB-style) — Rejected: PostgreSQL doesn't support native TTL
2. Application-level cleanup — Rejected: Requires always-running service
3. Database triggers — Rejected: Expensive on high-write tables

**Implementation Approach**:
```sql
-- Scheduled cleanup function (run daily via cron or pg_cron)
CREATE OR REPLACE FUNCTION purge_stale_settings()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_settings
  WHERE updated_at < NOW() - INTERVAL '90 days'
  RETURNING 1 INTO deleted_count;

  -- Also clean relationship_settings for inactive users
  DELETE FROM relationship_settings rs
  WHERE NOT EXISTS (
    SELECT 1 FROM user_settings us
    WHERE us.user_id = rs.user_id
  );

  RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;
```

---

### 3. Setting Template Variable Substitution

**Question**: How should user preferences be interpolated into setting templates?

**Decision**: Simple string replacement with fallback to defaults for missing values.

**Rationale**:
- Existing `context_templates` table uses plain text with `{placeholder}` syntax
- No complex templating engine needed
- Graceful degradation: missing preferences use default values

**Alternatives Considered**:
1. Handlebars/Mustache — Rejected: New dependency, overkill for 2-3 variables
2. Template literals (JS) — Rejected: SQL templates can't use JS directly
3. SQL string formatting — Rejected: SQL injection risk, complex escaping

**Implementation Approach**:
```javascript
function compileSettingTemplate(template, preferences) {
  const defaults = {
    time: '2 AM',
    location: 'O Fim',
    music: 'Tom Jobim on the jukebox',
    atmosphere: 'humidity eternal, chopp cold'
  };

  const values = { ...defaults, ...preferences };

  return template
    .replace(/{time}/g, values.time)
    .replace(/{location}/g, values.location)
    .replace(/{music}/g, values.music)
    .replace(/{atmosphere}/g, values.atmosphere);
}
```

---

### 4. Persona-Specific Location Persistence

**Question**: Where should persona-user location preferences be stored?

**Decision**: Extend existing `relationships` table with `preferred_location` column.

**Rationale**:
- `relationships` table already tracks persona-user bonds (familiarity, trust, memories)
- Adding location preserves referential integrity without new join tables
- Aligns with Constitution IV (Relationship Continuity)
- Migration pattern follows existing 005_relationship_continuity.sql

**Alternatives Considered**:
1. Separate `relationship_settings` table — Rejected: Over-normalized, adds complexity
2. JSON column in relationships — Acceptable but less queryable
3. Store in user_settings JSON — Rejected: Doesn't capture per-persona variation

**Implementation Approach**:
```sql
ALTER TABLE relationships
ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_context TEXT;

COMMENT ON COLUMN relationships.preferred_location IS
  'User-persona meeting spot within O Fim (e.g., corner booth, bar counter)';
COMMENT ON COLUMN relationships.location_context IS
  'Additional context about their shared space';
```

---

### 5. Integration with Context Assembly

**Question**: How should setting preferences integrate with existing `context-assembler.js`?

**Decision**: Replace static `getSettingContext()` with dynamic `compileUserSetting()`.

**Rationale**:
- `context-assembler.js` already has a setting slot in the assembly pipeline (line 315)
- Current implementation retrieves static template from `context_templates`
- New implementation adds user preference lookup and variable substitution
- Maintains existing token budget enforcement (200 tokens for setting)

**Alternatives Considered**:
1. New assembly pipeline — Rejected: Breaks existing integration
2. Post-assembly modification — Rejected: Violates token budget contract
3. Middleware pattern — Rejected: Adds unnecessary abstraction

**Implementation Approach**:
```javascript
// In context-assembler.js, replace:
const setting = includeSetting ? await getSettingContext(sessionId) : null;

// With:
const setting = includeSetting
  ? await compileUserSetting(userId, personaId, sessionId)
  : null;
```

---

### 6. Default Setting Behavior

**Question**: How should the system behave for new users with no preferences?

**Decision**: Graceful fallback to existing default template with full constitution compliance.

**Rationale**:
- FR-003 requires default template for users without preferences
- Constitution V defines O Fim as "always 2 AM in humid Rio de Janeiro"
- Existing default in `context_templates` is correct baseline
- No behavioral change for existing users until they express preferences

**Implementation Approach**:
1. Query `user_settings` for user preferences
2. If no record exists, return default template unchanged
3. If record exists but preferences are empty, still use defaults
4. Only personalize when explicit preferences are stored

---

## Integration Points Summary

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `db/migrations/006_setting_preservation.sql` | NEW | Schema: `user_settings`, `relationships.preferred_location` |
| `compute/setting-preserver.js` | NEW | Load/save/compile user settings |
| `compute/setting-extractor.js` | NEW | Extract preferences from session text |
| `compute/context-assembler.js` | UPDATE | Replace `getSettingContext()` with `compileUserSetting()` |
| `context_templates` seed data | UPDATE | Add parameterized setting template |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Preference extraction misses valid patterns | Medium | Low | Start with conservative patterns, iterate based on logs |
| Token budget exceeded by custom settings | Low | Medium | Enforce truncation in `compileUserSetting()` |
| Migration breaks existing sessions | Low | High | Backward-compatible ALTER TABLE, default fallback |
| Retention purge affects active users | Low | High | Purge based on `updated_at`, not `created_at` |

---

## Outstanding Questions

None. All NEEDS CLARIFICATION items resolved via spec clarifications and research.
