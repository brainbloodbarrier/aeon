import { logOperation } from './operator-logger.js';
import { validatePersonaName } from './persona-validator.js';
import { CONTEXT_BUDGET } from './constants.js';
import { estimateTokens, safePersonaMemoriesFetch } from './memory-orchestrator.js';
import { safeAmbientFetch, safeEntropyFetch, safeZoneDetection } from './setting-orchestrator.js';
import { safeRelationshipFetch, safePersonaRelationsFetch } from './relationship-orchestrator.js';

export async function assembleCouncilContext(params) {
  const startTime = Date.now();
  const {
    personaId,
    personaName,
    personaSlug = null,
    userId,
    participantIds,
    participantNames,
    sessionId,
    topic,
    councilType,
    councilState = null,
    options = {}
  } = params;

  const includePynchon = options.includePynchon !== false;

  if (personaSlug) {
    validatePersonaName(personaSlug);
  }

  try {
    const personaRelations = await safePersonaRelationsFetch(personaId, participantIds, sessionId);
    const personaMemories = await safePersonaMemoriesFetch(personaId, CONTEXT_BUDGET.personaMemories, sessionId);

    let userRelationship = null;
    if (userId) {
      userRelationship = await safeRelationshipFetch(personaId, userId, sessionId);
    }

    const otherParticipants = participantNames.filter((name) => name !== personaName);
    const councilFrame = buildCouncilFrame(councilType, topic, otherParticipants, councilState);

    let ambientContext = null;
    let entropyContext = null;
    let zoneContext = null;

    if (includePynchon) {
      ambientContext = await safeAmbientFetch(sessionId, personaId);
      entropyContext = await safeEntropyFetch(sessionId);
      zoneContext = await safeZoneDetection(topic, sessionId, personaId);
    }

    const components = {
      councilFrame,
      personaRelations: personaRelations || null,
      personaMemories: personaMemories || null,
      userRelationship: userRelationship ? `The one who called this council: ${userRelationship.trust_level}.` : null,
      ambient: ambientContext || null,
      entropy: entropyContext || null,
      zoneResistance: zoneContext || null
    };

    const parts = [];
    parts.push(councilFrame);

    if (components.ambient) {
      parts.push('\n' + components.ambient);
    }

    if (components.personaRelations) {
      parts.push('\n' + components.personaRelations);
    }

    if (components.personaMemories) {
      parts.push('\n' + components.personaMemories);
    }

    if (components.userRelationship) {
      parts.push('\n' + components.userRelationship);
    }

    if (components.entropy) {
      parts.push('\n' + components.entropy);
    }

    if (components.zoneResistance) {
      parts.push('\n' + components.zoneResistance);
    }

    const systemPrompt = parts.join('').trim();
    const totalTokens = estimateTokens(systemPrompt);

    await logOperation('council_context_assembly', {
      sessionId,
      personaId,
      details: {
        council_type: councilType,
        participant_count: participantIds.length,
        has_persona_relations: !!personaRelations,
        has_persona_memories: !!personaMemories,
        has_user_relationship: !!userRelationship,
        pynchon_enabled: includePynchon,
        has_ambient: !!ambientContext,
        has_entropy: !!entropyContext,
        has_zone_resistance: !!zoneContext,
        total_tokens: totalTokens
      },
      durationMs: Date.now() - startTime,
      success: true
    });

    return {
      systemPrompt,
      components,
      metadata: {
        sessionId,
        personaId,
        personaName,
        councilType,
        participantCount: participantIds.length,
        totalTokens,
        assemblyDurationMs: Date.now() - startTime,
        pynchonEnabled: includePynchon,
        hasAmbientContext: !!ambientContext,
        hasEntropyContext: !!entropyContext,
        hasZoneResistance: !!zoneContext
      }
    };
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'council_context_assembly_failure',
        error_message: error.message,
        fallback_used: 'minimal_council_frame'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    const fallbackFrame = buildCouncilFrame(councilType, topic, participantNames.filter((name) => name !== personaName), null);

    return {
      systemPrompt: fallbackFrame,
      components: { councilFrame: fallbackFrame },
      metadata: {
        sessionId,
        personaId,
        personaName,
        councilType,
        participantCount: participantIds.length,
        totalTokens: estimateTokens(fallbackFrame),
        assemblyDurationMs: Date.now() - startTime,
        fallback: true,
        pynchonEnabled: false
      }
    };
  }
}

function buildCouncilFrame(councilType, topic, otherParticipants, councilState) {
  const othersText = otherParticipants.length > 0
    ? `with ${otherParticipants.join(', ')}`
    : '';

  const stateText = councilState?.currentPhase
    ? ` Phase: ${councilState.currentPhase}.`
    : '';

  const frames = {
    council: `You are gathered at O Fim ${othersText} to discuss: "${topic}"${stateText}`,
    dialectic: `The dialectic process is underway ${othersText}. The thesis: "${topic}"${stateText}`,
    familia: `The family has been called to council ${othersText}. The matter: "${topic}"${stateText}`,
    heteronyms: `The fragments gather ${othersText}. The question: "${topic}"${stateText}`,
    scry: `The Enochian protocol is invoked ${othersText}. Seeking: "${topic}"${stateText}`,
    magick: `The narrative ritual begins ${othersText}. The situation: "${topic}"${stateText}`,
    war: `Strategy session convened ${othersText}. The conflict: "${topic}"${stateText}`
  };

  return frames[councilType] || frames.council;
}
