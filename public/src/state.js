/**
 * GameState — Single Source of Truth
 *
 * Every system reads from here. Backend data (via fetch/SSE)
 * updates here. The game loop renders from here.
 */

export const GameState = {
  // Camera
  camera: { x: 0, y: 0, zoom: 2 },

  // Avatar
  avatar: {
    tileX: 7, tileY: 7,
    pixelX: 0, pixelY: 0,
    state: 'idle',       // idle | walking
    direction: 'south',  // north | south | east | west
    path: []             // A* path tiles
  },

  // Personas (populated from /api/personas)
  personas: new Map(),

  // Backend state (updated via SSE)
  entropy: { level: 0.15, state: 'stable', markers: [] },
  ambient: {
    currentMusic: null,
    currentWeather: null,
    currentLighting: null,
    patronCount: 0,
    notableObjects: [],
    microEvents: []
  },
  paranoia: { level: 0.1, state: 'oblivious' },
  arc: { phase: 'rising', momentum: 0.4 },

  // Conversation
  activeConversation: null, // { personaSlug, personaId, personaName, sessionId, messages, startedAt }
  proximityTarget: null,    // persona slug when avatar is near

  // UI
  chatOpen: false,
  hudVisible: true,

  // Timing
  lastTick: 0,
  deltaTime: 0,
  frameCount: 0
};
