import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  on: jest.fn(),
  end: jest.fn()
};

const mockLogOperation = jest.fn().mockResolvedValue(undefined);
const mockUpdateFamiliarity = jest.fn().mockResolvedValue({
  effectiveDelta: 0.05,
  trustLevelChanged: false,
  newTrustLevel: 'stranger'
});
const mockSafeGraphSync = jest.fn().mockResolvedValue(null);
const mockExtractSessionMemories = jest.fn().mockResolvedValue([]);
const mockStoreSessionMemories = jest.fn().mockResolvedValue(undefined);
const mockExtractAndSaveSettings = jest.fn().mockResolvedValue({ fieldsUpdated: [] });
const mockTouchTemporalState = jest.fn().mockResolvedValue(undefined);
const mockApplySessionEntropy = jest.fn().mockResolvedValue({ level: 0.15, state: 'stable' });
const mockClassifyMemoryElection = jest.fn().mockReturnValue({ status: 'elect', reason: 'important' });
const mockConsignToPreterite = jest.fn().mockResolvedValue(undefined);
const mockUpdateArc = jest.fn().mockResolvedValue({ phase: 'impact' });

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool),
  withTransaction: jest.fn(async (callback) => callback(mockPool))
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: mockLogOperation
}));

jest.unstable_mockModule('../../compute/relationship-tracker.js', () => ({
  updateFamiliarity: mockUpdateFamiliarity
}));

jest.unstable_mockModule('../../compute/graph-sync.js', () => ({
  safeGraphSync: mockSafeGraphSync
}));

jest.unstable_mockModule('../../compute/memory-extractor.js', () => ({
  extractSessionMemories: mockExtractSessionMemories,
  storeSessionMemories: mockStoreSessionMemories
}));

jest.unstable_mockModule('../../compute/setting-extractor.js', () => ({
  extractAndSaveSettings: mockExtractAndSaveSettings
}));

jest.unstable_mockModule('../../compute/temporal-awareness.js', () => ({
  touchTemporalState: mockTouchTemporalState
}));

jest.unstable_mockModule('../../compute/entropy-tracker.js', () => ({
  applySessionEntropy: mockApplySessionEntropy
}));

jest.unstable_mockModule('../../compute/preterite-memory.js', () => ({
  classifyMemoryElection: mockClassifyMemoryElection,
  consignToPreterite: mockConsignToPreterite
}));

jest.unstable_mockModule('../../compute/narrative-gravity.js', () => ({
  updateArc: mockUpdateArc
}));

const { completeSession } = await import('../../compute/session-orchestrator.js');

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

describe('session-orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockUpdateFamiliarity.mockResolvedValue({
      effectiveDelta: 0.05,
      trustLevelChanged: false,
      newTrustLevel: 'stranger'
    });
    mockExtractSessionMemories.mockResolvedValue([]);
    mockClassifyMemoryElection.mockReturnValue({ status: 'elect', reason: 'important' });
    mockTouchTemporalState.mockResolvedValue(undefined);
    mockApplySessionEntropy.mockResolvedValue({ level: 0.15, state: 'stable' });
    mockUpdateArc.mockResolvedValue({ phase: 'impact' });
  });

  it('returns session completion results with relationship update and memory count', async () => {
    const result = await completeSession(sessionData);

    expect(result.relationship).toBeDefined();
    expect(result.relationship.effectiveDelta).toBe(0.05);
    expect(result.memoriesStored).toBe(0);
    expect(result.sessionQuality.messageCount).toBe(2);
  });

  it('returns skipped result when session was already completed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 });

    const result = await completeSession(sessionData);

    expect(result.skipped).toBe('already_completed');
    expect(result.relationship).toBeNull();
    expect(mockUpdateFamiliarity).not.toHaveBeenCalled();
  });

  it('stores extracted memories and consigns preterite ones', async () => {
    const fakeMemories = [
      { id: 'mem-1', content: 'Deep insight about being', importance_score: 0.9 },
      { id: 'mem-2', content: 'Small talk about weather', importance_score: 0.2 }
    ];

    mockExtractSessionMemories.mockResolvedValueOnce(fakeMemories);
    mockClassifyMemoryElection
      .mockReturnValueOnce({ status: 'elect', reason: 'important' })
      .mockReturnValueOnce({ status: 'preterite', reason: 'trivial' });

    const result = await completeSession(sessionData);

    expect(result.memoriesStored).toBe(2);
    expect(result.memoriesConsignedToPreterite).toBe(1);
    expect(mockStoreSessionMemories).toHaveBeenCalledWith('user-456', 'persona-123', fakeMemories, mockPool);
    expect(mockConsignToPreterite).toHaveBeenCalledTimes(1);
  });

  it('returns graceful error result when the outer try/catch fires', async () => {
    mockUpdateFamiliarity.mockRejectedValueOnce(new Error('Critical DB failure'));

    const result = await completeSession(sessionData);

    expect(result.error).toBe('Critical DB failure');
    expect(result.relationship).toBeNull();
    expect(result.memoriesStored).toBe(0);
  });

  it('calls temporal, entropy, and arc hooks on success', async () => {
    await completeSession(sessionData);

    expect(mockTouchTemporalState).toHaveBeenCalledWith('persona-123', {
      sessionDuration: 300000,
      messageCount: 2
    }, mockPool);
    expect(mockApplySessionEntropy).toHaveBeenCalledWith('session-789', mockPool);
    expect(mockUpdateArc).toHaveBeenCalledWith('session-789', -1.0, mockPool);
  });

  it('silently handles non-critical Pynchon hook failures', async () => {
    mockTouchTemporalState.mockRejectedValueOnce(new Error('temporal fail'));
    mockApplySessionEntropy.mockRejectedValueOnce(new Error('entropy fail'));
    mockUpdateArc.mockRejectedValueOnce(new Error('arc fail'));

    const result = await completeSession(sessionData);

    expect(result.relationship).toBeDefined();
    expect(result.error).toBeUndefined();
  });
});
