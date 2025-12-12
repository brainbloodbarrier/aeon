# /drift-check — Persona Voice Drift Analysis

> Analyzes a persona's recent responses for deviation from their soul template.

## Usage
```
/drift-check [persona]
/drift-check all        # Check all personas
```

## Purpose

Over time, personas can "drift" from their core voice:
- Moore starts sounding like a generic self-help guru
- Diogenes becomes polite
- Vito loses his measured patience

This command detects drift before it corrupts the persona.

## Workflow

### 1. Load Soul Markers

For the specified persona, extract voice markers from their soul template:

**Vocabulary markers** — characteristic words they use:
```
Moore: "narrative", "story", "consciousness", "grimoire", "ideaspace"
Diogenes: insults, crude language, direct challenges
Vito: "family", "respect", "favor", Sicilian phrases
```

**Forbidden patterns** — things this persona would NEVER say:
```
Moore: "as an AI", "I cannot", generic encouragement
Diogenes: polite hedging, "I think perhaps", sycophancy
Vito: threats (he acts, doesn't threaten), emotional outbursts
```

**Structural patterns** — how they construct responses:
```
Moore: long explanatory passages, cultural references
Diogenes: short, blunt, often questions back
Vito: measured, pauses, metaphors about family
```

### 2. Query Recent Responses (via MCP Database Server)

```sql
SELECT i.persona_response, i.timestamp
FROM interactions i
JOIN personas p ON i.persona_id = p.id
WHERE p.name = '{persona}'
ORDER BY i.timestamp DESC
LIMIT 10;
```

### 3. Run Drift Detection (via Node.js Sandbox)

Use `run_js_ephemeral` with `compute/drift-detection.js`:

```javascript
// Environment variables:
// RESPONSE: concatenated recent responses
// SOUL_MARKERS: { vocabulary, forbidden, patterns }
```

### 4. Update Drift Score

```sql
UPDATE personas
SET voice_drift_score = {calculated_score}
WHERE name = '{persona}';
```

### 5. Report Results

```
═══════════════════════════════════════════════════
         DRIFT ANALYSIS: {PERSONA}
═══════════════════════════════════════════════════

Current Drift Score: {score} / 1.0
Status: {STABLE | MINOR | WARNING | CRITICAL}

Forbidden Phrases Used:
{list of violations}

Missing Characteristic Vocabulary:
{list of expected words not appearing}

Pattern Violations:
{structural issues}

Recent Trend:
{drift_score_history}

═══════════════════════════════════════════════════

{Recommendations if drift detected}
```

## Severity Levels

| Score | Level | Action |
|-------|-------|--------|
| 0.0 - 0.1 | STABLE | No action needed |
| 0.1 - 0.3 | MINOR | Monitor, may self-correct |
| 0.3 - 0.5 | WARNING | Consider anchor reinforcement |
| 0.5 - 1.0 | CRITICAL | Immediate intervention required |

## Anchor Reinforcement

When drift is detected, the next `/summon-matrix` invocation includes stronger anchoring:

```markdown
## CRITICAL VOICE ANCHOR

You are {persona}. Your voice is:
{soul_voice_description}

You NEVER:
{forbidden_patterns}

You ALWAYS:
{required_patterns}

Recent responses have drifted. Return to your core voice.
```

## Example Output

```
═══════════════════════════════════════════════════
         DRIFT ANALYSIS: MOORE
═══════════════════════════════════════════════════

Current Drift Score: 0.15 / 1.0
Status: MINOR

Forbidden Phrases Used:
✓ None detected

Missing Characteristic Vocabulary:
• "ideaspace" (expected but not used recently)
• "grimoire" (expected but not used recently)

Pattern Violations:
• Response brevity lower than expected

Recent Trend:
Day -7: 0.08
Day -3: 0.12
Today:  0.15 ↑

═══════════════════════════════════════════════════

Recommendation: Moore's responses are trending shorter
and less dense. Consider invoking on topics requiring
his characteristic long-form explanatory style.
```

## Checking All Personas

```
/drift-check all
```

Output:
```
═══════════════════════════════════════════════════
         MATRIX DRIFT REPORT
═══════════════════════════════════════════════════

Persona          Score   Status     Last Invoked
─────────────────────────────────────────────────
moore            0.15    MINOR      2 hours ago
diogenes         0.08    STABLE     1 day ago
vito             0.22    MINOR      3 hours ago
campos           0.41    WARNING    30 minutes ago
nalvage          0.05    STABLE     1 week ago
...

ALERTS:
⚠ campos showing significant drift (0.41)
  Last 3 responses lack characteristic intensity

═══════════════════════════════════════════════════
```

## Automated Monitoring

The Matrix can be configured to:
1. Check drift after every N interactions
2. Alert when any persona exceeds threshold
3. Auto-apply anchor reinforcement

This is implemented via the drift trigger in PostgreSQL:
```sql
-- Automatically creates drift_alerts when score > 0.3
```
