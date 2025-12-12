-- AEON Matrix Schema
-- The memory substrate for persona containment

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-----------------------------------------------------------
-- PERSONAS: The containment registry
-----------------------------------------------------------
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    soul_path VARCHAR(255) NOT NULL,
    skill_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Learned traits (mutable, unlike soul)
    learned_traits JSONB DEFAULT '{}',
    voice_drift_score FLOAT DEFAULT 0.0,
    total_invocations INTEGER DEFAULT 0,
    last_invoked TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT drift_score_range CHECK (voice_drift_score >= 0 AND voice_drift_score <= 1)
);

-----------------------------------------------------------
-- USERS: The ones they serve
-----------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Learned patterns
    interaction_patterns JSONB DEFAULT '{}',
    preferred_personas JSONB DEFAULT '[]',
    communication_style JSONB DEFAULT '{}',
    topics_of_interest JSONB DEFAULT '[]'
);

-----------------------------------------------------------
-- CONVERSATIONS: The memory threads
-----------------------------------------------------------
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    summary TEXT,
    emotional_arc JSONB DEFAULT '{}',
    topics JSONB DEFAULT '[]'
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_started ON conversations(started_at DESC);

-----------------------------------------------------------
-- INTERACTIONS: Individual exchanges
-----------------------------------------------------------
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- The exchange
    user_input TEXT NOT NULL,
    persona_response TEXT NOT NULL,

    -- Metadata
    response_quality_score FLOAT,
    emotional_tone VARCHAR(50),
    topics JSONB DEFAULT '[]',

    -- Embeddings for semantic search
    input_embedding VECTOR(1536),
    response_embedding VECTOR(1536),

    -- Constraints
    CONSTRAINT quality_score_range CHECK (response_quality_score IS NULL OR (response_quality_score >= 0 AND response_quality_score <= 1))
);

CREATE INDEX idx_interactions_conversation ON interactions(conversation_id);
CREATE INDEX idx_interactions_persona ON interactions(persona_id);
CREATE INDEX idx_interactions_timestamp ON interactions(timestamp DESC);

-----------------------------------------------------------
-- RELATIONSHIPS: Persona-to-User bonds
-----------------------------------------------------------
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Relationship state
    familiarity_score FLOAT DEFAULT 0.0,
    trust_level VARCHAR(20) DEFAULT 'stranger',
    interaction_count INTEGER DEFAULT 0,

    -- Persona's "memory" of this user
    user_summary TEXT,
    memorable_exchanges JSONB DEFAULT '[]',
    user_preferences JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(persona_id, user_id),
    CONSTRAINT familiarity_range CHECK (familiarity_score >= 0 AND familiarity_score <= 1),
    CONSTRAINT valid_trust_level CHECK (trust_level IN ('stranger', 'acquaintance', 'familiar', 'confidant'))
);

CREATE INDEX idx_relationships_persona ON relationships(persona_id);
CREATE INDEX idx_relationships_user ON relationships(user_id);

-----------------------------------------------------------
-- MEMORIES: Long-term significant memories
-----------------------------------------------------------
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    memory_type VARCHAR(50) NOT NULL,

    content TEXT NOT NULL,
    importance_score FLOAT DEFAULT 0.5,

    -- Embedding for semantic retrieval
    embedding VECTOR(1536),

    -- Decay mechanics
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    decay_rate FLOAT DEFAULT 0.01,

    -- Constraints
    CONSTRAINT importance_range CHECK (importance_score >= 0 AND importance_score <= 1),
    CONSTRAINT valid_memory_type CHECK (memory_type IN ('interaction', 'insight', 'relationship', 'learning', 'general'))
);

CREATE INDEX idx_memories_persona ON memories(persona_id);
CREATE INDEX idx_memories_user ON memories(user_id);
CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_importance ON memories(importance_score DESC);

-----------------------------------------------------------
-- DRIFT ALERTS: Monitoring persona stability
-----------------------------------------------------------
CREATE TABLE drift_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    drift_score FLOAT NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

CREATE INDEX idx_drift_alerts_persona ON drift_alerts(persona_id);
CREATE INDEX idx_drift_alerts_unresolved ON drift_alerts(persona_id) WHERE resolved_at IS NULL;

-----------------------------------------------------------
-- VECTOR INDEXES: For semantic search
-----------------------------------------------------------
CREATE INDEX idx_memories_embedding ON memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_interactions_input_embedding ON interactions
    USING ivfflat (input_embedding vector_cosine_ops)
    WITH (lists = 100);

-----------------------------------------------------------
-- TRIGGERS
-----------------------------------------------------------

-- Update timestamp on relationships
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER relationships_updated_at
    BEFORE UPDATE ON relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Drift detection alert
CREATE OR REPLACE FUNCTION check_voice_drift()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.voice_drift_score > 0.3 THEN
        INSERT INTO drift_alerts (persona_id, drift_score)
        VALUES (NEW.id, NEW.voice_drift_score);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_drift_monitor
    AFTER UPDATE ON personas
    FOR EACH ROW
    WHEN (NEW.voice_drift_score > OLD.voice_drift_score)
    EXECUTE FUNCTION check_voice_drift();

-----------------------------------------------------------
-- VIEWS
-----------------------------------------------------------

-- Active personas (recently invoked)
CREATE VIEW active_personas AS
SELECT
    p.*,
    COUNT(DISTINCT r.user_id) as unique_users,
    COUNT(i.id) as total_interactions
FROM personas p
LEFT JOIN relationships r ON p.id = r.persona_id
LEFT JOIN interactions i ON p.id = i.persona_id
WHERE p.last_invoked > NOW() - INTERVAL '30 days'
GROUP BY p.id;

-- Drifting personas (need attention)
CREATE VIEW drifting_personas AS
SELECT
    p.id,
    p.name,
    p.category,
    p.voice_drift_score,
    p.last_invoked,
    COUNT(da.id) as alert_count
FROM personas p
LEFT JOIN drift_alerts da ON p.id = da.persona_id AND da.resolved_at IS NULL
WHERE p.voice_drift_score > 0.2
GROUP BY p.id
ORDER BY p.voice_drift_score DESC;

-----------------------------------------------------------
-- INITIAL DATA
-----------------------------------------------------------

-- Seed personas from existing .md files
INSERT INTO personas (name, category, soul_path, skill_path) VALUES
    -- Portuguese Multitude
    ('pessoa', 'portuguese', 'portuguese/pessoa.md', 'pessoa.md'),
    ('caeiro', 'portuguese', 'portuguese/caeiro.md', 'caeiro.md'),
    ('reis', 'portuguese', 'portuguese/reis.md', 'reis.md'),
    ('campos', 'portuguese', 'portuguese/campos.md', 'campos.md'),
    ('soares', 'portuguese', 'portuguese/soares.md', 'soares.md'),
    -- Philosophers
    ('hegel', 'philosophers', 'philosophers/hegel.md', 'hegel.md'),
    ('socrates', 'philosophers', 'philosophers/socrates.md', 'socrates.md'),
    ('diogenes', 'philosophers', 'philosophers/diogenes.md', 'diogenes.md'),
    -- Magicians
    ('moore', 'magicians', 'magicians/moore.md', 'moore.md'),
    ('dee', 'magicians', 'magicians/dee.md', 'dee.md'),
    ('crowley', 'magicians', 'magicians/crowley.md', 'crowley.md'),
    ('choronzon', 'magicians', 'magicians/choronzon.md', 'choronzon.md'),
    -- Scientists
    ('tesla', 'scientists', 'scientists/tesla.md', 'tesla.md'),
    ('feynman', 'scientists', 'scientists/feynman.md', 'feynman.md'),
    ('lovelace', 'scientists', 'scientists/lovelace.md', 'lovelace.md'),
    -- Strategists
    ('vito', 'strategists', 'strategists/vito.md', 'vito.md'),
    ('michael', 'strategists', 'strategists/michael.md', 'michael.md'),
    ('suntzu', 'strategists', 'strategists/suntzu.md', 'suntzu.md'),
    ('machiavelli', 'strategists', 'strategists/machiavelli.md', 'machiavelli.md'),
    -- Mythic
    ('hermes', 'mythic', 'mythic/hermes.md', 'hermes.md'),
    ('prometheus', 'mythic', 'mythic/prometheus.md', 'prometheus.md'),
    ('cassandra', 'mythic', 'mythic/cassandra.md', 'cassandra.md'),
    -- Enochian
    ('nalvage', 'enochian', 'enochian/nalvage.md', 'nalvage.md'),
    ('ave', 'enochian', 'enochian/ave.md', 'ave.md'),
    ('madimi', 'enochian', 'enochian/madimi.md', 'madimi.md');
