# Internal API Contract: Setting Extractor

**Module**: `compute/setting-extractor.js`
**Feature**: 005-setting-preservation
**Date**: 2025-12-13

## Overview

This module extracts setting preferences from conversation text at session end using pattern matching. It identifies music preferences, atmosphere descriptors, location mentions, and time-of-day requests.

---

## Exported Functions

### extractSettingPreferences(messages)

Extract setting preferences from a conversation message history.

**Signature**:
```typescript
function extractSettingPreferences(
  messages: Array<{ role: string; content: string }>
): ExtractedPreferences
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messages` | Array<Message> | Yes | Conversation history |

**Message Object**:
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
}
```

**Returns**: `ExtractedPreferences`

**ExtractedPreferences Object**:
```typescript
interface ExtractedPreferences {
  musicPreference: string | null;
  atmosphereDescriptors: Record<string, string>;
  locationPreference: string | null;
  timeOfDay: string | null;
  personaLocations: Array<{
    personaName: string;
    location: string;
    context: string | null;
  }>;
  confidence: number;  // 0-1, how confident in extractions
}
```

**Extraction Patterns**:

| Category | Patterns | Example Input | Extracted Value |
|----------|----------|---------------|-----------------|
| Music | "play some X", "I prefer X playing", "jukebox playing X" | "I wish the jukebox played Bowie" | `musicPreference: "Bowie"` |
| Atmosphere | "less X", "more X", "prefer it X" | "less humidity, more candlelight" | `atmosphereDescriptors: { humidity: "less", lighting: "candlelight" }` |
| Location | "corner booth", "my usual spot", "at the counter" | "I like the corner booth" | `locationPreference: "corner booth"` |
| Time | "what if it were X", "imagine it's X" | "what if it were dawn?" | `timeOfDay: "dawn"` |
| Persona Location | "[persona] at the [location]" | "Hegel at the bar counter" | `personaLocations: [{ personaName: "Hegel", location: "bar counter" }]` |

**Behavior**:
- Only processes `user` role messages (user-expressed preferences)
- Returns empty/null values if no patterns match
- Multiple matches: last mention wins (most recent preference)
- Case-insensitive matching

**Example**:
```javascript
const messages = [
  { role: 'user', content: 'I wish the jukebox played Fado instead' },
  { role: 'assistant', content: 'The jukebox shifts...' },
  { role: 'user', content: 'I prefer less humidity' }
];

const prefs = extractSettingPreferences(messages);
// {
//   musicPreference: 'Fado',
//   atmosphereDescriptors: { humidity: 'less' },
//   locationPreference: null,
//   timeOfDay: null,
//   personaLocations: [],
//   confidence: 0.8
// }
```

---

### extractAndSaveSettings(sessionData)

Extract preferences from session and save to database. Intended for session-end processing.

**Signature**:
```typescript
function extractAndSaveSettings(sessionData: SessionData): Promise<ExtractionResult>
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionData` | SessionData | Yes | Session completion data |

**SessionData Object**:
```typescript
interface SessionData {
  sessionId: string;
  userId: string;
  personaId: string;
  personaName: string;
  messages: Array<{ role: string; content: string }>;
  startedAt: number;
  endedAt: number;
}
```

**Returns**: `Promise<ExtractionResult>`

**ExtractionResult Object**:
```typescript
interface ExtractionResult {
  extracted: ExtractedPreferences;
  saved: {
    userSettings: boolean;
    personaLocation: boolean;
  };
  fieldsUpdated: string[];
}
```

**Behavior**:
1. Call `extractSettingPreferences(messages)`
2. If preferences found, call `saveUserSettings()`
3. If persona location found, call `savePersonaLocation()`
4. Log to `operator_logs` as `setting_extraction`
5. Return extraction result

**Example**:
```javascript
const result = await extractAndSaveSettings({
  sessionId: 'session-123',
  userId: 'user-456',
  personaId: 'hegel-789',
  personaName: 'Hegel',
  messages: [...],
  startedAt: Date.now() - 300000,
  endedAt: Date.now()
});
// {
//   extracted: { musicPreference: 'Fado', ... },
//   saved: { userSettings: true, personaLocation: false },
//   fieldsUpdated: ['musicPreference']
// }
```

---

## Pattern Configuration

Patterns are defined as constants for easy iteration:

```javascript
export const SETTING_PATTERNS = {
  music: [
    /(?:play|prefer|like|love|wish.*played?)\s+(?:some\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
    /jukebox\s+(?:plays?|playing|played)\s+([A-Za-z]+)/i,
    /\b(fado|jobim|bowie|silence|jazz|classical|ambient)\b/i
  ],

  atmosphere: [
    /(?:less|more)\s+(\w+)/gi,
    /(?:prefer|like)\s+(?:it\s+)?(?:more\s+)?(\w+)/i,
    /\b(candlelight|dim|bright|humid|dry|warm|cool|quiet|loud)\b/i
  ],

  location: [
    /\b(corner\s+booth|bar\s+counter|window\s+seat|back\s+table|my\s+(?:usual\s+)?spot)\b/i,
    /(?:sit|sitting|seated)\s+(?:at|in|by)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i
  ],

  timeOfDay: [
    /(?:what\s+if|imagine|prefer)\s+(?:it\s+)?(?:were?|was|is)\s+(\w+)/i,
    /\b(dawn|dusk|midnight|noon|morning|evening|sunrise|sunset)\b/i
  ],

  personaLocation: [
    /(\w+)\s+(?:at|by|near)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i
  ]
};
```

---

## Error Handling

| Scenario | Behavior | Logged |
|----------|----------|--------|
| No patterns match | Return empty preferences | No (not an error) |
| Invalid messages array | Return empty preferences | `error_graceful` |
| Save failure | Return `saved: false` | `error_graceful` |
| Database unavailable | Continue with extraction only | `error_graceful` |

Extraction is fire-and-forget: failures do not affect session completion.

---

## Integration with Session Completion

Add to `completeSession()` in `context-assembler.js`:

```javascript
// After familiarity update:
const relationshipResult = await updateFamiliarity(userId, personaId, sessionQuality);

// NEW: Extract and save settings
const settingResult = await extractAndSaveSettings({
  sessionId,
  userId,
  personaId,
  personaName,
  messages,
  startedAt,
  endedAt
});

// Include in completion log:
await logOperation('session_complete', {
  sessionId,
  personaId,
  userId,
  details: {
    // ... existing fields ...
    settings_extracted: settingResult.fieldsUpdated.length > 0,
    settings_fields: settingResult.fieldsUpdated
  },
  // ...
});
```

---

## Confidence Scoring

Confidence score (0-1) reflects extraction reliability:

| Confidence | Criteria |
|------------|----------|
| 0.9-1.0 | Explicit preference statement ("I prefer X") |
| 0.7-0.9 | Clear keyword match with context |
| 0.5-0.7 | Keyword match only (no surrounding context) |
| 0.3-0.5 | Ambiguous match, might be conversational |
| 0.0-0.3 | Very low confidence, pattern match only |

Preferences with confidence < 0.3 are not saved.
