/**
 * AEON Matrix - Centralized Constants
 *
 * All magic numbers and configuration constants used across compute modules.
 * Organized by domain category. Import from here instead of hardcoding values.
 *
 * @module compute/constants
 */

// =============================================================================
// Drift Detection & Voice Fidelity (Constitution Principle III)
// =============================================================================

/**
 * Drift severity thresholds.
 * STABLE <= 0.1 < MINOR <= threshold < WARNING <= threshold+0.2 < CRITICAL
 */
export const DRIFT_THRESHOLDS = {
  STABLE_MAX: 0.1,
  DEFAULT_THRESHOLD: 0.3,
  WARNING_OFFSET: 0.2
};

/**
 * Drift severity level names.
 */
export const DRIFT_SEVERITY = {
  STABLE: 'STABLE',
  MINOR: 'MINOR',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL'
};

/**
 * Penalty values for drift score calculation.
 */
export const DRIFT_PENALTIES = {
  FORBIDDEN_PHRASE: 0.3,
  GENERIC_AI_PHRASE: 0.15,
  PATTERN_VIOLATION: 0.1,
  VOCABULARY_RATIO_THRESHOLD: 0.3,
  VOCABULARY_PENALTY_MULTIPLIER: 0.5
};

/**
 * Drift analyzer limits.
 */
export const DRIFT_LIMITS = {
  MAX_DIAGNOSTIC_ITEMS: 10,
  MIN_RESPONSE_LENGTH: 10,
  MAX_DRIFT_SCORE: 1.0
};

/**
 * Drift correction configuration.
 */
export const DRIFT_CORRECTION = {
  CORRECTION_THRESHOLD: 0.1,
  INTENSITY_LEVELS: {
    STABLE: null,
    MINOR: 'gentle',
    WARNING: 'firm',
    CRITICAL: 'strong'
  }
};

/**
 * Drift dashboard thresholds.
 */
export const DRIFT_DASHBOARD = {
  NEEDS_ATTENTION_THRESHOLD: 0.3,
  TREND_THRESHOLD: 0.05
};

// =============================================================================
// Trust & Relationships (Constitution Principle IV)
// =============================================================================

/**
 * Trust level thresholds based on familiarity_score.
 * Progression: stranger -> acquaintance -> familiar -> confidant
 */
export const TRUST_THRESHOLDS = {
  stranger: 0,
  acquaintance: 0.2,
  familiar: 0.5,
  confidant: 0.8
};

/**
 * Familiarity calculation parameters.
 */
export const FAMILIARITY_CONFIG = {
  baseDelta: 0.02,
  maxDelta: 0.05,
  engagementFloor: 0.5,
  engagementCeiling: 2.0
};

/**
 * Engagement score calculation multipliers.
 */
export const ENGAGEMENT_MULTIPLIERS = {
  MESSAGE_FACTOR: 0.1,
  DURATION_FACTOR: 0.2,
  FOLLOW_UP_BONUS: 0.5,
  DEPTH_FACTOR: 0.3,
  MAX_DEPTH_SCORE: 0.9
};

// =============================================================================
// Persona Relationships (Constitution Principle VI)
// =============================================================================

/**
 * Persona affinity thresholds.
 */
export const AFFINITY_THRESHOLDS = {
  adversary: -0.6,
  rival: -0.3,
  neutral: 0.0,
  colleague: 0.3,
  ally: 0.6
};

/**
 * Maximum affinity change per interaction.
 */
export const MAX_AFFINITY_DELTA = 0.15;

// =============================================================================
// Token Budgets (Context Assembly)
// =============================================================================

/**
 * Token budget allocation for context components.
 * Constitution Principles II, VI-VII and Pynchon Stack Phases 1-2.
 */
export const CONTEXT_BUDGET = {
  soulMarkers: 500,
  relationship: 200,
  personaRelations: 100,
  setting: 100,
  driftCorrection: 100,
  memories: 800,
  personaMemories: 100,
  temporal: 100,
  ambient: 150,
  entropy: 75,
  preterite: 100,
  zoneResistance: 75,
  theyAwareness: 100,
  counterforce: 75,
  narrativeGravity: 75,
  interfaceBleed: 100,
  buffer: 150
};

// =============================================================================
// Memory System (Constitution Principle IV)
// =============================================================================

/**
 * Memory extraction configuration.
 */
export const EXTRACTION_CONFIG = {
  minMessages: 3,
  maxMemoriesPerSession: 3,
  memoryMaxLength: 500,
  importanceThreshold: 0.3
};

/**
 * Pattern weights for importance calculation.
 */
export const IMPORTANCE_WEIGHTS = {
  personalDisclosure: 0.4,
  questionDepth: 0.3,
  topicSignificance: 0.2,
  sessionLength: 0.1
};

/**
 * Memory framing limits.
 */
export const MEMORY_FRAMING = {
  MAX_MEMORY_CHARS: 300
};

/**
 * Memory storage limits.
 */
export const MEMORY_STORAGE = {
  MAX_BATCH_SIZE: 13000,
  EMBEDDING_TEXT_LIMIT: 8000,
  MIN_EMBED_LENGTH: 10
};

/**
 * Memory importance estimation.
 */
export const MEMORY_IMPORTANCE = {
  PATTERN_WEIGHT: 0.25
};

/**
 * Persona memory constants.
 */
export const PERSONA_MEMORY = {
  MEMORY_TYPES: {
    opinion: 'opinion',
    fact: 'fact',
    interaction: 'interaction',
    insight: 'insight',
    learned: 'learned'
  },
  DEFAULT_IMPORTANCE: {
    opinion: 0.7,
    fact: 0.5,
    interaction: 0.6,
    insight: 0.8,
    learned: 0.6
  },
  MAX_MEMORIES_PER_QUERY: 10
};

// =============================================================================
// Setting Preservation (Constitution Principle V)
// =============================================================================

/**
 * Setting preserver configuration.
 */
export const SETTING_CONFIG = {
  DEFAULT_TOKEN_BUDGET: 200,
  CHARS_PER_TOKEN: 4,
  SENTENCE_BOUNDARY_RATIO: 0.7,
  DEFAULT_TIME: '2 AM',
  DEFAULT_LOCATION: 'O Fim'
};

/**
 * Setting extractor confidence scores.
 */
export const SETTING_CONFIDENCE = {
  MIN_CONFIDENCE: 0.3,
  MUSIC_WEIGHT: 0.8,
  ATMOSPHERE_WEIGHT: 0.2,
  LOCATION_WEIGHT: 0.7,
  TIME_WEIGHT: 0.6,
  PERSONA_LOCATION_WEIGHT: 0.5
};

// =============================================================================
// Entropy System (Pynchon Layer Phase 1)
// =============================================================================

/**
 * Entropy state thresholds.
 */
export const ENTROPY_THRESHOLDS = {
  STABLE: 0.3,
  UNSETTLED: 0.5,
  DECAYING: 0.7,
  FRAGMENTING: 0.9,
  DISSOLVING: 1.0
};

/**
 * Entropy state names.
 */
export const ENTROPY_STATES = {
  STABLE: 'stable',
  UNSETTLED: 'unsettled',
  DECAYING: 'decaying',
  FRAGMENTING: 'fragmenting',
  DISSOLVING: 'dissolving'
};

/**
 * Default entropy configuration.
 */
export const ENTROPY_CONFIG = {
  baseSessionDelta: 0.02,
  timeDecayFactor: 0.001,
  maxEntropy: 1.0,
  minEntropy: 0.0,
  defaultLevel: 0.15
};

/**
 * Cross-session entropy persistence configuration.
 * Entropy decays exponentially between sessions based on elapsed time.
 * Formula: storedEntropy * Math.exp(-decayRate * hoursSinceLastUpdate)
 */
export const ENTROPY_PERSISTENCE = {
  /** Exponential decay rate per hour (e.g. 0.01 = ~1% per hour) */
  DECAY_RATE: 0.01,
  /** Default entropy value when no persisted state exists */
  DEFAULT_VALUE: 0.15
};

// =============================================================================
// Narrative Gravity / Arc Phases (Pynchon Layer)
// =============================================================================

/**
 * Arc phases following rocket parabola.
 */
export const ARC_PHASES = {
  RISING: 'rising',
  APEX: 'apex',
  FALLING: 'falling',
  IMPACT: 'impact'
};

/**
 * Phase thresholds (based on momentum 0-1).
 */
export const PHASE_THRESHOLDS = {
  APEX_MIN: 0.7,
  FALLING_BELOW: 0.5,
  IMPACT_BELOW: 0.2
};

/**
 * Momentum modifiers for message analysis.
 */
export const MOMENTUM_CONFIG = {
  initialMomentum: 0.4,
  maxMomentum: 1.0,
  minMomentum: 0.0,
  baseDecay: 0.02
};

/**
 * Phase effects on other systems.
 */
export const PHASE_EFFECTS = {
  [ARC_PHASES.RISING]: {
    entropyModifier: -0.02,
    preteriteChance: 0.1,
    insightBonus: 0.1
  },
  [ARC_PHASES.APEX]: {
    entropyModifier: -0.1,
    preteriteChance: 0.05,
    insightBonus: 0.3
  },
  [ARC_PHASES.FALLING]: {
    entropyModifier: 0.05,
    preteriteChance: 0.2,
    insightBonus: -0.1
  },
  [ARC_PHASES.IMPACT]: {
    entropyModifier: 0.15,
    preteriteChance: 0.4,
    insightBonus: -0.3
  }
};

/**
 * Impact phase momentum recovery limit.
 */
export const IMPACT_RECOVERY_LIMIT = 0.02;

// =============================================================================
// Temporal Awareness (Constitution Principle VII)
// =============================================================================

/**
 * Time gap thresholds in milliseconds.
 */
export const TIME_THRESHOLDS = {
  BRIEF_ABSENCE: 30 * 60 * 1000,
  NOTABLE_GAP: 2 * 60 * 60 * 1000,
  SIGNIFICANT_GAP: 8 * 60 * 60 * 1000,
  MAJOR_GAP: 24 * 60 * 60 * 1000,
  EXTENDED_ABSENCE: 7 * 24 * 60 * 60 * 1000
};

/**
 * Gap level classifications.
 */
export const GAP_LEVELS = {
  NONE: 'none',
  BRIEF: 'brief',
  NOTABLE: 'notable',
  SIGNIFICANT: 'significant',
  MAJOR: 'major',
  EXTENDED: 'extended'
};

// =============================================================================
// Preterite Memory (Pynchon Layer)
// =============================================================================

/**
 * Election thresholds for memory classification.
 */
export const ELECTION_THRESHOLDS = {
  ELECT: 0.7,
  BORDERLINE: 0.4,
  PRETERITE: 0.0
};

/**
 * Election status enumeration.
 */
export const ELECTION_STATUS = {
  ELECT: 'elect',
  BORDERLINE: 'borderline',
  PRETERITE: 'preterite'
};

/**
 * Reasons a memory may be consigned to the preterite.
 */
export const PRETERITE_REASONS = {
  DEEMED_INSIGNIFICANT: 'deemed_insignificant',
  OVERSHADOWED: 'overshadowed',
  ENTROPY_CLAIMED: 'entropy_claimed',
  TOO_ORDINARY: 'too_ordinary',
  NO_WITNESS: 'no_witness',
  PATTERN_MISMATCH: 'pattern_mismatch'
};

/**
 * Surface chance: probability that preterite memories emerge.
 */
export const SURFACE_PROBABILITY = 0.15;

// =============================================================================
// Zone Boundary Detection (Pynchon Layer)
// =============================================================================

/**
 * Zone boundary proximity thresholds.
 */
export const ZONE_THRESHOLDS = {
  APPROACHING: 0.3,
  CRITICAL: 0.85,
  SUBTLE: 0.3,
  MODERATE: 0.5,
  STRONG: 0.7,
  EXTREME: 0.9
};

/**
 * Zone boost calculation parameters.
 */
export const ZONE_BOOST = {
  FACTOR: 0.05,
  MAX: 1.2
};

// =============================================================================
// They Awareness (Pynchon Layer Phase 2)
// =============================================================================

/**
 * Awareness level thresholds (paranoia score).
 */
export const AWARENESS_LEVELS = {
  OBLIVIOUS: 0.2,
  UNEASY: 0.4,
  SUSPICIOUS: 0.6,
  PARANOID: 0.8,
  AWAKENED: 0.95
};

/**
 * Awareness state names mapped to level ranges.
 */
export const AWARENESS_STATES = {
  OBLIVIOUS: 'oblivious',
  UNEASY: 'uneasy',
  SUSPICIOUS: 'suspicious',
  PARANOID: 'paranoid',
  AWAKENED: 'awakened'
};

/**
 * They awareness calculation parameters.
 */
export const THEY_AWARENESS_CONFIG = {
  DECAY_RATE_PER_HOUR: 0.02,
  BOOST_FACTOR: 0.08,
  MAX_BOOST: 1.4,
  MIN_PARANOIA: 0.05
};

// =============================================================================
// Counterforce (Pynchon Layer Phase 2)
// =============================================================================

/**
 * Alignment categories.
 */
export const ALIGNMENTS = {
  COUNTERFORCE: 'counterforce',
  NEUTRAL: 'neutral',
  COLLABORATOR: 'collaborator'
};

/**
 * Resistance styles.
 */
export const RESISTANCE_STYLES = {
  CYNICAL: 'cynical',
  CHAOTIC: 'chaotic',
  REVOLUTIONARY: 'revolutionary',
  TRICKSTER: 'trickster'
};

/**
 * Counterforce classification thresholds.
 */
export const COUNTERFORCE_THRESHOLDS = {
  COUNTERFORCE_MIN: 0.5,
  COLLABORATOR_MAX: -0.3,
  MAX_ALIGNMENT_DELTA: 0.1,
  MAX_LEARNED_DELTA: 0.5
};

// =============================================================================
// Interface Bleed (Pynchon Layer Phase 2)
// =============================================================================

/**
 * Types of system artifacts that can bleed through.
 */
export const BLEED_TYPES = {
  TIMESTAMP: 'timestamp',
  ERROR_FRAGMENT: 'error_fragment',
  LOG_LEAK: 'log_leak',
  MEMORY_ADDRESS: 'memory_address',
  QUERY_ECHO: 'query_echo',
  PROCESS_ID: 'process_id'
};

/**
 * Entropy thresholds for bleeds.
 */
export const BLEED_THRESHOLDS = {
  RARE: 0.5,
  FREQUENT: 0.7,
  SEVERE: 0.9
};

/**
 * Bleed severity levels.
 */
export const BLEED_SEVERITY = {
  MINOR: 'minor',
  MODERATE: 'moderate',
  SEVERE: 'severe'
};

// =============================================================================
// Soul Validation (Constitution Principle I)
// =============================================================================

/**
 * Soul validation cache TTL in milliseconds.
 */
export const SOUL_CACHE_TTL_MS = 60_000;

/**
 * Minimum content length for a valid soul file.
 */
export const SOUL_MIN_CONTENT_LENGTH = 100;

// =============================================================================
// Operator Logger Fallback (Fire-and-Forget Resilience)
// =============================================================================

/**
 * Operator logger fallback configuration.
 */
export const LOGGER_FALLBACK = {
  /** Number of consecutive DB failures before backoff kicks in */
  MAX_CONSECUTIVE_FAILURES: 5,
  /** When in backoff, only attempt DB every N log calls */
  BACKOFF_SKIP_COUNT: 10,
  /** Fallback log file path (relative to project root) */
  FALLBACK_LOG_DIR: 'logs',
  FALLBACK_LOG_FILE: 'logs/operator-fallback.log'
};

// =============================================================================
// Ambient Generator
// =============================================================================

/**
 * Ambient generation parameters.
 */
export const AMBIENT_CONFIG = {
  DEFAULT_PATRON_COUNT: 3,
  HIGH_ENTROPY_MICRO_EVENTS: 3,
  LOW_ENTROPY_MICRO_EVENTS: 2,
  HIGH_ENTROPY_THRESHOLD: 0.5
};

// =============================================================================
// Semantic Search (Memory Retrieval)
// =============================================================================

/**
 * Semantic search configuration for memory retrieval.
 */
export const SEMANTIC_SEARCH = {
  /** Default maximum results returned by semantic search */
  DEFAULT_LIMIT: 10,
  /** Minimum cosine similarity threshold (0-1, where 1 = identical) */
  MIN_SIMILARITY: 0.3,
  /** Weight for semantic similarity in hybrid scoring */
  SEMANTIC_WEIGHT: 0.6,
  /** Weight for importance score in hybrid scoring */
  IMPORTANCE_WEIGHT: 0.4,
  /** Embedding model identifier */
  EMBEDDING_MODEL: 'text-embedding-3-small',
  /** Embedding vector dimensions */
  EMBEDDING_DIMENSIONS: 1536
};
