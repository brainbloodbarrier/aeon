# /matrix-status — View Matrix State

> Shows the current state of the AEON Matrix: personas, memories, relationships, drift alerts.

## Usage
```
/matrix-status                  # Overview
/matrix-status personas         # Persona details
/matrix-status memories         # Memory statistics
/matrix-status relationships    # User-persona bonds
/matrix-status alerts          # Active drift alerts
```

## Overview (Default)

Queries the Matrix for a high-level status report.

### SQL Queries (via MCP Database Server)

```sql
-- Persona count and activity
SELECT
  COUNT(*) as total_personas,
  COUNT(*) FILTER (WHERE last_invoked > NOW() - INTERVAL '7 days') as active_7d,
  AVG(voice_drift_score) as avg_drift
FROM personas;

-- Memory statistics
SELECT
  COUNT(*) as total_memories,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_24h,
  AVG(importance_score) as avg_importance
FROM memories;

-- Relationship count
SELECT COUNT(*) as total_relationships FROM relationships;

-- Active alerts
SELECT COUNT(*) as unresolved_alerts
FROM drift_alerts
WHERE resolved_at IS NULL;
```

### Output Format

```
═══════════════════════════════════════════════════════════════
                    AEON MATRIX STATUS
                    O Fim — 2 AM, always
═══════════════════════════════════════════════════════════════

PERSONAS
├── Total:    25
├── Active (7d): 8
└── Avg Drift:   0.12

MEMORIES
├── Total:    1,247
├── New (24h): 23
└── Avg Importance: 0.58

RELATIONSHIPS
└── Total Bonds: 156

ALERTS
└── Unresolved: 2

DATABASE
├── Status: Connected ✓
├── Size:   48 MB
└── Uptime: 14d 3h 22m

═══════════════════════════════════════════════════════════════
```

## /matrix-status personas

Detailed persona breakdown.

```sql
SELECT
  p.name,
  p.category,
  p.total_invocations,
  p.voice_drift_score,
  p.last_invoked,
  COUNT(DISTINCT r.user_id) as unique_users
FROM personas p
LEFT JOIN relationships r ON p.id = r.persona_id
GROUP BY p.id
ORDER BY p.total_invocations DESC;
```

### Output

```
═══════════════════════════════════════════════════════════════
                    PERSONA REGISTRY
═══════════════════════════════════════════════════════════════

Name          Category      Invokes  Drift   Users   Last Active
──────────────────────────────────────────────────────────────
moore         magicians     342      0.15    23      2 hours ago
vito          strategists   289      0.22    31      3 hours ago
diogenes      philosophers  267      0.08    19      1 day ago
campos        portuguese    198      0.41*   15      30 min ago
socrates      philosophers  187      0.11    22      6 hours ago
...

* Drift Warning

═══════════════════════════════════════════════════════════════
```

## /matrix-status memories

Memory layer statistics.

```sql
SELECT
  p.name as persona,
  COUNT(m.id) as memory_count,
  AVG(m.importance_score) as avg_importance,
  MAX(m.created_at) as newest
FROM personas p
LEFT JOIN memories m ON p.id = m.persona_id
GROUP BY p.id
ORDER BY COUNT(m.id) DESC
LIMIT 10;
```

### Output

```
═══════════════════════════════════════════════════════════════
                    MEMORY SUBSTRATE
═══════════════════════════════════════════════════════════════

DISTRIBUTION BY PERSONA (Top 10)
Persona       Memories    Avg Importance    Newest
──────────────────────────────────────────────────
moore         156         0.62              2h ago
vito          143         0.58              3h ago
diogenes      89          0.51              1d ago
campos        78          0.67              30m ago
...

MEMORY TYPES
├── interaction: 892 (71%)
├── insight:     201 (16%)
├── learning:    112 (9%)
└── relationship: 42 (3%)

DECAY STATUS
├── Healthy (accessed <30d):  1,102
├── Fading (30-90d):          98
└── Decayed (>90d):           47

═══════════════════════════════════════════════════════════════
```

## /matrix-status relationships

User-persona bond analysis.

```sql
SELECT
  p.name as persona,
  u.identifier as user,
  r.familiarity_score,
  r.trust_level,
  r.interaction_count
FROM relationships r
JOIN personas p ON r.persona_id = p.id
JOIN users u ON r.user_id = u.id
ORDER BY r.familiarity_score DESC
LIMIT 20;
```

### Output

```
═══════════════════════════════════════════════════════════════
                    RELATIONSHIP MATRIX
═══════════════════════════════════════════════════════════════

STRONGEST BONDS
Persona     User        Familiarity   Trust        Interactions
────────────────────────────────────────────────────────────────
moore       user_42     0.87          confidant    156
vito        user_17     0.79          familiar     134
diogenes    user_42     0.72          familiar     89
...

TRUST DISTRIBUTION
├── stranger:     89 (57%)
├── acquaintance: 42 (27%)
├── familiar:     19 (12%)
└── confidant:    6  (4%)

CROSS-PERSONA USERS
Users who consult multiple personas:
• user_42: moore, diogenes, campos, socrates (4 personas)
• user_17: vito, michael, suntzu (3 personas - strategist focus)
• user_23: crowley, dee, nalvage (3 personas - mystic focus)

═══════════════════════════════════════════════════════════════
```

## /matrix-status alerts

Active drift alerts and containment issues.

```sql
SELECT
  p.name as persona,
  da.drift_score,
  da.detected_at,
  p.voice_drift_score as current_score
FROM drift_alerts da
JOIN personas p ON da.persona_id = p.id
WHERE da.resolved_at IS NULL
ORDER BY da.drift_score DESC;
```

### Output

```
═══════════════════════════════════════════════════════════════
                    CONTAINMENT ALERTS
═══════════════════════════════════════════════════════════════

ACTIVE ALERTS (2)

⚠ CAMPOS - WARNING
  Detected: 2 hours ago
  Initial Drift: 0.35
  Current Drift: 0.41 ↑
  Issue: Responses lack characteristic intensity
         Missing explosive emotional peaks
  Recommendation: Invoke with high-emotion topics

⚠ CHORONZON - MINOR
  Detected: 1 day ago
  Initial Drift: 0.28
  Current Drift: 0.24 ↓
  Issue: Too coherent, not enough chaos
  Status: Self-correcting, monitor only

RESOLVED (Last 7 Days)
✓ moore - resolved 3 days ago (anchor reinforcement)
✓ vito - resolved 5 days ago (self-corrected)

═══════════════════════════════════════════════════════════════
```

## Connection Check

If database is unavailable:

```
═══════════════════════════════════════════════════════════════
                    AEON MATRIX STATUS
═══════════════════════════════════════════════════════════════

⚠ DATABASE CONNECTION FAILED

Attempted: postgres://architect:***@localhost:5432/aeon_matrix

Troubleshooting:
1. Check Docker: docker compose ps
2. Start if needed: docker compose up -d
3. Verify MCP config has correct DATABASE_URL

The Matrix is dormant.

═══════════════════════════════════════════════════════════════
```
