import { readFile } from 'fs/promises';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';

process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  on: jest.fn(),
  end: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool),
  getClient: jest.fn().mockResolvedValue({ query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() }),
  withTransaction: jest.fn(async (callback) => callback(mockPool))
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
  analyzeDrift: jest.fn().mockResolvedValue(null)
}));

jest.unstable_mockModule('../../compute/soul-marker-extractor.js', () => ({
  loadPersonaMarkers: jest.fn().mockResolvedValue({ vocabulary: [], toneMarkers: [], patterns: [], forbidden: [] })
}));

jest.unstable_mockModule('../../compute/soul-validator.js', () => ({
  validateSoulCached: jest.fn().mockResolvedValue({ valid: true, metadata: { hashMatch: true, structureValid: true } }),
  alertOnCritical: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../compute/relationship-tracker.js', () => ({
  ensureRelationship: jest.fn().mockResolvedValue({
    trustLevel: 'stranger',
    trust_level: 'stranger',
    familiarityScore: 0,
    familiarity_score: 0,
    interactionCount: 0,
    interaction_count: 0,
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

const { assembleContext, completeSession } = await import('../../compute/context-assembler.js');

const fixturePath = new URL('../fixtures/context-assembler-golden.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixturePath, 'utf-8'));

const baseParams = {
  personaId: 'persona-123',
  personaSlug: 'hegel',
  userId: 'user-456',
  query: 'What is the nature of being?',
  sessionId: 'session-789'
};

const sessionData = {
  sessionId: 'session-789',
  userId: 'user-456',
  personaId: 'persona-123',
  personaName: 'Hegel',
  messages: [
    { role: 'user', content: 'What is the nature of being?' },
    { role: 'assistant', content: 'Being is the most abstract determination.' }
  ],
  startedAt: 1700000000000,
  endedAt: 1700000300000
};

function normalizeAssembleContext(result) {
  return {
    systemPrompt: result.systemPrompt,
    componentKeys: Object.keys(result.components).sort(),
    metadata: {
      truncated: result.metadata.truncated,
      memoriesIncluded: result.metadata.memoriesIncluded,
      driftScore: result.metadata.driftScore,
      trustLevel: result.metadata.trustLevel,
      pynchonEnabled: result.metadata.pynchonEnabled,
      hasTemporalContext: result.metadata.hasTemporalContext,
      hasPreteriteContext: result.metadata.hasPreteriteContext,
      hasZoneResistance: result.metadata.hasZoneResistance,
      hasAmbientContext: result.metadata.hasAmbientContext,
      hasEntropyContext: result.metadata.hasEntropyContext,
      hasTheyAwareness: result.metadata.hasTheyAwareness,
      hasCounterforce: result.metadata.hasCounterforce,
      hasNarrativeGravity: result.metadata.hasNarrativeGravity,
      hasInterfaceBleed: result.metadata.hasInterfaceBleed,
      entropyLevel: result.metadata.entropyLevel
    }
  };
}

function normalizeCompleteSession(result) {
  return {
    relationship: result.relationship,
    memoriesStored: result.memoriesStored,
    memoriesConsignedToPreterite: result.memoriesConsignedToPreterite,
    settingsExtracted: result.settingsExtracted,
    sessionQuality: {
      messageCount: result.sessionQuality.messageCount,
      durationMs: result.sessionQuality.durationMs,
      hasFollowUps: result.sessionQuality.hasFollowUps
    },
    entropyState: result.entropyState,
    arcPhase: result.arcPhase
  };
}

describe('context-assembler golden baselines', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('matches the normalized assembleContext golden fixture', async () => {
    const result = await assembleContext(baseParams);
    expect(normalizeAssembleContext(result)).toEqual(fixture.assembleContext);
  });

  it('matches the normalized completeSession golden fixture', async () => {
    const result = await completeSession(sessionData);
    expect(normalizeCompleteSession(result)).toEqual(fixture.completeSession);
  });
});
