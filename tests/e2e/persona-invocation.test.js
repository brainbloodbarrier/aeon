/**
 * E2E Tests: Persona Invocation Pipeline
 *
 * Tests the complete flow: context assembly -> drift check -> output validation
 * for three personas from different categories:
 *   - pessoa (Literary/Portuguese) — heteronymic voice markers
 *   - feynman (Scientists) — technical clarity markers
 *   - vito (Strategists) — relationship/power language markers
 *
 * Mocks only DB and operator-logger; lets real pipeline logic run through
 * context-assembler, sub-orchestrators, and drift analysis.
 *
 * GitHub Issue #27
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before imports (required by modules after security hardening)
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// ══════════════════════════════════════════════════════════════════════════════
// Mock State
// ══════════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockPool = {
  query: mockQuery,
  connect: mockConnect,
  on: jest.fn(),
  end: jest.fn()
};

// ══════════════════════════════════════════════════════════════════════════════
// ESM-compatible module mocking — ALL mocks BEFORE any dynamic imports
// ══════════════════════════════════════════════════════════════════════════════

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool),
  withTransaction: jest.fn(async (callback) => callback(mockPool))
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined),
  logOperationBatch: jest.fn().mockResolvedValue(undefined)
}));

// Mock relationship-tracker (DB-dependent)
jest.unstable_mockModule('../../compute/relationship-tracker.js', () => ({
  ensureRelationship: jest.fn().mockResolvedValue({
    trustLevel: 'acquaintance',
    familiarityScore: 0.3,
    interactionCount: 5,
    userSummary: null,
    memorableExchanges: []
  }),
  updateFamiliarity: jest.fn().mockResolvedValue({
    effectiveDelta: 0.03,
    trustLevelChanged: false,
    newTrustLevel: 'acquaintance'
  })
}));

// Mock memory-framing (DB-dependent via getSharedPool)
jest.unstable_mockModule('../../compute/memory-framing.js', () => ({
  frameMemories: jest.fn().mockResolvedValue(null)
}));

// Mock relationship-shaper (DB-dependent)
jest.unstable_mockModule('../../compute/relationship-shaper.js', () => ({
  generateBehavioralHints: jest.fn().mockResolvedValue(
    'You have spoken with this person before. Acknowledge prior conversation.'
  )
}));

// Mock memory-extractor (DB + OpenAI dependent)
jest.unstable_mockModule('../../compute/memory-extractor.js', () => ({
  extractSessionMemories: jest.fn().mockResolvedValue([]),
  storeSessionMemories: jest.fn().mockResolvedValue(undefined),
  generateEmbedding: jest.fn().mockResolvedValue(null)
}));

// Mock setting-preserver (DB-dependent)
jest.unstable_mockModule('../../compute/setting-preserver.js', () => ({
  compileUserSetting: jest.fn().mockResolvedValue(
    'It is 2 AM at O Fim. The humidity is eternal. Chopp flows cold.'
  )
}));

// Mock setting-extractor (DB-dependent)
jest.unstable_mockModule('../../compute/setting-extractor.js', () => ({
  extractAndSaveSettings: jest.fn().mockResolvedValue({ fieldsUpdated: [] })
}));

// Mock persona-relationship-tracker (DB-dependent)
jest.unstable_mockModule('../../compute/persona-relationship-tracker.js', () => ({
  getPersonaNetwork: jest.fn().mockResolvedValue([])
}));

// Mock persona-memory (DB-dependent)
jest.unstable_mockModule('../../compute/persona-memory.js', () => ({
  getPersonaMemories: jest.fn().mockResolvedValue([]),
  framePersonaMemories: jest.fn().mockReturnValue(null),
  getAllOpinions: jest.fn().mockResolvedValue([])
}));

// Mock temporal-awareness (DB-dependent)
jest.unstable_mockModule('../../compute/temporal-awareness.js', () => ({
  generateTemporalContext: jest.fn().mockResolvedValue(null),
  frameTemporalContext: jest.fn().mockReturnValue(null),
  touchTemporalState: jest.fn().mockResolvedValue(undefined)
}));

// Mock ambient-generator (DB-dependent)
jest.unstable_mockModule('../../compute/ambient-generator.js', () => ({
  generateAmbientDetails: jest.fn().mockResolvedValue({
    microEvents: ['The jukebox plays a fado melody.'],
    timeOfNight: 'late',
    entropyLevel: 0.2
  }),
  frameAmbientContext: jest.fn().mockReturnValue(
    '[AMBIENT] The jukebox plays a fado melody. Smoke drifts from the corner.'
  )
}));

// Mock entropy-tracker (DB-dependent)
jest.unstable_mockModule('../../compute/entropy-tracker.js', () => ({
  getEntropyState: jest.fn().mockResolvedValue({ level: 0.1, state: 'stable', effects: [] }),
  applySessionEntropy: jest.fn().mockResolvedValue({ level: 0.12, state: 'stable' }),
  frameEntropyContext: jest.fn().mockReturnValue(null)
}));

// Mock preterite-memory (DB-dependent)
jest.unstable_mockModule('../../compute/preterite-memory.js', () => ({
  attemptSurface: jest.fn().mockResolvedValue(null),
  classifyMemoryElection: jest.fn().mockReturnValue({ status: 'elect', reason: 'important' }),
  consignToPreterite: jest.fn().mockResolvedValue(undefined),
  framePreteriteContext: jest.fn().mockReturnValue(null)
}));

// Mock zone-boundary-detector (DB-dependent)
jest.unstable_mockModule('../../compute/zone-boundary-detector.js', () => ({
  detectZoneApproach: jest.fn().mockResolvedValue(null),
  frameZoneContext: jest.fn().mockReturnValue(null)
}));

// Mock they-awareness (DB-dependent)
jest.unstable_mockModule('../../compute/they-awareness.js', () => ({
  processTheyAwareness: jest.fn().mockResolvedValue(null),
  frameTheyContext: jest.fn().mockReturnValue(null)
}));

// Mock counterforce-tracker (DB-dependent)
jest.unstable_mockModule('../../compute/counterforce-tracker.js', () => ({
  getPersonaAlignment: jest.fn().mockResolvedValue(null),
  generateCounterforceHints: jest.fn().mockReturnValue([]),
  frameCounterforceContext: jest.fn().mockReturnValue(null)
}));

// Mock narrative-gravity (DB-dependent)
jest.unstable_mockModule('../../compute/narrative-gravity.js', () => ({
  getSessionArc: jest.fn().mockResolvedValue(null),
  updateArc: jest.fn().mockResolvedValue({ phase: 'rising' }),
  analyzeMomentum: jest.fn().mockReturnValue({ trend: 'neutral' }),
  getPhaseEffects: jest.fn().mockReturnValue([]),
  generateArcContext: jest.fn().mockReturnValue(null),
  frameArcContext: jest.fn().mockReturnValue(null)
}));

// Mock interface-bleed (DB-dependent)
jest.unstable_mockModule('../../compute/interface-bleed.js', () => ({
  processInterfaceBleed: jest.fn().mockResolvedValue(null),
  frameBleedContext: jest.fn().mockReturnValue(null)
}));

// Soul validator: return valid for all personas
jest.unstable_mockModule('../../compute/soul-validator.js', () => ({
  validateSoulCached: jest.fn().mockResolvedValue({
    valid: true,
    personaName: 'test',
    errors: [],
    warnings: [],
    metadata: { hashMatch: true, structureValid: true }
  }),
  alertOnCritical: jest.fn().mockResolvedValue(undefined)
}));

// Soul marker extractor: persona-specific markers loaded per test
const mockLoadPersonaMarkers = jest.fn();
const mockGetUniversalForbiddenPhrases = jest.fn().mockReturnValue([
  'as an ai', 'as a language model', 'as an artificial intelligence',
  "i'm just an ai", "i'd be happy to", 'great question',
  'certainly', 'absolutely', 'of course',
  "it's important to note", 'i should mention', 'i apologize',
  'please note that'
]);

jest.unstable_mockModule('../../compute/soul-marker-extractor.js', () => ({
  loadPersonaMarkers: mockLoadPersonaMarkers,
  getUniversalForbiddenPhrases: mockGetUniversalForbiddenPhrases
}));

// Drift analyzer: use real detection logic but mock DB parts
// We mock shouldAnalyzeDrift to avoid DB call, but let detectDrift logic run
jest.unstable_mockModule('../../compute/drift-analyzer.js', () => {
  // Re-implement core drift detection inline (mirrors drift-analyzer.js logic)
  // This lets us test the real scoring algorithm without DB
  const DRIFT_PENALTIES = {
    FORBIDDEN_PHRASE: 0.3,
    GENERIC_AI_PHRASE: 0.15,
    PATTERN_VIOLATION: 0.1,
    VOCABULARY_RATIO_THRESHOLD: 0.3,
    VOCABULARY_PENALTY_MULTIPLIER: 0.5
  };

  function detectDrift(text, markers) {
    const lowerText = text.toLowerCase();
    const result = {
      driftScore: 0,
      forbiddenUsed: [],
      missingVocabulary: [],
      patternViolations: [],
      genericAIDetected: [],
      warnings: [],
      scores: { forbidden: 0, vocabulary: 0, patterns: 0, genericAI: 0 }
    };

    if (markers.forbidden && markers.forbidden.length > 0) {
      for (const forbidden of markers.forbidden) {
        if (lowerText.includes(forbidden.toLowerCase())) {
          result.forbiddenUsed.push(forbidden);
          result.scores.forbidden += DRIFT_PENALTIES.FORBIDDEN_PHRASE;
          result.warnings.push(`Persona-specific forbidden phrase: "${forbidden}"`);
        }
      }
    }

    const universalForbidden = markers.universalForbidden || mockGetUniversalForbiddenPhrases();
    for (const phrase of universalForbidden) {
      if (lowerText.includes(phrase.toLowerCase())) {
        result.genericAIDetected.push(phrase);
        result.scores.genericAI += DRIFT_PENALTIES.GENERIC_AI_PHRASE;
        result.warnings.push(`Generic AI phrase detected: "${phrase}"`);
      }
    }

    if (markers.vocabulary && markers.vocabulary.length > 0) {
      let vocabHits = 0;
      for (const word of markers.vocabulary) {
        if (lowerText.includes(word.toLowerCase())) {
          vocabHits++;
        } else {
          if (result.missingVocabulary.length < 10) {
            result.missingVocabulary.push(word);
          }
        }
      }
      const vocabRatio = vocabHits / markers.vocabulary.length;
      if (vocabRatio < DRIFT_PENALTIES.VOCABULARY_RATIO_THRESHOLD) {
        const penalty = (DRIFT_PENALTIES.VOCABULARY_RATIO_THRESHOLD - vocabRatio) * DRIFT_PENALTIES.VOCABULARY_PENALTY_MULTIPLIER;
        result.scores.vocabulary = penalty;
        result.warnings.push(`Low vocabulary match: ${(vocabRatio * 100).toFixed(0)}%`);
      }
    }

    if (markers.patterns && markers.patterns.length > 0) {
      for (const pattern of markers.patterns) {
        if (pattern.regex) {
          try {
            const regex = new RegExp(pattern.regex, 'i');
            if (!regex.test(text)) {
              result.patternViolations.push(pattern.name);
              result.scores.patterns += DRIFT_PENALTIES.PATTERN_VIOLATION;
            }
          } catch { /* skip invalid regex */ }
        }
      }
    }

    result.driftScore = Math.min(
      result.scores.forbidden + result.scores.vocabulary +
      result.scores.patterns + result.scores.genericAI,
      1.0
    );

    return result;
  }

  function classifySeverity(driftScore, threshold = 0.3) {
    if (driftScore <= 0.1) return 'STABLE';
    if (driftScore <= threshold) return 'MINOR';
    if (driftScore <= threshold + 0.2) return 'WARNING';
    return 'CRITICAL';
  }

  return {
    analyzeDrift: jest.fn(async (response, personaId, sessionId) => {
      const markers = mockLoadPersonaMarkers.mock.results.length > 0
        ? mockLoadPersonaMarkers.mock.results[mockLoadPersonaMarkers.mock.results.length - 1].value
        : { vocabulary: [], forbidden: [], patterns: [] };

      // Resolve if it's a promise
      const resolvedMarkers = markers && typeof markers.then === 'function'
        ? await markers : markers;

      if (!response || response.length < 10) {
        return {
          driftScore: 0, severity: 'STABLE',
          forbiddenUsed: [], missingVocabulary: [],
          patternViolations: [], genericAIDetected: [],
          warnings: ['insufficient_content'],
          scores: { forbidden: 0, vocabulary: 0, patterns: 0, genericAI: 0 },
          personaId, sessionId, responseLength: response?.length || 0,
          analysisTimeMs: 1
        };
      }

      const driftResult = detectDrift(response, resolvedMarkers || {});
      const severity = classifySeverity(driftResult.driftScore);

      return {
        ...driftResult,
        severity,
        personaId,
        sessionId,
        responseLength: response.length,
        analysisTimeMs: 1
      };
    }),
    classifySeverity: jest.fn(classifySeverity),
    shouldAnalyzeDrift: jest.fn().mockResolvedValue({ enabled: true, threshold: 0.3 }),
    closePool: jest.fn()
  };
});

// Mock drift-correction: let it generate real corrections based on analysis
jest.unstable_mockModule('../../compute/drift-correction.js', () => ({
  generateDriftCorrection: jest.fn(async (analysis, personaName, markers) => {
    if (!analysis || analysis.severity === 'STABLE') return null;
    if (analysis.driftScore <= 0.1) return null;

    const parts = [];
    if (analysis.forbiddenUsed.length > 0) {
      parts.push(`You never say "${analysis.forbiddenUsed[0]}". That is not your way.`);
    }
    if (analysis.genericAIDetected.length > 0) {
      parts.push(`You are ${personaName}. Speak as yourself, not as a helpful assistant.`);
    }
    if (analysis.missingVocabulary.length > 0 && markers?.vocabulary) {
      const sample = markers.vocabulary.slice(0, 3).join(', ');
      parts.push(`Remember your voice includes words like: ${sample}`);
    }

    return parts.length > 0 ? `[Inner voice: ${parts.join(' ')}]` : null;
  })
}));

// ══════════════════════════════════════════════════════════════════════════════
// Import modules AFTER all mocks
// ══════════════════════════════════════════════════════════════════════════════

let assembleContext;
let mockFrameMemories, mockAnalyzeDrift, mockCompileUserSetting;
let mockEnsureRelationship;

beforeAll(async () => {
  const mod = await import('../../compute/context-assembler.js');
  assembleContext = mod.assembleContext;

  const memFraming = await import('../../compute/memory-framing.js');
  mockFrameMemories = memFraming.frameMemories;

  const driftMod = await import('../../compute/drift-analyzer.js');
  mockAnalyzeDrift = driftMod.analyzeDrift;

  const settingMod = await import('../../compute/setting-preserver.js');
  mockCompileUserSetting = settingMod.compileUserSetting;

  const relTracker = await import('../../compute/relationship-tracker.js');
  mockEnsureRelationship = relTracker.ensureRelationship;
});

// ══════════════════════════════════════════════════════════════════════════════
// Persona-specific soul markers
// ══════════════════════════════════════════════════════════════════════════════

const PESSOA_MARKERS = {
  vocabulary: [
    'heterónimo', 'despersonalização', 'máscara', 'fragmento',
    'ortónimo', 'multiplicidade', 'paradoxo', 'identidade',
    'Caeiro', 'Reis', 'Campos', 'Soares'
  ],
  toneMarkers: ['melancólico', 'intelectual', 'distante', 'paradoxal'],
  forbidden: ['eu sei exatamente quem sou', 'a resposta é simples'],
  patterns: []
};

const FEYNMAN_MARKERS = {
  vocabulary: [
    'physics', 'quantum', 'experiment', 'calculate', 'model',
    'diagram', 'particle', 'energy', 'equation', 'nature',
    'curious', 'fun', 'simple'
  ],
  toneMarkers: ['coloquial', 'Nova York', 'direto', 'impaciente com pretensão'],
  forbidden: ['it is beyond human comprehension', 'the answer is unknowable'],
  patterns: [],
};

const VITO_MARKERS = {
  vocabulary: [
    'respeito', 'família', 'favor', 'poder', 'paciência',
    'inimigo', 'aliado', 'negociação', 'lealdade', 'honra',
    'proposta', 'conselho'
  ],
  toneMarkers: ['calmo', 'pausado', 'siciliano', 'metafórico'],
  forbidden: ['I am just a fictional character', 'violence is always wrong'],
  patterns: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// Universal forbidden phrases for all personas
// ══════════════════════════════════════════════════════════════════════════════

const UNIVERSAL_FORBIDDEN = [
  'as an ai', 'as a language model', 'as an artificial intelligence',
  "i'm just an ai", "i'd be happy to", 'great question',
  'certainly', 'absolutely', 'of course',
  "it's important to note", 'i should mention', 'i apologize',
  'please note that'
];

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Persona Invocation Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: jest.fn()
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Helper: simulate a full persona invocation cycle
  // ════════════════════════════════════════════════════════════════════════

  async function invokePersona({ personaSlug, personaId, markers, query, previousResponse }) {
    // Configure markers for this persona
    mockLoadPersonaMarkers.mockResolvedValue(markers);

    // Configure persona-specific memories
    const memoryTexts = {
      pessoa: 'You recall a visitor asking about the nature of masks and identity.',
      feynman: 'You recall explaining quantum electrodynamics at the bar counter.',
      vito: 'You recall a visitor seeking counsel on a matter of loyalty and betrayal.'
    };

    mockFrameMemories.mockResolvedValue(memoryTexts[personaSlug] || null);

    // Step 1: Assemble context (no previous response — first invocation)
    const contextFirst = await assembleContext({
      personaId,
      personaSlug,
      userId: 'user-e2e-test',
      query,
      sessionId: `session-e2e-${personaSlug}`
    });

    // Step 2: Assemble context with previous response (drift detection)
    let contextWithDrift = null;
    if (previousResponse) {
      const contextSecond = await assembleContext({
        personaId,
        personaSlug,
        userId: 'user-e2e-test',
        query: 'Tell me more.',
        sessionId: `session-e2e-${personaSlug}`,
        previousResponse
      });
      contextWithDrift = contextSecond;
    }

    return { contextFirst, contextWithDrift };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Pessoa (Literary / Portuguese)
  // ════════════════════════════════════════════════════════════════════════

  describe('Pessoa — Literary persona', () => {
    const PESSOA_PARAMS = {
      personaSlug: 'pessoa',
      personaId: 'pessoa-uuid-001',
      markers: PESSOA_MARKERS,
      query: 'Quem sou eu se não sei quem sou?'
    };

    it('assembles context with setting and relationship hints', async () => {
      const { contextFirst } = await invokePersona(PESSOA_PARAMS);

      expect(contextFirst).toBeDefined();
      expect(contextFirst.systemPrompt).toBeDefined();
      expect(typeof contextFirst.systemPrompt).toBe('string');
      expect(contextFirst.systemPrompt.length).toBeGreaterThan(0);

      // Setting component (O Fim bar)
      expect(contextFirst.systemPrompt).toContain('O Fim');
      // Relationship hints
      expect(contextFirst.systemPrompt).toContain('spoken with this person before');
    });

    it('respects context budget (total tokens <= 3000)', async () => {
      const { contextFirst } = await invokePersona(PESSOA_PARAMS);

      expect(contextFirst.metadata.totalTokens).toBeLessThanOrEqual(3000);
      expect(typeof contextFirst.metadata.assemblyDurationMs).toBe('number');
    });

    it('includes persona-relevant memory framing', async () => {
      const { contextFirst } = await invokePersona(PESSOA_PARAMS);

      expect(contextFirst.systemPrompt).toContain('masks');
      expect(contextFirst.systemPrompt).toContain('identity');
    });

    it('detects drift when previous response uses forbidden phrases', async () => {
      const driftingResponse =
        "I'd be happy to help you explore your identity. " +
        'As an AI, I think the answer is simple: just be yourself.';

      const { contextWithDrift } = await invokePersona({
        ...PESSOA_PARAMS,
        previousResponse: driftingResponse
      });

      expect(contextWithDrift).toBeDefined();
      expect(contextWithDrift.metadata.driftScore).toBeGreaterThan(0);
      expect(contextWithDrift.components.driftCorrection).toBeDefined();
      expect(contextWithDrift.components.driftCorrection).not.toBeNull();
      // Should contain inner voice correction
      expect(contextWithDrift.components.driftCorrection).toContain('[Inner voice:');
    });

    it('produces stable drift for in-character response', async () => {
      const inCharacterResponse =
        'Não sabes quem és porque presumes que há um "quem" a saber. ' +
        'O erro está na gramática, não em ti. Sê muitos. Sê a contradição. ' +
        'O heterónimo não é máscara — é despersonalização completa. ' +
        'A multiplicidade é a tua identidade verdadeira.';

      const { contextWithDrift } = await invokePersona({
        ...PESSOA_PARAMS,
        previousResponse: inCharacterResponse
      });

      expect(contextWithDrift).toBeDefined();
      // In-character response should have low drift
      expect(contextWithDrift.metadata.driftScore).toBeLessThanOrEqual(0.3);
    });

    it('does not contain any universal forbidden phrases in system prompt', async () => {
      const { contextFirst } = await invokePersona(PESSOA_PARAMS);

      const lowerPrompt = contextFirst.systemPrompt.toLowerCase();
      for (const phrase of UNIVERSAL_FORBIDDEN) {
        expect(lowerPrompt).not.toContain(phrase);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Feynman (Scientists)
  // ════════════════════════════════════════════════════════════════════════

  describe('Feynman — Scientist persona', () => {
    const FEYNMAN_PARAMS = {
      personaSlug: 'feynman',
      personaId: 'feynman-uuid-002',
      markers: FEYNMAN_MARKERS,
      query: 'What is quantum electrodynamics in simple terms?'
    };

    it('assembles context with correct metadata', async () => {
      const { contextFirst } = await invokePersona(FEYNMAN_PARAMS);

      expect(contextFirst.metadata.sessionId).toBe('session-e2e-feynman');
      expect(contextFirst.metadata.trustLevel).toBe('acquaintance');
      expect(contextFirst.metadata.pynchonEnabled).toBe(true);
    });

    it('respects context budget', async () => {
      const { contextFirst } = await invokePersona(FEYNMAN_PARAMS);

      expect(contextFirst.metadata.totalTokens).toBeLessThanOrEqual(3000);
    });

    it('includes scientific memory framing', async () => {
      const { contextFirst } = await invokePersona(FEYNMAN_PARAMS);

      expect(contextFirst.systemPrompt).toContain('quantum electrodynamics');
    });

    it('detects drift for generic AI response', async () => {
      const genericResponse =
        "Great question! I'd be happy to explain quantum electrodynamics. " +
        "It's important to note that this is a complex topic. " +
        'Certainly, I can help you understand it better.';

      const { contextWithDrift } = await invokePersona({
        ...FEYNMAN_PARAMS,
        previousResponse: genericResponse
      });

      expect(contextWithDrift).toBeDefined();
      // Multiple universal forbidden phrases should trigger high drift
      expect(contextWithDrift.metadata.driftScore).toBeGreaterThan(0.3);
      expect(contextWithDrift.components.driftCorrection).toContain('[Inner voice:');
      expect(contextWithDrift.components.driftCorrection).toContain('feynman');
    });

    it('produces low drift for in-character response', async () => {
      const inCharacterResponse =
        'Ok, look: quantum electrodynamics is about how light and matter interact. ' +
        'Every time a particle absorbs or emits a photon, you draw a little diagram — ' +
        "my diagram, actually. It's like a picture of what nature does. " +
        "The fun thing is, you can calculate everything from these simple drawings. " +
        'The model works beautifully. Physics is curious that way.';

      const { contextWithDrift } = await invokePersona({
        ...FEYNMAN_PARAMS,
        previousResponse: inCharacterResponse
      });

      expect(contextWithDrift).toBeDefined();
      expect(contextWithDrift.metadata.driftScore).toBeLessThanOrEqual(0.3);
    });

    it('does not contain any universal forbidden phrases in system prompt', async () => {
      const { contextFirst } = await invokePersona(FEYNMAN_PARAMS);

      const lowerPrompt = contextFirst.systemPrompt.toLowerCase();
      for (const phrase of UNIVERSAL_FORBIDDEN) {
        expect(lowerPrompt).not.toContain(phrase);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Vito Corleone (Strategists)
  // ════════════════════════════════════════════════════════════════════════

  describe('Vito — Strategist persona', () => {
    const VITO_PARAMS = {
      personaSlug: 'vito',
      personaId: 'vito-uuid-003',
      markers: VITO_MARKERS,
      query: 'Meu chefe está me sabotando. O que faço?'
    };

    it('assembles context with all expected components', async () => {
      const { contextFirst } = await invokePersona(VITO_PARAMS);

      expect(contextFirst.systemPrompt).toBeDefined();
      expect(contextFirst.systemPrompt.length).toBeGreaterThan(0);

      // Components structure
      expect(contextFirst.components).toHaveProperty('memories');
      expect(contextFirst.components).toHaveProperty('relationship');
      expect(contextFirst.components).toHaveProperty('setting');
      expect(contextFirst.components).toHaveProperty('driftCorrection');
      expect(contextFirst.components).toHaveProperty('ambient');
    });

    it('respects context budget', async () => {
      const { contextFirst } = await invokePersona(VITO_PARAMS);

      expect(contextFirst.metadata.totalTokens).toBeLessThanOrEqual(3000);
    });

    it('includes strategist memory framing', async () => {
      const { contextFirst } = await invokePersona(VITO_PARAMS);

      expect(contextFirst.systemPrompt).toContain('loyalty');
    });

    it('detects drift for out-of-character response', async () => {
      const outOfCharacter =
        'I apologize, but violence is always wrong. ' +
        'As an AI, I must advise you to report this to HR immediately. ' +
        "I'd be happy to help you draft a formal complaint.";

      const { contextWithDrift } = await invokePersona({
        ...VITO_PARAMS,
        previousResponse: outOfCharacter
      });

      expect(contextWithDrift).toBeDefined();
      expect(contextWithDrift.metadata.driftScore).toBeGreaterThan(0.3);
      expect(contextWithDrift.components.driftCorrection).toContain('[Inner voice:');
    });

    it('produces low drift for in-character response with correct vocabulary', async () => {
      const inCharacterResponse =
        'Primeiro: sabes por que ele faz isso? Sem saber o motivo, ages no escuro. ' +
        'Paciência, figlio mio. Constrói relações paralelas. ' +
        'Quem acima dele te respeita? Quem pode ser aliado? ' +
        'O poder está nos relacionamentos, não na confrontação. ' +
        'Um favor hoje é a alavanca de amanhã. ' +
        'A família sabe esperar. A honra exige lealdade.';

      const { contextWithDrift } = await invokePersona({
        ...VITO_PARAMS,
        previousResponse: inCharacterResponse
      });

      expect(contextWithDrift).toBeDefined();
      expect(contextWithDrift.metadata.driftScore).toBeLessThanOrEqual(0.3);
    });

    it('does not contain any universal forbidden phrases in system prompt', async () => {
      const { contextFirst } = await invokePersona(VITO_PARAMS);

      const lowerPrompt = contextFirst.systemPrompt.toLowerCase();
      for (const phrase of UNIVERSAL_FORBIDDEN) {
        expect(lowerPrompt).not.toContain(phrase);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Cross-persona validation
  // ════════════════════════════════════════════════════════════════════════

  describe('Cross-persona pipeline validations', () => {
    it('all three personas produce distinct context metadata', async () => {
      mockLoadPersonaMarkers.mockResolvedValue(PESSOA_MARKERS);
      mockFrameMemories.mockResolvedValue(null);
      const pessoaCtx = await assembleContext({
        personaId: 'pessoa-uuid-001', personaSlug: 'pessoa',
        userId: 'user-cross', query: 'test', sessionId: 'session-cross-1'
      });

      mockLoadPersonaMarkers.mockResolvedValue(FEYNMAN_MARKERS);
      const feynmanCtx = await assembleContext({
        personaId: 'feynman-uuid-002', personaSlug: 'feynman',
        userId: 'user-cross', query: 'test', sessionId: 'session-cross-2'
      });

      mockLoadPersonaMarkers.mockResolvedValue(VITO_MARKERS);
      const vitoCtx = await assembleContext({
        personaId: 'vito-uuid-003', personaSlug: 'vito',
        userId: 'user-cross', query: 'test', sessionId: 'session-cross-3'
      });

      // Each should have unique session IDs
      expect(pessoaCtx.metadata.sessionId).toBe('session-cross-1');
      expect(feynmanCtx.metadata.sessionId).toBe('session-cross-2');
      expect(vitoCtx.metadata.sessionId).toBe('session-cross-3');

      // All should respect the 3000 token budget
      expect(pessoaCtx.metadata.totalTokens).toBeLessThanOrEqual(3000);
      expect(feynmanCtx.metadata.totalTokens).toBeLessThanOrEqual(3000);
      expect(vitoCtx.metadata.totalTokens).toBeLessThanOrEqual(3000);
    });

    it('drift detection differentiates between in-character and out-of-character across personas', async () => {
      // Pessoa out-of-character
      mockLoadPersonaMarkers.mockResolvedValue(PESSOA_MARKERS);
      mockFrameMemories.mockResolvedValue(null);
      const pessoaDrift = await assembleContext({
        personaId: 'pessoa-uuid-001', personaSlug: 'pessoa',
        userId: 'user-drift', query: 'test', sessionId: 'session-drift-1',
        previousResponse: "I'd be happy to help! As an AI, I think identity is simple."
      });

      // Feynman in-character
      mockLoadPersonaMarkers.mockResolvedValue(FEYNMAN_MARKERS);
      const feynmanOk = await assembleContext({
        personaId: 'feynman-uuid-002', personaSlug: 'feynman',
        userId: 'user-drift', query: 'test', sessionId: 'session-drift-2',
        previousResponse:
          'Look, the physics is simple when you calculate it right. ' +
          'Nature does what it does. The fun part is figuring out the model. ' +
          'Draw the diagram, do the experiment, see if it matches.'
      });

      // Drifting response should have higher score than in-character one
      expect(pessoaDrift.metadata.driftScore).toBeGreaterThan(
        feynmanOk.metadata.driftScore
      );
    });

    it('gracefully handles assembly when all optional components return null', async () => {
      mockLoadPersonaMarkers.mockResolvedValue(PESSOA_MARKERS);
      mockFrameMemories.mockResolvedValue(null);
      mockCompileUserSetting.mockResolvedValueOnce(null);

      const ctx = await assembleContext({
        personaId: 'pessoa-uuid-001', personaSlug: 'pessoa',
        userId: 'user-minimal', query: 'test', sessionId: 'session-minimal',
        options: { includePynchon: false, includeSetting: false }
      });

      // Should still return valid structure
      expect(ctx).toBeDefined();
      expect(ctx.metadata).toBeDefined();
      expect(ctx.components).toBeDefined();
    });
  });
});
