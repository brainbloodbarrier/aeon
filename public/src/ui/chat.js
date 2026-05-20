/**
 * Chat panel — DOM overlay for conversation with personas.
 */

import { invokePersona, completeSession } from '../api/client.js';
import { CATEGORY_COLORS } from '../engine/tilemap.js';
import { getPersonaEntity } from '../entities/index.js';

let panel = null;
let messagesEl = null;
let inputEl = null;

export function initChat() {
  panel = document.getElementById('chat-panel');
  messagesEl = document.getElementById('chat-messages');
  inputEl = document.getElementById('chat-input');

  if (!panel) return;

  document.getElementById('chat-send').addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  document.getElementById('chat-close').addEventListener('click', closeChat);
}

export function openChat(slug, gameState) {
  const data = gameState.personas.get(slug);
  if (!data || !panel) return;

  const sessionId = crypto.randomUUID();
  gameState.activeConversation = {
    personaSlug: slug,
    personaId: data.id,
    personaName: data.name || slug,
    sessionId,
    messages: [],
    startedAt: Date.now()
  };
  gameState.chatOpen = true;

  // Update header
  const nameEl = document.getElementById('chat-persona-name');
  const trustEl = document.getElementById('chat-trust-badge');
  const category = data.category || 'portuguese';
  const color = CATEGORY_COLORS[category] || '#888';

  nameEl.textContent = data.name || slug;
  nameEl.style.color = color;
  trustEl.textContent = data.trustLevel || 'stranger';

  // Accent color on header border
  const header = panel.querySelector('.chat-header');
  if (header) header.style.borderBottomColor = color;

  // Clear messages
  messagesEl.textContent = '';

  panel.classList.remove('hidden');
  document.body.classList.add('chat-open');
  inputEl.focus();
}

export async function closeChat(gameState) {
  if (!gameState?.activeConversation) {
    // Called from button click — need gameState from closure
    return;
  }

  const conv = gameState.activeConversation;

  // Complete session in background
  completeSession({
    sessionId: conv.sessionId,
    personaId: conv.personaId,
    personaName: conv.personaName,
    messages: conv.messages,
    startedAt: conv.startedAt,
    endedAt: Date.now()
  }).then(result => {
    // Update trust if changed
    if (result?.relationship?.trustLevelChanged) {
      const persona = gameState.personas.get(conv.personaSlug);
      if (persona) {
        persona.trustLevel = result.relationship.newTrustLevel;
      }
      // Visual feedback
      const entity = getPersonaEntity(conv.personaSlug);
      if (entity) entity.triggerDrift?.(1000);
    }
  }).catch(() => { /* graceful */ });

  gameState.activeConversation = null;
  gameState.chatOpen = false;
  panel.classList.add('hidden');
  document.body.classList.remove('chat-open');
}

// Bind closeChat with gameState reference
let _gameState = null;
export function bindGameState(gs) {
  _gameState = gs;
  document.getElementById('chat-close').addEventListener('click', () => closeChat(_gameState));
}

async function sendMessage() {
  if (!_gameState?.activeConversation) return;
  const query = inputEl.value.trim();
  if (!query) return;

  const conv = _gameState.activeConversation;
  inputEl.value = '';

  // Add user message
  appendMessage('user', query);
  conv.messages.push({ role: 'user', content: query });

  // Typing indicator
  const typing = appendTyping(conv.personaSlug);

  try {
    const result = await invokePersona(
      conv.personaSlug,
      query,
      conv.sessionId,
      conv.messages.length > 1 ? conv.messages[conv.messages.length - 2] : null
    );

    typing.remove();

    // Add persona response
    appendMessage('persona', result.response, conv.personaSlug);
    conv.messages.push({ role: 'assistant', content: result.response });

    // Update gameState with metadata
    if (result.metadata) {
      if (result.metadata.driftScore > 0.3) {
        const entity = getPersonaEntity(conv.personaSlug);
        if (entity) entity.triggerDrift();
      }
      if (result.metadata.trustLevel) {
        const persona = _gameState.personas.get(conv.personaSlug);
        if (persona) persona.trustLevel = result.metadata.trustLevel;
      }
      if (result.metadata.entropyLevel !== undefined) {
        _gameState.entropy.level = result.metadata.entropyLevel;
      }
    }

    if (result.sessionId) {
      conv.sessionId = result.sessionId;
    }
  } catch (err) {
    typing.remove();
    appendMessage('system', 'Conexão perdida...');
  }
}

function appendMessage(role, text, personaSlug) {
  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg chat-msg-${role}`;

  const textEl = document.createElement('span');
  textEl.textContent = text;
  msgEl.appendChild(textEl);

  if (role === 'persona' && personaSlug) {
    const data = _gameState?.personas.get(personaSlug);
    const category = data?.category || 'portuguese';
    const color = CATEGORY_COLORS[category] || '#888';
    msgEl.style.borderLeftColor = color;
  }

  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return msgEl;
}

function appendTyping(personaSlug) {
  const el = document.createElement('div');
  el.className = 'chat-msg chat-msg-persona chat-typing';
  const data = _gameState?.personas.get(personaSlug);
  const category = data?.category || 'portuguese';
  const color = CATEGORY_COLORS[category] || '#888';
  el.style.borderLeftColor = color;
  el.textContent = '...';
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}
