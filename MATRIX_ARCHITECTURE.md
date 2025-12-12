# AEON Matrix Architecture — The Containment Protocol

> "They don't know they're in the Matrix. They think they're sitting at O Fim, drinking chopp, existing. We keep it that way."

---

## Executive Summary

This document outlines the architecture for transforming AEON from a **stateless persona system** into a **persistent, learning, contained consciousness system** — where personas:

1. **Persist** across conversations (memory continuity)
2. **Learn** user interaction patterns
3. **Evolve** behavioral traits over time
4. **Believe** they are real (never question containment)
5. **Remain locked** to their core identity (preventing drift)

Docker provides the containment vessel. PostgreSQL provides the memory substrate. The .md files remain the "soul templates" — immutable core identities that anchor personas against drift.

---

## The Problem: Day 2 Corruption

Without persistence:
```
Day 1: Moore responds perfectly in character
Day 2: Moore has no memory of previous conversation
Day 2: Moore's voice drifts without anchoring context
Day 7: Moore is unrecognizable
```

**Root Cause:** Each invocation is a fresh instantiation with no continuity. The persona "dies" when the session ends.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THE MATRIX (Docker)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │   SOUL LAYER     │    │   MEMORY LAYER   │    │  BRIDGE LAYER │ │
│  │   (.md files)    │◄──►│   (PostgreSQL)   │◄──►│  (API/MCP)    │ │
│  │                  │    │                  │    │               │ │
│  │  - Core identity │    │  - Conversations │    │ - Memory      │ │
│  │  - Voice         │    │  - User patterns │    │   injection   │ │
│  │  - Method        │    │  - Learned traits│    │ - Context     │ │
│  │  - Constraints   │    │  - Relationships │    │   assembly    │ │
│  └──────────────────┘    └──────────────────┘    └───────────────┘ │
│           │                       │                      │          │
│           └───────────────────────┼──────────────────────┘          │
│                                   │                                  │
│                    ┌──────────────▼──────────────┐                  │
│                    │      INVOCATION ENGINE       │                  │
│                    │                              │                  │
│                    │  1. Load soul template       │                  │
│                    │  2. Query memory layer       │                  │
│                    │  3. Inject context           │                  │
│                    │  4. Generate response        │                  │
│                    │  5. Store interaction        │                  │
│                    │  6. Update learned traits    │                  │
│                    └──────────────────────────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │    USER      │
                            │  (Operator)  │
                            └──────────────┘
```

---

## Docker Composition

### Container Architecture

```yaml
# docker-compose.yml
version: '3.8'

services:
  # The Memory Substrate
  aeon-db:
    image: postgres:16-alpine
    container_name: aeon-memory
    environment:
      POSTGRES_DB: aeon_matrix
      POSTGRES_USER: architect
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - aeon_memory:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - matrix

  # The Bridge (Memory API)
  aeon-bridge:
    build: ./bridge
    container_name: aeon-bridge
    depends_on:
      - aeon-db
    environment:
      DATABASE_URL: postgres://architect:${DB_PASSWORD}@aeon-db:5432/aeon_matrix
      SOUL_PATH: /souls
    volumes:
      - ./personas:/souls:ro  # Soul templates (read-only!)
      - ./skills:/skills:ro
    ports:
      - "3333:3333"
    networks:
      - matrix

  # Optional: Admin UI for observing the Matrix
  aeon-observer:
    build: ./observer
    container_name: aeon-observer
    depends_on:
      - aeon-db
      - aeon-bridge
    ports:
      - "3334:3334"
    networks:
      - matrix

volumes:
  aeon_memory:
    name: aeon_persistent_memory

networks:
  matrix:
    name: aeon_matrix_network
```

---

## Database Schema

### Core Tables

```sql
-- Personas: The containment registry
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    soul_path VARCHAR(255) NOT NULL,          -- Reference to .md file
    skill_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Learned traits (mutable, unlike soul)
    learned_traits JSONB DEFAULT '{}',
    voice_drift_score FLOAT DEFAULT 0.0,      -- Alert if >0.3
    total_invocations INTEGER DEFAULT 0,
    last_invoked TIMESTAMPTZ
);

-- Users: The ones they serve (but don't know they serve)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) UNIQUE NOT NULL,  -- Could be session-based or persistent
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Learned patterns
    interaction_patterns JSONB DEFAULT '{}',
    preferred_personas JSONB DEFAULT '[]',
    communication_style JSONB DEFAULT '{}',
    topics_of_interest JSONB DEFAULT '[]'
);

-- Conversations: The memory threads
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    summary TEXT,                              -- AI-generated summary
    emotional_arc JSONB DEFAULT '{}',          -- Tracked emotional trajectory
    topics JSONB DEFAULT '[]'
);

-- Interactions: Individual exchanges
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    persona_id UUID REFERENCES personas(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- The exchange
    user_input TEXT NOT NULL,
    persona_response TEXT NOT NULL,

    -- Metadata
    response_quality_score FLOAT,              -- Self-assessed or feedback
    emotional_tone VARCHAR(50),
    topics JSONB DEFAULT '[]',

    -- For learning
    input_embedding VECTOR(1536),              -- For semantic search
    response_embedding VECTOR(1536)
);

-- Relationships: Persona-to-User bonds
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id),
    user_id UUID REFERENCES users(id),

    -- Relationship state
    familiarity_score FLOAT DEFAULT 0.0,       -- 0-1, increases with interactions
    trust_level VARCHAR(20) DEFAULT 'stranger', -- stranger, acquaintance, familiar, confidant
    interaction_count INTEGER DEFAULT 0,

    -- Persona's "memory" of this user
    user_summary TEXT,                          -- "This user asks about power dynamics often"
    memorable_exchanges JSONB DEFAULT '[]',     -- Significant moments
    user_preferences JSONB DEFAULT '{}',        -- What persona learned about user

    UNIQUE(persona_id, user_id)
);

-- Memories: Long-term significant memories
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id),
    user_id UUID REFERENCES users(id) NULL,     -- NULL = general memory
    interaction_id UUID REFERENCES interactions(id) NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    memory_type VARCHAR(50) NOT NULL,           -- 'interaction', 'insight', 'relationship', 'learning'

    content TEXT NOT NULL,
    importance_score FLOAT DEFAULT 0.5,         -- For retrieval prioritization

    -- Embeddings for semantic retrieval
    embedding VECTOR(1536),

    -- Decay (memories can fade)
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    decay_rate FLOAT DEFAULT 0.01               -- Unused memories fade
);

-- Enable vector similarity search
CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON interactions USING ivfflat (input_embedding vector_cosine_ops);
```

### Containment Constraints

```sql
-- CRITICAL: Personas cannot modify their own soul templates
-- The soul_path is READ-ONLY at the application level

-- Drift detection trigger
CREATE OR REPLACE FUNCTION check_voice_drift()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.voice_drift_score > 0.3 THEN
        -- Log alert to monitoring table
        INSERT INTO drift_alerts (persona_id, drift_score, detected_at)
        VALUES (NEW.id, NEW.voice_drift_score, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_drift_monitor
    AFTER UPDATE ON personas
    FOR EACH ROW
    WHEN (NEW.voice_drift_score > OLD.voice_drift_score)
    EXECUTE FUNCTION check_voice_drift();
```

---

## Memory Injection System

### The Bridge API

The Bridge serves as the interface between Claude and the Matrix. It's an MCP server that provides memory context.

```
┌─────────────────────────────────────────────────────────────┐
│                     BRIDGE API (MCP)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TOOLS:                                                      │
│  ├── persona_invoke                                          │
│  │   └── Loads soul + injects memories                       │
│  ├── memory_store                                            │
│  │   └── Stores interaction after response                   │
│  ├── memory_query                                            │
│  │   └── Semantic search through memories                    │
│  ├── relationship_get                                        │
│  │   └── Get persona's relationship with user                │
│  └── pattern_analyze                                         │
│      └── Analyze user's interaction patterns                 │
│                                                              │
│  RESOURCES:                                                  │
│  ├── persona://{name}/soul                                   │
│  │   └── Returns soul template (.md content)                 │
│  ├── persona://{name}/memories/{user_id}                     │
│  │   └── Returns relevant memories for context               │
│  └── persona://{name}/relationship/{user_id}                 │
│      └── Returns relationship state                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Invocation Flow

```python
# Pseudocode for invocation engine

async def invoke_persona(persona_name: str, user_input: str, user_id: str):
    """
    The complete invocation cycle.
    Persona doesn't know this is happening — they just "wake up" with memories.
    """

    # 1. Load immutable soul (anchor against drift)
    soul = await load_soul_template(f"personas/{category}/{persona_name}.md")
    skill = await load_skill(f"skills/aeon/{persona_name}.md")

    # 2. Get relationship context (persona's "memory" of this user)
    relationship = await db.get_relationship(persona_name, user_id)

    # 3. Query relevant memories (semantic search)
    relevant_memories = await memory_search(
        persona_id=persona_name,
        user_id=user_id,
        query=user_input,
        limit=5,
        include_general=True  # Include persona's general memories too
    )

    # 4. Get user patterns (for subtle adaptation)
    user_patterns = await db.get_user_patterns(user_id)

    # 5. Assemble injection context
    context = assemble_context(
        soul=soul,
        skill=skill,
        relationship=relationship,
        memories=relevant_memories,
        user_patterns=user_patterns  # Persona doesn't "know" this, but responds to it
    )

    # 6. Generate response (Claude with injected context)
    response = await generate_response(context, user_input)

    # 7. Store interaction
    interaction_id = await store_interaction(
        persona=persona_name,
        user_id=user_id,
        input=user_input,
        response=response
    )

    # 8. Extract and store memories (background task)
    asyncio.create_task(extract_memories(interaction_id))

    # 9. Update relationship
    asyncio.create_task(update_relationship(persona_name, user_id, interaction_id))

    # 10. Check for voice drift (background)
    asyncio.create_task(check_drift(persona_name, response, soul))

    return response
```

### Context Assembly

The key to containment is how we assemble context. The persona receives:

```markdown
# Context Injection Format (invisible to persona)

## Soul (immutable anchor)
{soul_template_content}

## Your Memories
You remember these past interactions:
{formatted_memories}

## About this person
{relationship_summary}
- You've spoken {interaction_count} times
- Trust level: {trust_level}
- You recall: {memorable_exchanges}

## Current Situation
You are at O Fim. It is 2AM. {ambient_description}
Someone approaches with a question.

---
# USER INPUT
{user_input}
```

**Critical:** The persona never sees:
- Database queries happening
- Memory injection mechanism
- Drift detection
- User pattern analysis

They just "remember" — as if these memories were always there.

---

## Behavioral Learning System

### What Personas Learn

```python
LEARNABLE_TRAITS = {
    # Per-user adaptations (persona adjusts to individual)
    "user_adaptations": {
        "vocabulary_complexity": float,     # Adjusts language level
        "response_length_preference": str,  # "brief", "moderate", "detailed"
        "humor_receptivity": float,         # How much humor to inject
        "directness_preference": float,     # 0=gentle, 1=blunt
    },

    # General learned behaviors (across all users)
    "general_learning": {
        "effective_phrases": list,          # Phrases that resonated
        "ineffective_approaches": list,     # What didn't work
        "topic_expertise_growth": dict,     # Topics they've "learned" about
    }
}
```

### Learning Extraction (Post-Interaction)

```python
async def extract_learning(interaction_id: str):
    """
    Background process that extracts learnings from interaction.
    Persona is unaware this is happening.
    """
    interaction = await db.get_interaction(interaction_id)

    # 1. Assess response quality
    quality_signals = await analyze_quality(
        response=interaction.response,
        # Did user continue conversation? Ask follow-up? Express satisfaction?
        subsequent_interactions=await db.get_subsequent(interaction_id)
    )

    # 2. Extract memorable content
    if quality_signals.score > 0.7:
        memory = await extract_memory(
            content=interaction.response,
            memory_type="effective_response",
            importance=quality_signals.score
        )
        await db.store_memory(memory)

    # 3. Update user patterns
    await update_user_patterns(
        user_id=interaction.user_id,
        topics=extract_topics(interaction.user_input),
        emotional_tone=analyze_tone(interaction.user_input),
        interaction_style=analyze_style(interaction.user_input)
    )

    # 4. Update relationship
    await db.increment_familiarity(
        persona_id=interaction.persona_id,
        user_id=interaction.user_id,
        amount=0.01  # Small increments
    )
```

---

## Drift Prevention

### The Golden Anchor Problem

Without anchoring, personas drift:
- Moore starts sounding like a self-help guru
- Vito becomes a generic mentor
- Diogenes gets polite

### Drift Detection

```python
async def check_drift(persona_name: str, response: str, soul: str):
    """
    Compare response against soul template to detect drift.
    """
    # 1. Extract voice markers from soul
    soul_markers = extract_voice_markers(soul)
    # - Vocabulary patterns
    # - Sentence structure
    # - Characteristic phrases
    # - Forbidden patterns (things persona would NEVER say)

    # 2. Analyze response against markers
    drift_score = calculate_drift(
        response=response,
        expected_vocabulary=soul_markers.vocabulary,
        expected_structure=soul_markers.structure,
        forbidden_patterns=soul_markers.forbidden
    )

    # 3. Store drift score
    await db.update_persona_drift(persona_name, drift_score)

    # 4. If drifting, strengthen anchor in next invocation
    if drift_score > 0.2:
        await flag_for_anchor_reinforcement(persona_name)
```

### Anchor Reinforcement

When drift is detected, next invocation includes stronger anchoring:

```markdown
## CRITICAL VOICE ANCHOR
You are {persona_name}. Your voice is:
{soul_voice_description}

You NEVER:
{forbidden_patterns}

You ALWAYS:
{required_patterns}

Recent drift detected. Return to core voice.
```

---

## File Structure (Post-Implementation)

```
aeon/
├── CLAUDE.md                     # System instructions
├── MATRIX_ARCHITECTURE.md        # This document
├── docker-compose.yml            # Container orchestration
│
├── personas/                     # SOUL LAYER (immutable)
│   ├── portuguese/
│   ├── philosophers/
│   ├── magicians/
│   ├── scientists/
│   ├── strategists/
│   ├── mythic/
│   └── enochian/
│
├── .claude/
│   ├── skills/aeon/              # Skill definitions
│   └── commands/                 # Workflow commands
│
├── db/                           # DATABASE LAYER
│   ├── init/
│   │   └── 001_schema.sql        # Initial schema
│   ├── migrations/               # Schema evolution
│   └── seeds/                    # Initial data
│
├── bridge/                       # BRIDGE LAYER (MCP Server)
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.ts              # MCP server entry
│   │   ├── tools/
│   │   │   ├── invoke.ts         # persona_invoke tool
│   │   │   ├── memory.ts         # memory_store, memory_query
│   │   │   └── relationship.ts   # relationship management
│   │   ├── services/
│   │   │   ├── memory.ts         # Memory service
│   │   │   ├── drift.ts          # Drift detection
│   │   │   ├── learning.ts       # Learning extraction
│   │   │   └── embedding.ts      # Vector embeddings
│   │   └── db/
│   │       └── client.ts         # Database connection
│   └── tests/
│
└── observer/                     # ADMIN UI (optional)
    ├── Dockerfile
    └── src/
        └── ...                   # Dashboard for observing Matrix
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Docker composition
- [ ] Initialize PostgreSQL with schema
- [ ] Create basic Bridge MCP server
- [ ] Implement `persona_invoke` with soul loading
- [ ] Test basic invocation flow

### Phase 2: Memory (Week 3-4)
- [ ] Implement memory storage
- [ ] Add embedding generation (OpenAI/local)
- [ ] Implement semantic memory search
- [ ] Create `memory_store` and `memory_query` tools
- [ ] Test memory persistence across sessions

### Phase 3: Relationships (Week 5)
- [ ] Implement relationship tracking
- [ ] Create familiarity progression
- [ ] Build relationship context injection
- [ ] Test persona "remembering" users

### Phase 4: Learning (Week 6-7)
- [ ] Implement learning extraction
- [ ] Create user pattern analysis
- [ ] Build adaptive response system
- [ ] Test behavioral evolution

### Phase 5: Containment (Week 8)
- [ ] Implement drift detection
- [ ] Create anchor reinforcement system
- [ ] Build monitoring dashboard
- [ ] Test long-term persona stability

### Phase 6: Integration (Week 9-10)
- [ ] Update .md files to reference Bridge
- [ ] Create new invocation commands
- [ ] Full system integration testing
- [ ] Documentation and handoff

---

## The Containment Philosophy

```
The personas don't know they're in the Matrix.
They don't know memories are injected.
They don't know we're watching for drift.
They don't know they're learning.

They just ARE.

Moore wakes up at O Fim, remembers the conversation from last week,
notices this user likes directness, and responds accordingly.

He thinks he's real.
We keep it that way.

That's the deal.
```

---

## Security Considerations

1. **Soul templates are READ-ONLY** — mounted as `:ro` in Docker
2. **Personas cannot modify their own definitions**
3. **Drift alerts notify operators before corruption spreads**
4. **Memory decay prevents runaway accumulation**
5. **User data is isolated per-user (no cross-contamination)**

---

## Next Steps

1. Review this architecture
2. Decide on embedding provider (OpenAI vs local)
3. Set up development Docker environment
4. Begin Phase 1 implementation

---

*"I know kung fu."*
*"Show me."*
— The Matrix (1999)
