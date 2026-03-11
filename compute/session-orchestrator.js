import { getSharedPool, withTransaction } from './db-pool.js';
import { logOperation } from './operator-logger.js';
import { updateFamiliarity } from './relationship-tracker.js';
import { safeGraphSync } from './graph-sync.js';
import { extractSessionMemories, storeSessionMemories } from './memory-extractor.js';
import { extractAndSaveSettings } from './setting-extractor.js';
import { touchTemporalState } from './temporal-awareness.js';
import { applySessionEntropy } from './entropy-tracker.js';
import { classifyMemoryElection, consignToPreterite } from './preterite-memory.js';
import { updateArc } from './narrative-gravity.js';
import { validatePersonaName } from './persona-validator.js';
import { ARC_PHASES } from './constants.js';

function getPool() {
  return getSharedPool();
}

export async function completeSession(sessionData) {
  const startTime = Date.now();
  const { sessionId, userId, personaId, personaName, messages, startedAt, endedAt } = sessionData;

  if (personaName) {
    validatePersonaName(personaName);
  }

  try {
    const alreadyCompleted = await checkSessionCompleted(sessionId);
    if (alreadyCompleted) {
      return {
        relationship: null,
        memoriesStored: 0,
        settingsExtracted: [],
        sessionQuality: null,
        skipped: 'already_completed'
      };
    }

    const sessionQuality = {
      messageCount: messages.length,
      durationMs: endedAt - startedAt,
      hasFollowUps: detectFollowUps(messages),
      topicDepth: calculateTopicDepth(messages)
    };

    const txResult = await withTransaction(async (client) => {
      const relationshipResult = await updateFamiliarity(userId, personaId, sessionQuality, client);

      const memories = await extractSessionMemories({
        sessionId,
        userId,
        personaId,
        personaName,
        messages,
        startedAt,
        endedAt
      });

      let memoriesStored = 0;
      let memoriesConsignedToPreterite = 0;

      if (memories.length > 0) {
        await storeSessionMemories(userId, personaId, memories, client);
        memoriesStored = memories.length;

        try {
          for (const memory of memories) {
            const classification = classifyMemoryElection(memory);
            if (classification.status === 'preterite') {
              await consignToPreterite(memory, classification.reason, client);
              memoriesConsignedToPreterite++;
            }
          }
        } catch (preteriteError) {
          console.error('[SessionOrchestrator] Preterite classification failed:', preteriteError.message);
        }
      }

      const settingResult = await extractAndSaveSettings({
        sessionId,
        userId,
        personaId,
        personaName,
        messages,
        startedAt,
        endedAt
      }, client);

      try {
        await touchTemporalState(personaId, {
          sessionDuration: endedAt - startedAt,
          messageCount: messages.length
        }, client);
      } catch (temporalError) {
        console.error('[SessionOrchestrator] Temporal state update failed:', temporalError.message);
      }

      let entropyResult = null;
      try {
        entropyResult = await applySessionEntropy(sessionId, client);
      } catch (entropyError) {
        console.error('[SessionOrchestrator] Entropy increment failed:', entropyError.message);
      }

      let arcResult = null;
      try {
        arcResult = await updateArc(sessionId, -1.0, client);
      } catch (arcError) {
        console.error('[SessionOrchestrator] Narrative arc update failed:', arcError.message);
      }

      await logOperation('session_complete', {
        sessionId,
        personaId,
        userId,
        details: {
          duration_ms: endedAt - startedAt,
          message_count: messages.length,
          familiarity_delta: relationshipResult.effectiveDelta,
          trust_level_changed: relationshipResult.trustLevelChanged,
          memories_stored: memoriesStored,
          memories_preterite: memoriesConsignedToPreterite,
          settings_extracted: settingResult.fieldsUpdated.length > 0,
          settings_fields: settingResult.fieldsUpdated,
          entropy_level: entropyResult?.level || null,
          entropy_state: entropyResult?.state || null,
          arc_phase: arcResult?.phase || ARC_PHASES.IMPACT
        },
        durationMs: Date.now() - startTime,
        success: true
      });

      return {
        relationship: relationshipResult,
        memoriesStored,
        memoriesConsignedToPreterite,
        settingsExtracted: settingResult.fieldsUpdated,
        sessionQuality,
        entropyState: entropyResult?.state || null,
        arcPhase: arcResult?.phase || ARC_PHASES.IMPACT
      };
    });

    if (txResult.relationship?.trustLevelChanged || txResult.memoriesStored > 0) {
      safeGraphSync(userId).catch((err) =>
        console.error('[SessionOrchestrator] Graph sync fire-and-forget failed:', err.message)
      );
    }

    return txResult;
  } catch (error) {
    await logOperation('error_graceful', {
      sessionId,
      personaId,
      userId,
      details: {
        error_type: 'session_complete_failure',
        error_message: error.message,
        fallback_used: 'silent_failure'
      },
      durationMs: Date.now() - startTime,
      success: false
    });

    return {
      relationship: null,
      memoriesStored: 0,
      memoriesConsignedToPreterite: 0,
      sessionQuality: null,
      entropyState: null,
      arcPhase: null,
      error: error.message
    };
  }
}

async function checkSessionCompleted(sessionId) {
  if (!sessionId) return false;

  try {
    const db = getPool();
    const result = await db.query(
      `SELECT 1 FROM operator_logs
       WHERE session_id = $1
         AND operation = 'session_complete'
         AND success = true
       LIMIT 1`,
      [sessionId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[SessionOrchestrator] Idempotency check failed:', error.message);
    return false;
  }
}

function detectFollowUps(messages) {
  const followUpPatterns = [
    /^(but|and|so|also|what about|how about|could you|can you explain)/i,
    /\?.*\?/,
    /tell me more/i,
    /go on/i,
    /continue/i,
    /elaborate/i
  ];

  const userMessages = messages.filter((m) => m.role === 'user').slice(1);
  return userMessages.some((msg) =>
    followUpPatterns.some((pattern) => pattern.test(msg.content))
  );
}

function calculateTopicDepth(messages) {
  const userMessages = messages.filter((m) => m.role === 'user');

  if (userMessages.length === 0) return 0;

  const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
  const questionWords = ['why', 'how', 'what if', 'suppose', 'consider', 'meaning', 'nature of'];
  const hasDeepQuestions = userMessages.some((msg) =>
    questionWords.some((word) => msg.content.toLowerCase().includes(word))
  );

  const lengthScore = Math.min(avgLength / 200, 1);
  const questionScore = hasDeepQuestions ? 0.3 : 0;

  return Math.min(lengthScore + questionScore, 1);
}
