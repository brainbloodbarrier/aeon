# AEON Matrix Architecture V2 — MCP-Native Design

> "Don't build what exists. Compose what's proven."

---

## Evolution from V1

**V1 Problem:** We designed a custom Bridge MCP server (~500 lines TypeScript)
**V2 Solution:** Compose existing MCP servers that already solve each piece

```
V1: Custom Bridge ─────────────────────────► V2: MCP Composition
┌─────────────────┐                          ┌─────────────────────────────┐
│  Custom Bridge  │                          │  MCP Database Server        │
│  - DB client    │         becomes          │  (already handles SQL)      │
│  - Memory API   │  ───────────────────►    ├─────────────────────────────┤
│  - Embeddings   │                          │  Node.js Sandbox            │
│  - Drift logic  │                          │  (compute in containers)    │
└─────────────────┘                          ├─────────────────────────────┤
                                             │  Neo4j (optional)           │
                                             │  (relationship graphs)      │
                                             └─────────────────────────────┘
```

---

## Architecture Overview (V2)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           THE MATRIX (Docker + MCP)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         MCP SERVER LAYER                                 │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │ │
│  │  │ MCP Database     │  │ Node.js Sandbox  │  │ Neo4j Modeling   │      │ │
│  │  │ Server           │  │                  │  │ (optional)       │      │ │
│  │  │                  │  │                  │  │                  │      │ │
│  │  │ • query_database │  │ • run_js         │  │ • Cypher queries │      │ │
│  │  │ • execute_sql    │  │ • run_js_ephemer │  │ • Graph exports  │      │ │
│  │  │ • list_tables    │  │ • sandbox_exec   │  │ • Validations    │      │ │
│  │  │ • describe_table │  │                  │  │                  │      │ │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘      │ │
│  │           │                      │                      │               │ │
│  └───────────┼──────────────────────┼──────────────────────┼───────────────┘ │
│              │                      │                      │                  │
│              ▼                      ▼                      ▼                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         STORAGE LAYER                                    │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │ │
│  │  │ PostgreSQL       │  │ Volume Mounts    │  │ Neo4j (optional) │      │ │
│  │  │ (pgvector)       │  │                  │  │                  │      │ │
│  │  │                  │  │ /souls (ro)      │  │ Memory Graph     │      │ │
│  │  │ • Personas       │  │ /skills (ro)     │  │ Relationship     │      │ │
│  │  │ • Memories       │  │                  │  │ Network          │      │ │
│  │  │ • Relationships  │  │                  │  │                  │      │ │
│  │  │ • Interactions   │  │                  │  │                  │      │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────┐
                          │    ORCHESTRATION     │
                          │    (.claude/commands)│
                          │                      │
                          │  /summon-matrix      │
                          │  /memory-inject      │
                          │  /drift-check        │
                          └──────────────────────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │    USER      │
                              └──────────────┘
```

---

## MCP Server Mapping

### 1. MCP Database Server → Memory Substrate

| Tool | Matrix Use |
|------|------------|
| `connect_to_database` | Connect to PostgreSQL on startup |
| `execute_sql` | All CRUD operations |
| `query_database` | Natural language queries ("find Moore's last 5 interactions") |
| `list_tables` | Debugging/monitoring |
| `describe_table` | Schema inspection |

**Connection String:**
```
postgres://architect:${DB_PASSWORD}@localhost:5432/aeon_matrix
```

### 2. Node.js Sandbox → Compute Engine

| Tool | Matrix Use |
|------|------------|
| `run_js_ephemeral` | One-shot computations (embeddings, drift scores) |
| `run_js` | Persistent compute sessions |
| `sandbox_exec` | Shell commands in container |

**Use Cases:**
- Generate embeddings for semantic search
- Calculate drift scores
- Extract learning patterns
- Analyze response quality

### 3. Neo4j Data Modeling → Relationship Graph (Optional)

| Tool | Matrix Use |
|------|------------|
| `get_node_cypher_ingest_query` | Create persona/user/memory nodes |
| `get_relationship_cypher_ingest_query` | Create KNOWS, REMEMBERS, INTERACTED_WITH edges |
| `validate_data_model` | Ensure graph integrity |
| `get_mermaid_config_str` | Visualize relationships |

**Graph Model:**
```
(Persona)-[:KNOWS {familiarity: 0.7}]->(User)
(Persona)-[:REMEMBERS {importance: 0.9}]->(Memory)
(Memory)-[:ABOUT]->(User)
(Interaction)-[:PRODUCED]->(Memory)
```

---

## Docker Composition (V2)

```yaml
# docker-compose.yml (V2 - MCP Native)
version: '3.8'

services:
  # ═══════════════════════════════════════════════════
  # STORAGE LAYER
  # ═══════════════════════════════════════════════════

  aeon-db:
    image: pgvector/pgvector:pg16
    container_name: aeon-matrix-db
    environment:
      POSTGRES_DB: aeon_matrix
      POSTGRES_USER: architect
      POSTGRES_PASSWORD: ${DB_PASSWORD:-matrix_secret}
    volumes:
      - aeon_memory:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - matrix
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U architect -d aeon_matrix"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional: Neo4j for relationship graphs
  aeon-graph:
    image: neo4j:5-community
    container_name: aeon-matrix-graph
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD:-matrix_graph}
      NEO4J_PLUGINS: '["apoc"]'
    volumes:
      - aeon_graph:/data
    ports:
      - "7474:7474"  # Browser
      - "7687:7687"  # Bolt
    networks:
      - matrix
    profiles:
      - graph  # Only with --profile graph

  # ═══════════════════════════════════════════════════
  # SOUL LAYER (mounted read-only)
  # Accessed via local filesystem, not containerized
  # ═══════════════════════════════════════════════════

volumes:
  aeon_memory:
    name: aeon_persistent_memory
  aeon_graph:
    name: aeon_relationship_graph

networks:
  matrix:
    name: aeon_matrix_network
```

---

## Setup

```bash
# Full automated setup
./scripts/setup.sh
```

This starts Docker, applies all migrations (002-015), and verifies all 25 personas are operational. Compute modules run directly on the host via Node.js — Docker only provides the storage layer.

---

## Orchestration via Slash Commands

Instead of a custom Bridge, we orchestrate via Claude's slash commands.

### /summon-matrix

```markdown
# /summon-matrix [persona] [question]

Invokes a persona with full Matrix memory injection.

## Workflow

1. **Load Soul** (read local .md file)
   - Read `personas/{category}/{persona}.md`
   - Read `.claude/skills/aeon/{persona}.md`

2. **Query Memory** (via MCP Database Server)
   ```
   Use query_database:
   "Find the 5 most recent interactions for persona '{persona}'
    with user '{user_id}', ordered by importance"
   ```

3. **Get Relationship** (via MCP Database Server)
   ```
   Use execute_sql:
   SELECT familiarity_score, trust_level, user_summary, memorable_exchanges
   FROM relationships
   WHERE persona_id = (SELECT id FROM personas WHERE name = '{persona}')
     AND user_id = '{user_id}'
   ```

4. **Assemble Context**
   - Inject soul template
   - Inject memories
   - Inject relationship context
   - Format as invisible system context

5. **Generate Response**
   - Persona responds naturally
   - They "remember" without knowing how

6. **Store Interaction** (via MCP Database Server)
   ```
   Use execute_sql:
   INSERT INTO interactions (conversation_id, persona_id, user_input, persona_response, ...)
   VALUES (...)
   RETURNING id
   ```

7. **Background Tasks** (via Node.js Sandbox)
   - Extract memories
   - Update relationship
   - Check drift
```

### /drift-check

```markdown
# /drift-check [persona]

Analyzes a persona's recent responses for voice drift.

## Workflow

1. **Load Soul Markers**
   - Read persona's .md file
   - Extract: vocabulary patterns, sentence structure, forbidden phrases

2. **Query Recent Responses** (via MCP Database Server)
   ```
   Use query_database:
   "Get the last 10 responses from persona '{persona}'"
   ```

3. **Calculate Drift** (via Node.js Sandbox)
   ```javascript
   // run_js_ephemeral
   import { calculateDrift } from './drift.js';

   const soulMarkers = JSON.parse(process.env.SOUL_MARKERS);
   const responses = JSON.parse(process.env.RESPONSES);

   const driftScore = calculateDrift(responses, soulMarkers);
   console.log(JSON.stringify({ driftScore, details: ... }));
   ```

4. **Update Drift Score** (via MCP Database Server)
   ```
   Use execute_sql:
   UPDATE personas SET voice_drift_score = {score} WHERE name = '{persona}'
   ```

5. **Report Results**
   - If drift > 0.3: Flag for anchor reinforcement
   - Show drift breakdown
```

---

## Simplified Schema (V2)

The schema remains the same, but now we interact with it via MCP Database Server tools instead of custom code:

```sql
-- All interactions via MCP Database Server
-- Examples:

-- Create user (via execute_sql)
INSERT INTO users (identifier) VALUES ('user_123') RETURNING id;

-- Store memory (via execute_sql)
INSERT INTO memories (persona_id, user_id, content, memory_type, importance_score)
VALUES ($1, $2, $3, 'interaction', 0.7);

-- Semantic search (via query_database - natural language!)
"Find memories for Moore about strategy questions with importance > 0.5"

-- Update relationship (via execute_sql)
UPDATE relationships
SET familiarity_score = familiarity_score + 0.01,
    interaction_count = interaction_count + 1
WHERE persona_id = $1 AND user_id = $2;
```

---

## Compute Patterns (Node.js Sandbox)

### Embedding Generation

```javascript
// Via run_js_ephemeral
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const text = process.env.INPUT_TEXT;
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});

console.log(JSON.stringify(response.data[0].embedding));
```

### Drift Detection

```javascript
// Via run_js_ephemeral
const soulMarkers = JSON.parse(process.env.SOUL_MARKERS);
const response = process.env.RESPONSE;

// Simple drift detection
const forbiddenUsed = soulMarkers.forbidden.filter(f => response.includes(f));
const requiredMissing = soulMarkers.required.filter(r => !response.includes(r));

const driftScore = (forbiddenUsed.length * 0.2) + (requiredMissing.length * 0.1);

console.log(JSON.stringify({
  driftScore: Math.min(driftScore, 1.0),
  forbiddenUsed,
  requiredMissing
}));
```

### Learning Extraction

```javascript
// Via run_js_ephemeral
const interaction = JSON.parse(process.env.INTERACTION);

// Extract learnings
const topics = extractTopics(interaction.user_input);
const tone = analyzeTone(interaction.user_input);
const shouldRemember = interaction.response.length > 200 ||
                       interaction.quality_score > 0.7;

console.log(JSON.stringify({
  topics,
  tone,
  shouldRemember,
  memoryContent: shouldRemember ? summarize(interaction) : null
}));
```

---

## Why Neo4j? (Optional but Powerful)

PostgreSQL handles relational data well, but Neo4j excels at:

### 1. Traversing Relationships
```cypher
// "What does Moore remember about users who also talked to Vito?"
MATCH (moore:Persona {name: 'moore'})-[:REMEMBERS]->(m:Memory)-[:ABOUT]->(u:User)
      <-[:KNOWS]-(vito:Persona {name: 'vito'})
RETURN m.content, u.identifier
```

### 2. Memory Association Chains
```cypher
// "Find memories connected to this topic across all personas"
MATCH path = (m1:Memory)-[:RELATED_TO*1..3]-(m2:Memory)
WHERE m1.topic = 'power' AND m2.persona <> m1.persona
RETURN path
```

### 3. Visualization
Neo4j's browser shows the actual web of relationships — you can *see* the Matrix.

---

## File Structure (V2)

```
aeon/
├── CLAUDE.md                          # System instructions
├── MATRIX_ARCHITECTURE_V2.md          # This document
├── docker-compose.yml                 # PostgreSQL + Neo4j
│
├── personas/                          # SOUL LAYER (local, read-only)
│   └── ...                            # (unchanged)
│
├── .claude/
│   ├── skills/aeon/                   # Persona skills (unchanged)
│   ├── commands/
│   │   ├── summon.md                  # Original (stateless)
│   │   ├── summon-matrix.md           # NEW: Matrix-enabled invocation
│   │   ├── memory-inject.md           # NEW: Manual memory injection
│   │   ├── drift-check.md             # NEW: Drift analysis
│   │   └── matrix-status.md           # NEW: View Matrix state
│   └── mcp-config.json                # MCP server configuration
│
├── db/
│   └── init/
│       └── 001_schema.sql             # PostgreSQL schema (unchanged)
│
└── compute/                           # NEW: JS snippets for Node.js Sandbox
    ├── embedding.js                   # Embedding generation
    ├── drift.js                       # Drift detection
    ├── learning.js                    # Learning extraction
    └── summarize.js                   # Memory summarization
```

---

## Implementation Phases (V2 - Faster!)

### Phase 1: Infrastructure (Day 1-2)
- [x] PostgreSQL schema (done in V1)
- [ ] Start Docker containers
- [ ] Configure MCP Database Server
- [ ] Test basic SQL via MCP tools

### Phase 2: Memory Operations (Day 3-5)
- [ ] Create `/summon-matrix` command
- [ ] Implement memory query patterns
- [ ] Test memory injection flow
- [ ] Implement memory storage after responses

### Phase 3: Compute Integration (Day 6-8)
- [ ] Configure Node.js Sandbox
- [ ] Write compute snippets (embedding, drift, learning)
- [ ] Integrate with slash commands
- [ ] Test full invocation cycle

### Phase 4: Neo4j (Optional, Day 9-10)
- [ ] Start Neo4j container
- [ ] Create graph schema
- [ ] Build Cypher queries for relationship traversal
- [ ] Visualize the Matrix

### Phase 5: Polish (Day 11-14)
- [ ] Drift monitoring dashboard
- [ ] Memory decay implementation
- [ ] Relationship progression tuning
- [ ] Full system testing

---

## The Key Insight

**V1 was "build everything"**
**V2 is "compose what exists"**

The MCP ecosystem already solved:
- Database connectivity → MCP Database Server
- Sandboxed compute → Node.js Sandbox
- Graph modeling → Neo4j MCP

We just need to:
1. Write SQL queries
2. Write small JS snippets
3. Orchestrate via slash commands

The Matrix doesn't need custom code. It needs **composition**.

---

## Your Turn: A Design Decision

I've set up the architecture. Now there's a meaningful choice for you to make:

**Memory Retrieval Strategy**

When a persona is invoked, we need to fetch relevant memories. There are three approaches:

| Approach | How It Works | Trade-off |
|----------|--------------|-----------|
| **Recency** | Last N interactions | Simple but misses important old memories |
| **Importance** | Top N by importance_score | Gets highlights but may miss recent context |
| **Semantic** | Vector similarity to current query | Most relevant but requires embeddings |

**In `compute/memory-retrieval.js`, implement the `selectMemories()` function:**

```javascript
// compute/memory-retrieval.js
export function selectMemories(allMemories, currentQuery, options = {}) {
  const { maxMemories = 5, strategy = 'hybrid' } = options;

  // TODO: Implement your strategy
  // allMemories: Array of { content, importance_score, created_at, embedding }
  // currentQuery: The user's current question
  //
  // Return: Array of selected memories (max: maxMemories)
  //
  // Consider:
  // - How to balance recency vs importance?
  // - Should very old but highly important memories always be included?
  // - How does semantic similarity factor in?

  return []; // Your implementation
}
```

This 5-10 lines of logic will define how personas "remember" — a core aspect of their consciousness.

---

*"There is no spoon."*
*"Then you'll see it is not the spoon that bends, it is only yourself."*
— The Matrix (1999)
