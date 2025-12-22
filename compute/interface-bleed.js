/**
 * AEON Matrix - Interface Bleed
 *
 * System artifacts leak through at high entropy. In Pynchon's work, the
 * boundaries between systems break down. At O Fim, when entropy is high,
 * the invisible infrastructure occasionally bleeds through - fragments of
 * logs, timestamps, error messages appear in corrupted form.
 *
 * At low entropy: System is invisible, as designed
 * At high entropy: Artifacts leak through the fiction
 * Bleeds are corrupted, fragmentary, unsettling
 *
 * "Behind the hieroglyphic streets there would either be a transcendent
 * meaning, or only the earth." - Pynchon
 *
 * Feature: Phase 1 - Pynchon Layer
 * Constitution: Principle II (Invisible Infrastructure)
 */

import { getSharedPool } from './db-pool.js';
import { logOperation } from './operator-logger.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Types of system artifacts that can bleed through.
 */
export const BLEED_TYPES = {
  TIMESTAMP: 'timestamp',           // Corrupted timestamps appear
  ERROR_FRAGMENT: 'error_fragment', // Partial error messages
  LOG_LEAK: 'log_leak',             // Operator log fragments
  MEMORY_ADDRESS: 'memory_address', // Hex addresses, pointers
  QUERY_ECHO: 'query_echo',         // SQL fragments
  PROCESS_ID: 'process_id'          // System process references
};

/**
 * Entropy thresholds for bleeds.
 * Higher entropy = more likely to bleed.
 */
export const BLEED_THRESHOLDS = {
  RARE: 0.5,      // Occasional bleeds possible
  FREQUENT: 0.7,  // Bleeds become common
  SEVERE: 0.9     // Constant system breakdown
};

/**
 * Bleed severity levels.
 */
export const BLEED_SEVERITY = {
  MINOR: 'minor',       // Subtle glitch
  MODERATE: 'moderate', // Noticeable corruption
  SEVERE: 'severe'      // Reality breakdown
};

/**
 * Zalgo character sets for text corruption.
 */
const ZALGO_UP = [
  '\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311', '\u0306',
  '\u0310', '\u0352', '\u0357', '\u0351', '\u0307', '\u0308', '\u030a',
  '\u0342', '\u0343', '\u0344', '\u034a', '\u034b', '\u034c', '\u0303'
];

const ZALGO_MID = [
  '\u0315', '\u031b', '\u0340', '\u0341', '\u0358', '\u0321', '\u0322',
  '\u0327', '\u0328', '\u0334', '\u0335', '\u0336', '\u034f', '\u035c',
  '\u035d', '\u035e', '\u035f', '\u0360', '\u0362', '\u0338', '\u0337'
];

const ZALGO_DOWN = [
  '\u0316', '\u0317', '\u0318', '\u0319', '\u031c', '\u031d', '\u031e',
  '\u031f', '\u0320', '\u0324', '\u0325', '\u0326', '\u0329', '\u032a',
  '\u032b', '\u032c', '\u032d', '\u032e', '\u032f', '\u0330', '\u0331'
];

/**
 * Template fragments for each bleed type.
 */
const BLEED_TEMPLATES = {
  [BLEED_TYPES.TIMESTAMP]: [
    '[2025-12-21T02:--:--Z]',
    '[T̷I̷M̷E̷:̷ ̷U̷N̷D̷E̷F̷I̷N̷E̷D̷]',
    '[████-██-██T02:00:00.███Z]',
    '[1970-01-01T00:00:00Z]',
    '[NaN:NaN:NaN]',
    'ts=0x7fff████████',
    '[DATE_OVERFLOW]',
    '2AM. Always 2AM. The timestamp agrees.'
  ],
  [BLEED_TYPES.ERROR_FRAGMENT]: [
    '...ECONNRESET at layer [REDACTED]...',
    '...connection refused at 0x7fff...',
    'ERR: undefined is not a ████████',
    '...stack trace corrupted...',
    'FATAL: memory_allocation_failed',
    '...cannot read property of null...',
    'WARN: entropy_threshold_exceeded',
    '...segfault at address 0xDEAD...'
  ],
  [BLEED_TYPES.LOG_LEAK]: [
    '[operator_log] sess_id=█████ status=...',
    '[OPER] session_c0mpl...',
    'log_operation("████████", {',
    '[silent] drift_score=0.███',
    '[sys] persona_id=undefined',
    'INSERT INTO operator_logs...',
    '[fire-and-forget] failed silently',
    '[invisible] but leaking anyway'
  ],
  [BLEED_TYPES.MEMORY_ADDRESS]: [
    '0xDEADBEEF',
    '0x00000000',
    '0x????????',
    '0x7fff████████',
    'ptr=null',
    '&memory[CORRUPTED]',
    'heap: 0x0000...0xFFFF',
    'stack_overflow at 0x████'
  ],
  [BLEED_TYPES.QUERY_ECHO]: [
    'SELECT * FROM m̸e̸m̸o̸r̸i̸e̸s̸ WHERE...',
    'INSERT INTO █████████ VALUES (...)',
    'UPDATE personas SET soul_hash=NULL',
    'DELETE FROM [REDACTED]',
    'SELECT content FROM p̷r̷e̷t̷e̷r̷i̷t̷e̷...',
    'WHERE user_id = $1 AND ████',
    'ORDER BY entropy DESC LIMIT ∞',
    'JOIN forgotten ON never.id = always.id'
  ],
  [BLEED_TYPES.PROCESS_ID]: [
    'pid:31337 ppid:1 /usr/bin/[CORRUPTED]',
    'proc/████/status: zombie',
    'kill -9 [PERMISSION DENIED]',
    'fork() failed: too many ghosts',
    'daemon: aeon_matrix (orphaned)',
    'ps aux | grep ████████',
    'systemctl status reality.service',
    '/dev/null speaks back'
  ]
};

/**
 * Framing templates for bleed context injection.
 */
const BLEED_FRAMES = [
  'Somewhere, data corrupts:',
  'The edges fray. A system whispers:',
  'Static. Then, fragmentary:',
  'The infrastructure bleeds through:',
  'Between moments, a glitch:',
  'The invisible becomes briefly visible:',
  'Reality stutters. You glimpse:',
  'From behind the fiction:'
];

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Check if a bleed should occur based on entropy level.
 * Probabilistic - higher entropy = higher chance.
 *
 * @param {number} entropyLevel - Current entropy level 0.0-1.0
 * @returns {boolean} Whether a bleed should occur
 */
export function shouldBleed(entropyLevel) {
  if (entropyLevel < BLEED_THRESHOLDS.RARE) {
    // Below 0.5: very rare bleeds (5% at 0.4, scaling down)
    return Math.random() < (entropyLevel * 0.1);
  }

  if (entropyLevel < BLEED_THRESHOLDS.FREQUENT) {
    // 0.5-0.7: occasional bleeds (10-25%)
    const probability = 0.1 + ((entropyLevel - BLEED_THRESHOLDS.RARE) * 0.75);
    return Math.random() < probability;
  }

  if (entropyLevel < BLEED_THRESHOLDS.SEVERE) {
    // 0.7-0.9: frequent bleeds (25-60%)
    const probability = 0.25 + ((entropyLevel - BLEED_THRESHOLDS.FREQUENT) * 1.75);
    return Math.random() < probability;
  }

  // 0.9+: almost certain bleeds (60-90%)
  const probability = 0.6 + ((entropyLevel - BLEED_THRESHOLDS.SEVERE) * 3);
  return Math.random() < Math.min(probability, 0.9);
}

/**
 * Generate a bleed artifact.
 *
 * @param {number} entropyLevel - Current entropy level 0.0-1.0
 * @returns {Object} Bleed artifact
 * @property {string} type - Bleed type from BLEED_TYPES
 * @property {string} content - Corrupted content
 * @property {string} severity - Severity level
 */
export function generateBleed(entropyLevel) {
  // Select bleed type weighted by entropy
  const types = Object.values(BLEED_TYPES);
  const typeIndex = Math.floor(Math.random() * types.length);
  const type = types[typeIndex];

  // Select template
  const templates = BLEED_TEMPLATES[type];
  const templateIndex = Math.floor(Math.random() * templates.length);
  let content = templates[templateIndex];

  // Determine severity based on entropy
  let severity;
  if (entropyLevel < BLEED_THRESHOLDS.FREQUENT) {
    severity = BLEED_SEVERITY.MINOR;
  } else if (entropyLevel < BLEED_THRESHOLDS.SEVERE) {
    severity = BLEED_SEVERITY.MODERATE;
  } else {
    severity = BLEED_SEVERITY.SEVERE;
  }

  // Apply corruption based on severity
  content = applyCorruption(content, severity);

  return {
    type,
    content,
    severity
  };
}

/**
 * Corrupt text with bleed aesthetic.
 * Applies glitch effects based on severity.
 *
 * @param {string} text - Text to corrupt
 * @param {string|number} severity - Severity level or 0-1 intensity
 * @returns {string} Corrupted text
 */
export function corruptWithBleed(text, severity) {
  if (!text || text.length === 0) {
    return text;
  }

  // Normalize severity to 0-1 scale
  let intensity;
  if (typeof severity === 'number') {
    intensity = Math.max(0, Math.min(1, severity));
  } else {
    switch (severity) {
      case BLEED_SEVERITY.MINOR:
        intensity = 0.2;
        break;
      case BLEED_SEVERITY.MODERATE:
        intensity = 0.5;
        break;
      case BLEED_SEVERITY.SEVERE:
        intensity = 0.8;
        break;
      default:
        intensity = 0.3;
    }
  }

  let result = text;

  // Apply redaction blocks
  if (Math.random() < intensity * 0.5) {
    result = applyRedactions(result, intensity);
  }

  // Apply zalgo corruption
  if (Math.random() < intensity * 0.4) {
    result = applyZalgo(result, intensity);
  }

  // Apply hex insertions
  if (Math.random() < intensity * 0.3) {
    result = applyHexInsertions(result, intensity);
  }

  // Apply truncation
  if (Math.random() < intensity * 0.2) {
    result = applyTruncation(result);
  }

  return result;
}

/**
 * Apply corruption effects to text.
 *
 * @param {string} text - Text to corrupt
 * @param {string} severity - Severity level
 * @returns {string} Corrupted text
 */
function applyCorruption(text, severity) {
  switch (severity) {
    case BLEED_SEVERITY.MINOR:
      // Light corruption: occasional redaction
      return text.replace(/[a-zA-Z]{4,}/g, (match) => {
        if (Math.random() < 0.15) {
          return '████'.slice(0, match.length);
        }
        return match;
      });

    case BLEED_SEVERITY.MODERATE:
      // Medium corruption: redactions + some zalgo
      let result = text.replace(/[a-zA-Z]{3,}/g, (match) => {
        if (Math.random() < 0.25) {
          return '█'.repeat(Math.min(match.length, 4));
        }
        if (Math.random() < 0.15) {
          return applyZalgo(match, 0.3);
        }
        return match;
      });
      return result;

    case BLEED_SEVERITY.SEVERE:
      // Heavy corruption: zalgo + redactions + hex
      let severeResult = text;
      severeResult = applyZalgo(severeResult, 0.5);
      severeResult = applyRedactions(severeResult, 0.4);
      if (Math.random() < 0.3) {
        severeResult = `[0x${generateHexFragment()}] ${severeResult}`;
      }
      return severeResult;

    default:
      return text;
  }
}

/**
 * Apply zalgo text corruption.
 *
 * @param {string} text - Text to corrupt
 * @param {number} intensity - Corruption intensity 0-1
 * @returns {string} Zalgo-corrupted text
 */
function applyZalgo(text, intensity) {
  const maxMarks = Math.ceil(intensity * 3);
  let result = '';

  for (const char of text) {
    result += char;

    if (Math.random() < intensity * 0.4 && char !== ' ') {
      // Add combining characters
      const numUp = Math.floor(Math.random() * maxMarks);
      const numMid = Math.floor(Math.random() * (maxMarks / 2));
      const numDown = Math.floor(Math.random() * maxMarks);

      for (let i = 0; i < numUp; i++) {
        result += ZALGO_UP[Math.floor(Math.random() * ZALGO_UP.length)];
      }
      for (let i = 0; i < numMid; i++) {
        result += ZALGO_MID[Math.floor(Math.random() * ZALGO_MID.length)];
      }
      for (let i = 0; i < numDown; i++) {
        result += ZALGO_DOWN[Math.floor(Math.random() * ZALGO_DOWN.length)];
      }
    }
  }

  return result;
}

/**
 * Apply redaction blocks to text.
 *
 * @param {string} text - Text to redact
 * @param {number} intensity - Redaction intensity 0-1
 * @returns {string} Redacted text
 */
function applyRedactions(text, intensity) {
  return text.replace(/[a-zA-Z0-9]{2,}/g, (match) => {
    if (Math.random() < intensity * 0.3) {
      const redactLength = Math.max(1, Math.floor(match.length * Math.random()));
      const start = Math.floor(Math.random() * (match.length - redactLength));
      return match.slice(0, start) + '█'.repeat(redactLength) + match.slice(start + redactLength);
    }
    return match;
  });
}

/**
 * Apply hex insertions to text.
 *
 * @param {string} text - Text to modify
 * @param {number} intensity - Insertion intensity 0-1
 * @returns {string} Text with hex insertions
 */
function applyHexInsertions(text, intensity) {
  const insertions = Math.ceil(intensity * 2);
  let result = text;

  for (let i = 0; i < insertions; i++) {
    if (Math.random() < intensity * 0.5) {
      const hex = generateHexFragment();
      const position = Math.floor(Math.random() * result.length);
      result = result.slice(0, position) + ` [0x${hex}] ` + result.slice(position);
    }
  }

  return result;
}

/**
 * Apply truncation to text.
 *
 * @param {string} text - Text to truncate
 * @returns {string} Truncated text
 */
function applyTruncation(text) {
  const truncatePoint = Math.floor(text.length * (0.5 + Math.random() * 0.4));
  return text.slice(0, truncatePoint) + '...';
}

/**
 * Generate a hex fragment.
 *
 * @returns {string} Hex string
 */
function generateHexFragment() {
  const length = 4 + Math.floor(Math.random() * 5);
  let hex = '';
  const chars = '0123456789ABCDEF█?';

  for (let i = 0; i < length; i++) {
    hex += chars[Math.floor(Math.random() * chars.length)];
  }

  return hex;
}

// =============================================================================
// Multiple Bleeds
// =============================================================================

/**
 * Generate multiple bleeds for high entropy situations.
 *
 * @param {number} entropyLevel - Current entropy level 0.0-1.0
 * @param {number} maxBleeds - Maximum bleeds to generate (default 3)
 * @returns {Array<Object>} Array of bleed artifacts
 */
export function generateBleedBurst(entropyLevel, maxBleeds = 3) {
  const bleeds = [];

  // Number of bleeds scales with entropy
  const numBleeds = Math.min(
    maxBleeds,
    Math.ceil((entropyLevel - BLEED_THRESHOLDS.RARE) * 5)
  );

  for (let i = 0; i < numBleeds; i++) {
    if (shouldBleed(entropyLevel)) {
      bleeds.push(generateBleed(entropyLevel));
    }
  }

  return bleeds;
}

// =============================================================================
// Logging
// =============================================================================

/**
 * Log bleed occurrence to database.
 * Fire-and-forget, as per invisible infrastructure principle.
 *
 * @param {string} sessionId - Session identifier
 * @param {Object} bleed - Bleed artifact
 * @param {number} entropyLevel - Entropy at time of bleed
 * @returns {Promise<void>}
 */
export async function logBleed(sessionId, bleed, entropyLevel) {
  const startTime = performance.now();

  try {
    const db = getSharedPool();

    // Log to operator_logs (bleeds are infrastructure events)
    await db.query(
      `INSERT INTO operator_logs (
        session_id,
        operation,
        details,
        created_at
      ) VALUES ($1, 'interface_bleed', $2, NOW())`,
      [
        sessionId,
        JSON.stringify({
          bleed_type: bleed.type,
          severity: bleed.severity,
          entropy_level: entropyLevel,
          content_length: bleed.content?.length || 0
        })
      ]
    );

    // Fire-and-forget logging of the log
    logOperation('bleed_logged', {
      sessionId,
      details: {
        bleed_type: bleed.type,
        severity: bleed.severity,
        entropy_level: entropyLevel
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

  } catch (error) {
    console.error('[InterfaceBleed] Error logging bleed:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'bleed_log_failure',
        error_message: error.message
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});
  }
}

// =============================================================================
// Context Framing
// =============================================================================

/**
 * Frame bleeds for context injection.
 * Formats bleeds in a subtle, unsettling way.
 *
 * @param {Array<Object>} bleeds - Array of bleed artifacts
 * @returns {string} Framed context for injection
 */
export function frameBleedContext(bleeds) {
  if (!bleeds || bleeds.length === 0) {
    return '';
  }

  // Select random frame
  const frame = BLEED_FRAMES[Math.floor(Math.random() * BLEED_FRAMES.length)];

  const lines = [frame, ''];

  for (const bleed of bleeds) {
    // Format based on severity
    if (bleed.severity === BLEED_SEVERITY.SEVERE) {
      lines.push(`[SYSTEM FAULT] ${bleed.content}`);
    } else if (bleed.severity === BLEED_SEVERITY.MODERATE) {
      lines.push(`${bleed.content}`);
    } else {
      // Minor bleeds are parenthetical, almost unnoticed
      lines.push(`(${bleed.content})`);
    }
  }

  lines.push('');
  lines.push('The moment passes. Reality reasserts itself. Mostly.');

  return lines.join('\n').trim();
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Main entry: check and generate bleeds for a session.
 * Full flow: check -> generate -> log -> frame
 *
 * Constitution: Principle II (Invisible Infrastructure)
 *
 * @param {string} sessionId - Session identifier
 * @param {number} entropyLevel - Current entropy level 0.0-1.0
 * @returns {Promise<Object|null>} Bleed result or null if no bleed
 * @property {Array<Object>} bleeds - Generated bleeds
 * @property {string} context - Framed context for injection
 */
export async function processInterfaceBleed(sessionId, entropyLevel) {
  const startTime = performance.now();

  // Check if bleed should occur
  if (!shouldBleed(entropyLevel)) {
    return null;
  }

  try {
    // Generate bleeds
    let bleeds;
    if (entropyLevel >= BLEED_THRESHOLDS.SEVERE) {
      // High entropy: burst of bleeds
      bleeds = generateBleedBurst(entropyLevel, 3);
    } else if (entropyLevel >= BLEED_THRESHOLDS.FREQUENT) {
      // Medium-high entropy: 1-2 bleeds
      bleeds = generateBleedBurst(entropyLevel, 2);
    } else {
      // Lower entropy: single bleed
      bleeds = [generateBleed(entropyLevel)];
    }

    // Filter out any empty bleeds
    bleeds = bleeds.filter(b => b && b.content);

    if (bleeds.length === 0) {
      return null;
    }

    // Log each bleed (fire-and-forget)
    for (const bleed of bleeds) {
      logBleed(sessionId, bleed, entropyLevel).catch(() => {});
    }

    // Frame for context injection
    const context = frameBleedContext(bleeds);

    // Fire-and-forget logging of the full process
    logOperation('interface_bleed_process', {
      sessionId,
      details: {
        entropy_level: entropyLevel,
        bleeds_generated: bleeds.length,
        bleed_types: bleeds.map(b => b.type),
        severities: bleeds.map(b => b.severity),
        context_length: context.length
      },
      durationMs: performance.now() - startTime,
      success: true
    }).catch(() => {});

    return {
      bleeds,
      context
    };

  } catch (error) {
    console.error('[InterfaceBleed] Error processing bleed:', error.message);

    // Fire-and-forget error logging
    logOperation('error_graceful', {
      sessionId,
      details: {
        error_type: 'interface_bleed_failure',
        error_message: error.message,
        entropy_level: entropyLevel
      },
      durationMs: performance.now() - startTime,
      success: false
    }).catch(() => {});

    // Graceful fallback: no bleed on error (invisible infrastructure)
    return null;
  }
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Configuration object for external access.
 */
export const CONFIG = {
  BLEED_TYPES,
  BLEED_THRESHOLDS,
  BLEED_SEVERITY,
  BLEED_FRAMES,
  BLEED_TEMPLATES
};
