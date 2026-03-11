#!/usr/bin/env node
/**
 * Live persona invocation test — exercises the full pipeline.
 * Usage: DATABASE_URL=... node scripts/test-invocation.js [persona] [message]
 */

import { assembleContext, completeSession } from '../compute/context-assembler.js';
import { getSharedPool } from '../compute/db-pool.js';
import { randomUUID } from 'crypto';

const personaSlug = process.argv[2] || 'pessoa';
const userMessage = process.argv[3] || 'Fernando, que horas são no Fim?';
const userIdentifier = 'echelon-live';

console.log('=== AEON MATRIX — LIVE INVOCATION ===');
console.log('Persona:', personaSlug);
console.log('User:', userIdentifier);
console.log('Query:', userMessage);
console.log('');

const pool = getSharedPool();

try {
  // Resolve persona ID from name
  const personaResult = await pool.query(
    'SELECT id FROM personas WHERE LOWER(name) = LOWER($1)',
    [personaSlug]
  );
  if (personaResult.rows.length === 0) {
    console.error('ERROR: Persona not found:', personaSlug);
    process.exit(1);
  }
  const personaId = personaResult.rows[0].id;

  // Ensure user exists
  const userResult = await pool.query(
    `INSERT INTO users (identifier) VALUES ($1)
     ON CONFLICT (identifier) DO UPDATE SET identifier = EXCLUDED.identifier
     RETURNING id`,
    [userIdentifier]
  );
  const userId = userResult.rows[0].id;

  // Create session
  const sessionResult = await pool.query(
    `INSERT INTO conversations (user_id) VALUES ($1) RETURNING id`,
    [userId]
  );
  const sessionId = sessionResult.rows[0].id;

  console.log('Persona ID:', personaId);
  console.log('User ID:', userId);
  console.log('Session ID:', sessionId);
  console.log('');

  // Assemble context
  const ctx = await assembleContext({
    personaId,
    personaSlug,
    userId,
    query: userMessage,
    sessionId
  });

  if (!ctx) {
    console.log('ERROR: assembleContext returned null');
    process.exit(1);
  }

  console.log('=== CONTEXT ASSEMBLED ===');
  console.log('Trust Level:', ctx.metadata?.trustLevel);
  console.log('Memories Included:', ctx.metadata?.memoriesIncluded);
  console.log('Drift Score:', ctx.metadata?.driftScore);
  console.log('Assembly Duration:', ctx.metadata?.assemblyDurationMs, 'ms');
  console.log('Pynchon Enabled:', ctx.metadata?.pynchonEnabled);
  console.log('Temporal:', ctx.metadata?.hasTemporalContext);
  console.log('Entropy:', ctx.metadata?.hasEntropyContext);
  console.log('Ambient:', ctx.metadata?.hasAmbientContext);
  console.log('They Awareness:', ctx.metadata?.hasTheyAwareness);
  console.log('Narrative Gravity:', ctx.metadata?.hasNarrativeGravity);
  console.log('Interface Bleed:', ctx.metadata?.hasInterfaceBleed);
  console.log('Soul Integrity Failure:', ctx.metadata?.soulIntegrityFailure || false);
  console.log('');

  // Show components
  console.log('=== COMPONENTS ===');
  for (const [key, val] of Object.entries(ctx.components || {})) {
    if (val) {
      const display = typeof val === 'string' ? val.substring(0, 200) : JSON.stringify(val).substring(0, 200);
      console.log(key + ':', display);
    }
  }
  console.log('');

  // Show system prompt
  const prompt = ctx.systemPrompt || '';
  console.log('=== SYSTEM PROMPT ===');
  console.log(prompt.substring(0, 2000));
  if (prompt.length > 2000) console.log('...(truncated)');
  console.log('');
  console.log('Total prompt length:', prompt.length, 'chars');

  // Complete session
  console.log('');
  console.log('=== COMPLETING SESSION ===');
  const startedAt = Date.now() - 5000;
  const endedAt = Date.now();
  const result = await completeSession({
    sessionId,
    userId,
    personaId,
    personaName: personaSlug,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: 'As horas aqui não passam como lá fora. No Fim, o tempo é uma sugestão que ninguém segue.' }
    ],
    startedAt,
    endedAt
  });
  console.log('Session completed:', JSON.stringify(result, null, 2));

} catch (err) {
  console.error('INVOCATION ERROR:', err.message);
  console.error(err.stack);
}

setTimeout(() => process.exit(0), 2000);
