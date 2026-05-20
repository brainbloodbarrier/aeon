#!/usr/bin/env node

import http from 'http';

const baseUrl = process.env.AEON_BASE_URL || 'http://localhost:3000';
const userId = `verify-${Date.now()}`;

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': userId
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { response, text, json };
}

function check(condition, success, failure, failures) {
  if (condition) {
    console.log(`PASS ${success}`);
  } else {
    console.log(`FAIL ${failure}`);
    failures.push(failure);
  }
}

async function checkSse(failures) {
  const url = new URL(`${baseUrl}/api/events`);

  await new Promise((resolve) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: {
        'X-User-Id': userId,
        Accept: 'text/event-stream'
      }
    }, (res) => {
      const contentType = res.headers['content-type'] || '';
      check(
        res.statusCode === 200 && contentType.includes('text/event-stream'),
        'GET /api/events exposes SSE stream',
        `GET /api/events unexpected status/content-type (${res.statusCode}, ${contentType})`,
        failures
      );
      req.destroy();
      resolve();
    });

    req.on('error', (error) => {
      failures.push(`GET /api/events failed: ${error.message}`);
      console.log(`FAIL GET /api/events failed: ${error.message}`);
      resolve();
    });

    req.end();
  });
}

async function main() {
  try {
    const health = await requestJson('/api/personas');
    if (!health.response.ok) {
      console.error(`[verify-api] Server reachable but /api/personas failed with ${health.response.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`[verify-api] Could not reach ${baseUrl}`);
    console.error('[verify-api] Start the server with `npm start` and rerun this script.');
    console.error(`[verify-api] Underlying error: ${error.message}`);
    process.exit(1);
  }

  const failures = [];

  const personas = await requestJson('/api/personas');
  check(Array.isArray(personas.json), 'GET /api/personas returns array', 'GET /api/personas did not return array', failures);
  const firstPersona = Array.isArray(personas.json) && personas.json.length > 0 ? personas.json[0] : null;
  const personaSlug = firstPersona?.name || 'hegel';
  const personaId = firstPersona?.id || null;

  const persona = await requestJson(`/api/persona/${encodeURIComponent(personaSlug)}`);
  check(persona.response.ok, `GET /api/persona/${personaSlug} returned 200`, `GET /api/persona/${personaSlug} returned ${persona.response.status}`, failures);
  check(Boolean(persona.json?.persona), 'GET /api/persona/:slug returns persona object', 'GET /api/persona/:slug missing persona object', failures);
  check(Boolean(persona.json?.relationship), 'GET /api/persona/:slug returns relationship object', 'GET /api/persona/:slug missing relationship object', failures);

  const state = await requestJson('/api/state');
  check(Boolean(state.json?.entropy), 'GET /api/state returns entropy', 'GET /api/state missing entropy', failures);
  check(Boolean(state.json?.ambient !== undefined), 'GET /api/state returns ambient field', 'GET /api/state missing ambient field', failures);
  check(Boolean(state.json?.paranoia), 'GET /api/state returns paranoia', 'GET /api/state missing paranoia', failures);

  const invoke = await requestJson('/api/invoke', {
    method: 'POST',
    body: JSON.stringify({
      personaSlug,
      query: 'Smoke test invocation',
      sessionId: `verify-session-${Date.now()}`
    })
  });
  check(invoke.response.ok, 'POST /api/invoke returned success', `POST /api/invoke returned ${invoke.response.status}`, failures);
  check(typeof invoke.json?.response === 'string', 'POST /api/invoke returns response string', 'POST /api/invoke missing response string', failures);
  check(Boolean(invoke.json?.metadata), 'POST /api/invoke returns metadata', 'POST /api/invoke missing metadata', failures);
  check(Boolean(invoke.json?.sessionId || invoke.json?.metadata?.sessionId), 'POST /api/invoke returns session id', 'POST /api/invoke missing session id', failures);

  const complete = await requestJson('/api/complete', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: invoke.json?.sessionId || `verify-complete-${Date.now()}`,
      personaId: personaId || persona.json?.persona?.id,
      personaName: personaSlug,
      messages: [
        { role: 'user', content: 'Smoke test invocation' },
        { role: 'assistant', content: invoke.json?.response || 'diagnostic response' }
      ],
      startedAt: Date.now() - 1000,
      endedAt: Date.now()
    })
  });
  check(complete.response.ok, 'POST /api/complete returned success', `POST /api/complete returned ${complete.response.status}`, failures);
  check(Boolean(complete.json && 'relationship' in complete.json), 'POST /api/complete returns completion payload', 'POST /api/complete missing relationship field', failures);

  await checkSse(failures);

  if (failures.length > 0) {
    console.error(`[verify-api] ${failures.length} check(s) failed`);
    process.exit(1);
  }

  console.log('[verify-api] API and SSE smoke checks passed');
}

main();
