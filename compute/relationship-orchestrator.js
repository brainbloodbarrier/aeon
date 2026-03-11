import { ensureRelationship } from './relationship-tracker.js';
import { getPersonaNetwork } from './persona-relationship-tracker.js';
import { logOperation } from './operator-logger.js';

export const DEFAULT_RELATIONSHIP = {
  trust_level: 'stranger',
  familiarity_score: 0,
  interaction_count: 0
};

export async function safeRelationshipFetch(personaId, userId, sessionId) {
  const startTime = Date.now();

  try {
    const relationship = await ensureRelationship(userId, personaId);

    logOperation('relationship_fetch', {
      sessionId,
      personaId,
      userId,
      details: {
        trust_level: relationship.trustLevel,
        familiarity_score: relationship.familiarityScore,
        interaction_count: relationship.interactionCount,
        new_relationship: relationship.interactionCount === 0
      },
      durationMs: Date.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      trust_level: relationship.trustLevel,
      familiarity_score: relationship.familiarityScore,
      interaction_count: relationship.interactionCount,
      user_summary: relationship.userSummary,
      memorable_exchanges: relationship.memorableExchanges
    };
  } catch (error) {
    logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'relationship_fetch_failure',
        error_message: error.message,
        fallback_used: 'stranger_default'
      },
      durationMs: Date.now() - startTime,
      success: false
    }).catch(() => {});

    return { ...DEFAULT_RELATIONSHIP };
  }
}

export async function safePersonaRelationsFetch(personaId, relevantPersonaIds = null, sessionId = null) {
  const startTime = Date.now();

  try {
    const network = await getPersonaNetwork(personaId);

    if (!network || network.length === 0) {
      return null;
    }

    const relevantNetwork = relevantPersonaIds
      ? network.filter((relation) => relevantPersonaIds.includes(relation.personaId))
      : network.slice(0, 5);

    if (relevantNetwork.length === 0) {
      return null;
    }

    const frames = relevantNetwork.map((relation) => {
      const affinityWord = relation.affinityScore > 0.5 ? 'trust'
        : relation.affinityScore > 0 ? 'respect'
        : relation.affinityScore > -0.3 ? 'are cautious of'
        : 'distrust';

      return `You ${affinityWord} ${relation.personaName}.`;
    });

    logOperation('persona_relations_fetch', {
      sessionId,
      personaId,
      details: {
        relationships_included: relevantNetwork.length,
        filtered_by_council: !!relevantPersonaIds
      },
      durationMs: Date.now() - startTime,
      success: true
    }).catch(() => {});

    return frames.join(' ');
  } catch (error) {
    logOperation('error_graceful', {
      sessionId,
      personaId,
      details: {
        error_type: 'persona_relations_fetch_failure',
        error_message: error.message,
        fallback_used: 'null'
      },
      durationMs: Date.now() - startTime,
      success: false
    }).catch(() => {});

    return null;
  }
}
