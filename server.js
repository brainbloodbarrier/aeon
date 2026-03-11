/**
 * AEON Frontend Server
 *
 * Express server that imports compute modules directly and serves
 * the isometric bar frontend. Claude API via Anthropic SDK.
 */

import express from 'express';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// Load .env if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const envContent = await readFile(resolve(__dir, '.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
    if (process.env.DB_PASSWORD && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = `postgres://architect:${process.env.DB_PASSWORD}@localhost:5432/aeon_matrix`;
    }
  } catch { /* .env not found, rely on environment */ }
}

// Compute module imports
import { assembleContext, completeSession } from './compute/context-assembler.js';
import { getEntropyState } from './compute/entropy-tracker.js';
import { getAmbientState, generateAmbientDetails } from './compute/ambient-generator.js';
import { getParanoiaState } from './compute/they-awareness.js';
import { shouldBleed, generateBleed } from './compute/interface-bleed.js';
import { ensureRelationship } from './compute/relationship-tracker.js';
import { getSharedPool, closeSharedPool } from './compute/db-pool.js';
import { validatePersonaName } from './compute/persona-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Anthropic SDK (lazy init, null if no key)
let anthropic = null;
async function getAnthropic() {
  if (anthropic) return anthropic;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  anthropic = new Anthropic();
  return anthropic;
}

app.use(express.json());
app.use(express.static(resolve(__dirname, 'public')));

// ─── User identity middleware ───
app.use('/api', (req, res, next) => {
  req.userId = req.headers['x-user-id'] || randomUUID();
  next();
});

// ─── Ensure user exists ───
async function ensureUser(userId) {
  const pool = getSharedPool();
  await pool.query(
    `INSERT INTO users (id, identifier) VALUES ($1, $2) ON CONFLICT (identifier) DO NOTHING`,
    [randomUUID(), userId]
  );
  const result = await pool.query(
    `SELECT id FROM users WHERE identifier = $1`, [userId]
  );
  return result.rows[0]?.id;
}

// ─── Resolve persona by slug ───
async function resolvePersona(slug) {
  const safeName = validatePersonaName(slug);
  const pool = getSharedPool();
  const result = await pool.query(
    `SELECT id, name, category, soul_path FROM personas WHERE name = $1`,
    [safeName]
  );
  return result.rows[0] || null;
}

// ═══════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════

// GET /api/personas — list all personas
app.get('/api/personas', async (req, res) => {
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT id, name, category FROM personas ORDER BY category, name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

// GET /api/persona/:slug — persona details + relationship
app.get('/api/persona/:slug', async (req, res) => {
  try {
    const persona = await resolvePersona(req.params.slug);
    if (!persona) return res.status(404).json({ error: 'Persona not found' });

    const userDbId = await ensureUser(req.userId);
    const relationship = await ensureRelationship(userDbId, persona.id);
    res.json({ persona, relationship });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch persona' });
  }
});

// GET /api/state — entropy + ambient + paranoia
app.get('/api/state', async (req, res) => {
  try {
    const [entropy, ambient, paranoia] = await Promise.all([
      getEntropyState().catch(() => ({ level: 0.15, state: 'stable' })),
      getAmbientState().catch(() => null),
      getParanoiaState().catch(() => ({ level: 0.1, state: 'oblivious' }))
    ]);
    res.json({ entropy, ambient, paranoia });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

// POST /api/invoke — assemble context + call Claude
app.post('/api/invoke', async (req, res) => {
  try {
    const { personaSlug, query, sessionId, previousResponse } = req.body;
    if (!personaSlug || !query) {
      return res.status(400).json({ error: 'personaSlug and query required' });
    }

    const persona = await resolvePersona(personaSlug);
    if (!persona) return res.status(404).json({ error: 'Persona not found' });

    const userDbId = await ensureUser(req.userId);
    const sid = sessionId || randomUUID();

    // Load persona soul file
    const soulPath = resolve(__dirname, 'personas', persona.category, `${persona.name}.md`);
    const personaMd = await readFile(soulPath, 'utf-8');

    // Assemble invisible context
    const assembled = await assembleContext({
      personaId: persona.id,
      personaSlug: persona.name,
      userId: userDbId,
      query,
      sessionId: sid,
      previousResponse
    });

    const fullSystem = personaMd + '\n\n' + assembled.systemPrompt;

    // Diagnostic mode — no API key
    const client = await getAnthropic();
    if (!client) {
      return res.json({
        response: `[Modo diagnóstico — systemPrompt montado com ${assembled.metadata.totalTokens} tokens]`,
        diagnostic: true,
        systemPrompt: fullSystem,
        metadata: assembled.metadata
      });
    }

    // Call Claude
    const msg = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: fullSystem,
      messages: [{ role: 'user', content: query }]
    });

    res.json({
      response: msg.content[0].text,
      metadata: assembled.metadata,
      sessionId: sid
    });
  } catch (err) {
    console.error('Invoke error:', err.message);
    res.status(500).json({ error: 'Invocation failed' });
  }
});

// POST /api/complete — end session
app.post('/api/complete', async (req, res) => {
  try {
    const { sessionId, personaId, personaName, messages, startedAt, endedAt } = req.body;
    const userDbId = await ensureUser(req.userId);

    const result = await completeSession({
      sessionId,
      userId: userDbId,
      personaId,
      personaName,
      messages: messages || [],
      startedAt: startedAt || Date.now(),
      endedAt: endedAt || Date.now()
    });

    res.json(result);
  } catch (err) {
    console.error('Complete error:', err.message);
    res.status(500).json({ error: 'Session completion failed' });
  }
});

// GET /api/events — SSE stream
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Entropy tick every 30s
  const entropyInterval = setInterval(async () => {
    try {
      const entropy = await getEntropyState();
      send('entropy', entropy);

      // Probabilistic bleed
      if (shouldBleed(entropy.level)) {
        const bleed = generateBleed(entropy.level);
        send('bleed', bleed);
      }
    } catch { /* graceful */ }
  }, 30000);

  // Ambient tick every 60s
  const ambientInterval = setInterval(async () => {
    try {
      const ambient = await getAmbientState();
      send('ambient', ambient);
    } catch { /* graceful */ }
  }, 60000);

  // Paranoia tick every 45s
  const paranoiaInterval = setInterval(async () => {
    try {
      const paranoia = await getParanoiaState();
      send('paranoia', paranoia);
    } catch { /* graceful */ }
  }, 45000);

  req.on('close', () => {
    clearInterval(entropyInterval);
    clearInterval(ambientInterval);
    clearInterval(paranoiaInterval);
  });
});

// ─── Start ───
app.listen(PORT, () => {
  console.log(`O Fim — http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY ? 'Claude API: active' : 'Diagnostic mode (no ANTHROPIC_API_KEY)');
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`\n${sig} — closing pool...`);
    await closeSharedPool().catch(() => {});
    process.exit(0);
  });
}
