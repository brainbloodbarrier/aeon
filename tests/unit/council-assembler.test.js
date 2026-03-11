import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockLogOperation = jest.fn().mockResolvedValue(undefined);
const mockSafePersonaMemoriesFetch = jest.fn().mockResolvedValue(null);
const mockEstimateTokens = jest.fn((value) => (value ? String(value).length : 0));
const mockSafeAmbientFetch = jest.fn().mockResolvedValue(null);
const mockSafeEntropyFetch = jest.fn().mockResolvedValue(null);
const mockSafeZoneDetection = jest.fn().mockResolvedValue(null);
const mockSafeRelationshipFetch = jest.fn().mockResolvedValue({ trust_level: 'stranger' });
const mockSafePersonaRelationsFetch = jest.fn().mockResolvedValue(null);
const mockValidatePersonaName = jest.fn((value) => value);

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: mockLogOperation
}));

jest.unstable_mockModule('../../compute/memory-orchestrator.js', () => ({
  estimateTokens: mockEstimateTokens,
  safePersonaMemoriesFetch: mockSafePersonaMemoriesFetch
}));

jest.unstable_mockModule('../../compute/setting-orchestrator.js', () => ({
  safeAmbientFetch: mockSafeAmbientFetch,
  safeEntropyFetch: mockSafeEntropyFetch,
  safeZoneDetection: mockSafeZoneDetection
}));

jest.unstable_mockModule('../../compute/relationship-orchestrator.js', () => ({
  safeRelationshipFetch: mockSafeRelationshipFetch,
  safePersonaRelationsFetch: mockSafePersonaRelationsFetch,
  DEFAULT_RELATIONSHIP: {
    trust_level: 'stranger',
    familiarity_score: 0,
    interaction_count: 0
  }
}));

jest.unstable_mockModule('../../compute/persona-validator.js', () => ({
  validatePersonaName: mockValidatePersonaName
}));

const { assembleCouncilContext } = await import('../../compute/council-assembler.js');

const councilParams = {
  personaId: 'hegel-uuid',
  personaName: 'Hegel',
  personaSlug: 'hegel',
  userId: 'user-456',
  participantIds: ['socrates-uuid', 'diogenes-uuid'],
  participantNames: ['Socrates', 'Diogenes', 'Hegel'],
  sessionId: 'council-session-1',
  topic: 'What is the nature of truth?',
  councilType: 'council'
};

describe('council-assembler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafePersonaRelationsFetch.mockResolvedValue(null);
    mockSafePersonaMemoriesFetch.mockResolvedValue(null);
    mockSafeRelationshipFetch.mockResolvedValue({ trust_level: 'stranger' });
    mockSafeAmbientFetch.mockResolvedValue(null);
    mockSafeEntropyFetch.mockResolvedValue(null);
    mockSafeZoneDetection.mockResolvedValue(null);
  });

  it('returns a council context with the correct frame text', async () => {
    const result = await assembleCouncilContext(councilParams);

    expect(result.systemPrompt).toContain('gathered at O Fim');
    expect(result.systemPrompt).toContain('Socrates');
    expect(result.systemPrompt).toContain('Diogenes');
    expect(result.systemPrompt).toContain('What is the nature of truth?');
    expect(result.metadata.councilType).toBe('council');
    expect(result.metadata.participantCount).toBe(2);
  });

  it('builds the dialectic frame correctly', async () => {
    const result = await assembleCouncilContext({
      ...councilParams,
      councilType: 'dialectic'
    });

    expect(result.systemPrompt).toContain('dialectic process');
    expect(result.systemPrompt).toContain('thesis');
  });

  it('includes ambient context when available', async () => {
    mockSafeAmbientFetch.mockResolvedValueOnce('[AMBIENT] Smoke curls from nowhere.');

    const result = await assembleCouncilContext(councilParams);

    expect(result.systemPrompt).toContain('Smoke curls');
    expect(result.metadata.hasAmbientContext).toBe(true);
    expect(result.metadata.pynchonEnabled).toBe(true);
  });

  it('falls back to the minimal frame on failure', async () => {
    mockSafePersonaRelationsFetch.mockRejectedValueOnce(new Error('network down'));

    const result = await assembleCouncilContext(councilParams);

    expect(result.metadata.fallback).toBe(true);
    expect(result.systemPrompt).toContain('gathered at O Fim');
  });
});
