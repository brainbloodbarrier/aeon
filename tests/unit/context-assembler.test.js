/**
 * Unit Tests: Context Assembler
 *
 * Tests for compute/context-assembler.js — the central orchestrator for
 * invisible context injection (Constitution Principle II).
 *
 * Feature: 002-invisible-infrastructure
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before imports (required by modules after security hardening)
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// ══════════════════════════════════════════════════════════════════════════════
// Mock State
// ══════════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  on: jest.fn(),
  end: jest.fn()
};

// ══════════════════════════════════════════════════════════════════════════════
// ESM-compatible module mocking — ALL mocks BEFORE any dynamic imports
// ══════════════════════════════════════════════════════════════════════════════

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool),
  getClient: jest.fn().mockResolvedValue({ query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() }),
  withTransaction: jest.fn(async (callback) => {
    // Mock transaction: just execute the callback with the pool as the client
    return callback(mockPool);
  })
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined),
  logOperationBatch: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../compute/memory-framing.js', () => ({
  frameMemories: jest.fn().mockResolvedValue('You recall a conversation about philosophy.')
}));

jest.unstable_mockModule('../../compute/relationship-shaper.js', () => ({
  generateBehavioralHints: jest.fn().mockResolvedValue('This person is new to you.')
}));

jest.unstable_mockModule('../../compute/drift-correction.js', () => ({
  generateDriftCorrection: jest.fn().mockResolvedValue(null)
}));

jest.unstable_mockModule('../../compute/drift-analyzer.js', () => ({
  analyzeDrift: jest.fn().mockResolvedValue({
    driftScore: 0.2,
    severity: 'MINOR',
    forbiddenUsed: [],
    missingVocabulary: [],
    patternViolations: [],
    genericAIDetected: [],
    warnings: [],
    scores: { forbidden: 0, vocabulary: 0.2, patterns: 0, genericAI: 0 }
  })
}));

jest.unstable_mockModule('../../compute/soul-marker-extractor.js', () => ({
  loadPersonaMarkers: jest.fn().mockResolvedValue({
    vocabulary: ['Aufhebung', 'dialectic'],
    toneMarkers: ['dense', 'systematic'],
    patterns: [],
    forbidden: []
  })
}));

jest.unstable_mockModule('../../compute/soul-validator.js', () => ({
  validateSoulCached: jest.fn().mockResolvedValue({
    valid: true,
    personaName: 'hegel',
    errors: [],
    warnings: [],
    metadata: { hashMatch: true, structureValid: true }
  }),
  alertOnCritical: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../compute/relationship-tracker.js', () => ({
  ensureRelationship: jest.fn().mockResolvedValue({
    trustLevel: 'stranger',
    familiarityScore: 0,
    interactionCount: 0,
    userSummary: null,
    memorableExchanges: []
  }),
  updateFamiliarity: jest.fn().mockResolvedValue({
    effectiveDelta: 0.05,
    trustLevelChanged: false,
    newTrustLevel: 'stranger'
  })
}));

jest.unstable_mockModule('../../compute/memory-extractor.js', () => ({
  extractSessionMemories: jest.fn().mockResolvedValue([]),
  storeSessionMemories: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../compute/embedding-provider.js', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(null)
}));

jest.unstable_mockModule('../../compute/graph-sync.js', () => ({
  safeGraphSync: jest.fn().mockResolvedValue(null)
}));

jest.unstable_mockModule('../../compute/setting-preserver.js', () => ({
  compileUserSetting: jest.fn().mockResolvedValue('It is 2 AM at O Fim. Chopp flows cold.')
}));

jest.unstable_mockModule('../../compute/setting-extractor.js', () => ({
  extractAndSaveSettings: jest.fn().mockResolvedValue({ fieldsUpdated: [] })
}));

jest.unstable_mockModule('../../compute/persona-relationship-tracker.js', () => ({
  getPersonaNetwork: jest.fn().mockResolvedValue([])
}));

jest.unstable_mockModule('../../compute/persona-memory.js', () => ({
  getPersonaMemories: jest.fn().mockResolvedValue([]),
  framePersonaMemories: jest.fn().mockReturnValue(null),
  getAllOpinions: jest.fn().mockResolvedValue([])
}));

jest.unstable_mockModule('../../compute/temporal-awareness.js', () => ({
  generateTemporalContext: jest.fn().mockResolvedValue(null),
  frameTemporalContext: jest.fn().mockReturnValue(null),
  touchTemporalState: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../compute/ambient-generator.js', () => ({
  generateAmbientDetails: jest.fn().mockResolvedValue(null),
  frameAmbientContext: jest.fn().mockReturnValue(null)
}));

jest.unstable_mockModule('../../compute/entropy-tracker.js', () => ({
  getEntropyState: jest.fn().mockResolvedValue({ level: 0.1, state: 'stable', effects: [] }),
  applySessionEntropy: jest.fn().mockResolvedValue({ level: 0.15, state: 'stable' }),
  frameEntropyContext: jest.fn().mockReturnValue(null)
}));

jest.unstable_mockModule('../../compute/preterite-memory.js', () => ({
  attemptSurface: jest.fn().mockResolvedValue(null),
  classifyMemoryElection: jest.fn().mockReturnValue({ status: 'elect', reason: 'important' }),
  consignToPreterite: jest.fn().mockResolvedValue(undefined),
  framePreteriteContext: jest.fn().mockReturnValue(null)
}));

jest.unstable_mockModule('../../compute/zone-boundary-detector.js', () => ({
  detectZoneApproach: jest.fn().mockResolvedValue(null),
  frameZoneContext: jest.fn().mockReturnValue(null)
}));

jest.unstable_mockModule('../../compute/they-awareness.js', () => ({
  processTheyAwareness: jest.fn().mockResolvedValue(null),
  frameTheyContext: jest.fn().mockReturnValue(null)
}));

jest.unstable_mockModule('../../compute/counterforce-tracker.js', () => ({
  getPersonaAlignment: jest.fn().mockResolvedValue(null),
  generateCounterforceHints: jest.fn().mockReturnValue([]),
  frameCounterforceContext: jest.fn().mockReturnValue(null)
}));

jest.unstable_mockModule('../../compute/narrative-gravity.js', () => ({
  getSessionArc: jest.fn().mockResolvedValue(null),
  updateArc: jest.fn().mockResolvedValue({ phase: 'impact' }),
  analyzeMomentum: jest.fn().mockReturnValue({ trend: 'neutral' }),
  getPhaseEffects: jest.fn().mockReturnValue([]),
  generateArcContext: jest.fn().mockReturnValue(null),
  frameArcContext: jest.fn().mockReturnValue(null)
}));

jest.unstable_mockModule('../../compute/interface-bleed.js', () => ({
  processInterfaceBleed: jest.fn().mockResolvedValue(null),
  frameBleedContext: jest.fn().mockReturnValue(null)
}));

// ══════════════════════════════════════════════════════════════════════════════
// Import the module under test AFTER all mocks are registered
// ══════════════════════════════════════════════════════════════════════════════

let assembleContext, assembleCouncilContext, CONFIG;

// Import mocked modules so we can access/control them in tests
let mockEnsureRelationship, mockFrameMemories;
let mockCompileUserSetting;
let mockGenerateAmbientDetails, mockFrameAmbientContext;
let mockGenerateTemporalContext, mockFrameTemporalContext;
let mockAnalyzeDrift, mockLoadPersonaMarkers, mockGenerateDriftCorrection;
let mockValidateSoulCached;

beforeAll(async () => {
  const mod = await import('../../compute/context-assembler.js');
  assembleContext = mod.assembleContext;
  assembleCouncilContext = mod.assembleCouncilContext;
  CONFIG = mod.CONFIG;

  // Grab references to mock functions for fine-grained control
  const relTracker = await import('../../compute/relationship-tracker.js');
  mockEnsureRelationship = relTracker.ensureRelationship;

  const memFraming = await import('../../compute/memory-framing.js');
  mockFrameMemories = memFraming.frameMemories;

  const settingPres = await import('../../compute/setting-preserver.js');
  mockCompileUserSetting = settingPres.compileUserSetting;

  const temporal = await import('../../compute/temporal-awareness.js');
  mockGenerateTemporalContext = temporal.generateTemporalContext;
  mockFrameTemporalContext = temporal.frameTemporalContext;

  const ambient = await import('../../compute/ambient-generator.js');
  mockGenerateAmbientDetails = ambient.generateAmbientDetails;
  mockFrameAmbientContext = ambient.frameAmbientContext;

  const driftAnalyzer = await import('../../compute/drift-analyzer.js');
  mockAnalyzeDrift = driftAnalyzer.analyzeDrift;

  const soulMarkerExtractor = await import('../../compute/soul-marker-extractor.js');
  mockLoadPersonaMarkers = soulMarkerExtractor.loadPersonaMarkers;

  const driftCorrection = await import('../../compute/drift-correction.js');
  mockGenerateDriftCorrection = driftCorrection.generateDriftCorrection;

  const soulValidator = await import('../../compute/soul-validator.js');
  mockValidateSoulCached = soulValidator.validateSoulCached;
});

// ══════════════════════════════════════════════════════════════════════════════
// Standard test parameters
// ══════════════════════════════════════════════════════════════════════════════

const BASE_PARAMS = {
  personaId: 'persona-123',
  personaSlug: 'hegel',
  userId: 'user-456',
  query: 'What is the nature of being?',
  sessionId: 'session-789'
};

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('Context Assembler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: memory retrieval returns empty rows
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ════════════════════════════════════════════════════════════════════════
  // CONFIG export
  // ════════════════════════════════════════════════════════════════════════

  describe('CONFIG', () => {
    it('exports CONTEXT_BUDGET with expected component keys', () => {
      expect(CONFIG.CONTEXT_BUDGET).toBeDefined();
      expect(CONFIG.CONTEXT_BUDGET.soulMarkers).toBe(500);
      expect(CONFIG.CONTEXT_BUDGET.memories).toBe(800);
      expect(CONFIG.CONTEXT_BUDGET.buffer).toBe(150);
    });

    it('exports DEFAULT_RELATIONSHIP with stranger trust level', () => {
      expect(CONFIG.DEFAULT_RELATIONSHIP.trust_level).toBe('stranger');
      expect(CONFIG.DEFAULT_RELATIONSHIP.familiarity_score).toBe(0);
    });

    it('exports DEFAULT_MAX_TOKENS of 3000', () => {
      expect(CONFIG.DEFAULT_MAX_TOKENS).toBe(3000);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // assembleContext — happy path
  // ════════════════════════════════════════════════════════════════════════

  describe('assembleContext()', () => {
    it('returns a valid context object with systemPrompt, components, and metadata', async () => {
      const result = await assembleContext(BASE_PARAMS);

      expect(result).toBeDefined();
      expect(typeof result.systemPrompt).toBe('string');
      expect(result.systemPrompt.length).toBeGreaterThan(0);
      expect(result.components).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.sessionId).toBe('session-789');
    });

    it('includes setting, memories, and relationship hints in systemPrompt', async () => {
      const result = await assembleContext(BASE_PARAMS);

      // Setting should be included (from mockCompileUserSetting)
      expect(result.systemPrompt).toContain('O Fim');
      // Relationship hints (from mockGenerateBehavioralHints)
      expect(result.systemPrompt).toContain('This person is new to you.');
      // Framed memories (from mockFrameMemories)
      expect(result.systemPrompt).toContain('philosophy');
    });

    it('reports correct metadata fields', async () => {
      const result = await assembleContext(BASE_PARAMS);

      expect(result.metadata.trustLevel).toBe('stranger');
      expect(typeof result.metadata.totalTokens).toBe('number');
      expect(typeof result.metadata.assemblyDurationMs).toBe('number');
      expect(result.metadata.pynchonEnabled).toBe(true);
      expect(result.metadata.driftScore).toBeNull();
    });

    it('respects includeSetting=false option', async () => {
      const result = await assembleContext({
        ...BASE_PARAMS,
        options: { includeSetting: false }
      });

      // compileUserSetting should not be called
      expect(mockCompileUserSetting).not.toHaveBeenCalled();
      expect(result.components.setting).toBeNull();
    });

    it('respects includePynchon=false option to skip Pynchon Stack layers', async () => {
      const result = await assembleContext({
        ...BASE_PARAMS,
        options: { includePynchon: false }
      });

      expect(result.metadata.pynchonEnabled).toBe(false);
      expect(result.components.ambient).toBeNull();
      expect(result.components.entropy).toBeNull();
      expect(result.components.preterite).toBeNull();
      expect(result.components.zoneResistance).toBeNull();
      expect(result.components.theyAwareness).toBeNull();
      expect(result.components.counterforce).toBeNull();
      expect(result.components.narrativeGravity).toBeNull();
      expect(result.components.interfaceBleed).toBeNull();
    });

    // ══════════════════════════════════════════════════════════════════════
    // assembleContext — graceful degradation (Constitution Principle II)
    // ══════════════════════════════════════════════════════════════════════

    it('returns valid context when relationship fetch fails (falls back to stranger default)', async () => {
      mockEnsureRelationship.mockRejectedValueOnce(new Error('DB connection lost'));

      const result = await assembleContext(BASE_PARAMS);

      expect(result.systemPrompt.length).toBeGreaterThan(0);
      expect(result.metadata.trustLevel).toBe('stranger');
    });

    it('returns valid context when memory retrieval fails (empty memories)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Timeout'));

      const result = await assembleContext(BASE_PARAMS);

      expect(result).toBeDefined();
      expect(result.systemPrompt.length).toBeGreaterThan(0);
      // frameMemories still called with empty array from safeMemoryRetrieval fallback
      expect(mockFrameMemories).toHaveBeenCalled();
    });

    it('returns valid context when ALL subsystems fail simultaneously', async () => {
      // Make the critical early-pipeline function throw to trigger outer catch.
      // frameMemories is called after safeRelationshipFetch and safeMemoryRetrieval,
      // so throwing here exercises the catastrophic fallback path.
      mockEnsureRelationship.mockRejectedValueOnce(new Error('DB gone'));
      mockFrameMemories.mockRejectedValueOnce(new Error('framing failed'));

      const result = await assembleContext(BASE_PARAMS);

      // Should fall into the outer catch and return minimal context
      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('O Fim');
      expect(result.components.memories).toBeNull();
      expect(result.components.relationship).toBeNull();
      expect(result.metadata.trustLevel).toBe('stranger');
      expect(result.metadata.totalTokens).toBe(20);
    });

    // ══════════════════════════════════════════════════════════════════════
    // assembleContext — token budget enforcement
    // ══════════════════════════════════════════════════════════════════════

    it('truncates memories when they exceed the remaining token budget', async () => {
      // Generate a very long memory string that exceeds budget
      const longMemory = 'You recall a long conversation. '.repeat(500);
      mockFrameMemories.mockResolvedValueOnce(longMemory);

      const result = await assembleContext({
        ...BASE_PARAMS,
        options: { maxTokens: 500 }
      });

      expect(result.metadata.truncated).toBe(true);
      // The final systemPrompt is re-estimated; should be within budget
      expect(result.metadata.totalTokens).toBeLessThanOrEqual(500);
    });

    it('does not truncate memories when within budget', async () => {
      mockFrameMemories.mockResolvedValueOnce('A short memory.');

      const result = await assembleContext(BASE_PARAMS);

      expect(result.metadata.truncated).toBe(false);
    });

    // ══════════════════════════════════════════════════════════════════════
    // assembleContext — Pynchon Stack integration
    // ══════════════════════════════════════════════════════════════════════

    it('includes temporal context when temporal awareness returns data', async () => {
      mockGenerateTemporalContext.mockResolvedValueOnce({
        gapLevel: 'moderate',
        gapMs: 86400000,
        reflection: 'A day has passed since we last spoke.'
      });
      mockFrameTemporalContext.mockReturnValueOnce('[TIME] It has been a while since we spoke.');

      const result = await assembleContext(BASE_PARAMS);

      expect(result.systemPrompt).toContain('It has been a while since we spoke');
      expect(result.metadata.hasTemporalContext).toBe(true);
    });

    // ══════════════════════════════════════════════════════════════════════
    // assembleContext — drift correction pipeline
    // ══════════════════════════════════════════════════════════════════════

    it('runs drift pipeline when previousResponse is provided', async () => {
      mockGenerateDriftCorrection.mockResolvedValueOnce('[Inner voice: You are Hegel. Speak as yourself.]');

      const result = await assembleContext({
        ...BASE_PARAMS,
        previousResponse: 'I would be happy to help you with that question.'
      });

      expect(mockAnalyzeDrift).toHaveBeenCalledWith(
        'I would be happy to help you with that question.',
        'persona-123',
        'session-789'
      );
      expect(mockLoadPersonaMarkers).toHaveBeenCalledWith('hegel');
      expect(mockGenerateDriftCorrection).toHaveBeenCalled();
      expect(result.metadata.driftScore).toBe(0.2);
      expect(result.components.driftCorrection).toBe('[Inner voice: You are Hegel. Speak as yourself.]');
    });

    // ══════════════════════════════════════════════════════════════════════
    // assembleContext — soul validation (Constitution Principle I)
    // ══════════════════════════════════════════════════════════════════════

    it('returns empty context with soulIntegrityFailure when soul is tampered', async () => {
      mockValidateSoulCached.mockResolvedValueOnce({
        valid: false,
        personaName: 'hegel',
        errors: ['Hash mismatch: soul file has been modified'],
        warnings: [],
        metadata: { hashMatch: false, structureValid: true }
      });

      const result = await assembleContext(BASE_PARAMS);

      expect(result.systemPrompt).toBe('');
      expect(result.metadata.soulIntegrityFailure).toBe(true);
      expect(result.metadata.totalTokens).toBe(0);
      // Should NOT proceed to fetch relationship or memories
      expect(mockEnsureRelationship).not.toHaveBeenCalled();
    });

    it('proceeds normally when soul validation passes', async () => {
      const result = await assembleContext(BASE_PARAMS);

      expect(result.metadata.soulIntegrityFailure).toBeUndefined();
      expect(result.systemPrompt.length).toBeGreaterThan(0);
    });

    it('proceeds when soul validation throws (graceful degradation)', async () => {
      mockValidateSoulCached.mockRejectedValueOnce(new Error('DB down'));

      const result = await assembleContext(BASE_PARAMS);

      expect(result.systemPrompt.length).toBeGreaterThan(0);
      // Should proceed — validation error should not block
      expect(mockEnsureRelationship).toHaveBeenCalled();
    });

    it('does not run drift pipeline when no previousResponse', async () => {
      const result = await assembleContext(BASE_PARAMS);

      expect(mockAnalyzeDrift).not.toHaveBeenCalled();
      expect(result.metadata.driftScore).toBeNull();
    });

    it('gracefully handles drift pipeline failure', async () => {
      mockAnalyzeDrift.mockRejectedValueOnce(new Error('Drift DB timeout'));

      const result = await assembleContext({
        ...BASE_PARAMS,
        previousResponse: 'Some response text'
      });

      expect(result).toBeDefined();
      expect(result.metadata.driftScore).toBeNull();
      expect(result.components.driftCorrection).toBeNull();
    });

    it('includes ambient context when ambient generator provides details', async () => {
      mockGenerateAmbientDetails.mockResolvedValueOnce({
        microEvents: ['The jukebox stutters.'],
        timeOfNight: 'late',
        entropyLevel: 0.3
      });
      mockFrameAmbientContext.mockReturnValueOnce('[AMBIENT] The jukebox stutters between tracks.');

      const result = await assembleContext(BASE_PARAMS);

      expect(result.systemPrompt).toContain('jukebox stutters');
      expect(result.metadata.hasAmbientContext).toBe(true);
    });
  });

  describe('re-exports', () => {
    it('continues to expose assembleCouncilContext from the facade', () => {
      expect(typeof assembleCouncilContext).toBe('function');
    });
  });
});
