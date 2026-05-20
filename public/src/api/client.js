/**
 * API client — fetch wrapper + SSE connection.
 */

function getUserId() {
  let id = localStorage.getItem('aeon-user-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('aeon-user-id', id);
  }
  return id;
}

const headers = () => ({
  'Content-Type': 'application/json',
  'X-User-Id': getUserId()
});

export async function getState() {
  const res = await fetch('/api/state', { headers: headers() });
  return res.json();
}

export async function getPersonas() {
  const res = await fetch('/api/personas', { headers: headers() });
  return res.json();
}

export async function getPersona(slug) {
  const res = await fetch(`/api/persona/${encodeURIComponent(slug)}`, { headers: headers() });
  return res.json();
}

export async function invokePersona(personaSlug, query, sessionId, previousResponse) {
  const res = await fetch('/api/invoke', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ personaSlug, query, sessionId, previousResponse })
  });
  return res.json();
}

export async function completeSession(data) {
  const res = await fetch('/api/complete', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data)
  });
  return res.json();
}

/**
 * Connect to SSE stream for real-time state updates.
 */
export function connectSSE(gameState) {
  const source = new EventSource(`/api/events?userId=${getUserId()}`);

  source.addEventListener('entropy', (e) => {
    try {
      Object.assign(gameState.entropy, JSON.parse(e.data));
    } catch { /* graceful */ }
  });

  source.addEventListener('ambient', (e) => {
    try {
      Object.assign(gameState.ambient, JSON.parse(e.data));
    } catch { /* graceful */ }
  });

  source.addEventListener('bleed', (e) => {
    try {
      const bleed = JSON.parse(e.data);
      gameState._lastBleed = bleed;
    } catch { /* graceful */ }
  });

  source.addEventListener('paranoia', (e) => {
    try {
      Object.assign(gameState.paranoia, JSON.parse(e.data));
    } catch { /* graceful */ }
  });

  source.onerror = () => {
    source.close();
    setTimeout(() => connectSSE(gameState), 5000);
  };

  return source;
}
