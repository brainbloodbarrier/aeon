/**
 * Soul Validator Module
 *
 * Validates soul file integrity and structure at invocation time.
 * Implements Constitution Principle I: Soul Immutability
 *
 * @module compute/soul-validator
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getSharedPool } from './db-pool.js';
import { validatePersonaName } from './persona-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Configuration for soul validation
 */
export const CONFIG = {
  PERSONAS_DIR: process.env.PERSONAS_DIR || join(__dirname, '..', 'personas'),
  get DATABASE_URL() {
    if (!process.env.DATABASE_URL) {
      throw new Error('[SoulValidator] DATABASE_URL environment variable is required');
    }
    return process.env.DATABASE_URL;
  },
  REQUIRED_SECTIONS: [
    { name: 'title', pattern: /^#\s+.+/m, description: 'H1 title' },
    { name: 'voice', pattern: /^##\s+(Voz|Voice)/mi, description: 'Voice/Voz section' },
    { name: 'method', pattern: /^##\s+(Método|Method|Sistema)/mi, description: 'Method/Método section' },
    { name: 'invocation', pattern: /^##\s+(Quando Invocar|When)/mi, description: 'Invocation guidance' },
    { name: 'barBehavior', pattern: /^##\s+(Tom no Bar|Bar)/mi, description: 'Bar behavior' }
  ],
  HASH_ALGORITHM: 'sha256'
};

/**
 * Get database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  return getSharedPool();
}

/**
 * Compute SHA-256 hash of a file
 *
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<string>} 64-character hex string
 * @throws {Error} If file cannot be read
 */
export async function hashFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Soul file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8');
  return createHash(CONFIG.HASH_ALGORITHM).update(content, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 hash of content string
 *
 * @param {string} content - Content to hash
 * @returns {string} 64-character hex string
 */
export function hashContent(content) {
  return createHash(CONFIG.HASH_ALGORITHM).update(content, 'utf8').digest('hex');
}

/**
 * Check if soul file content has required sections
 *
 * @param {string} content - Raw markdown content
 * @returns {StructureValidation} Validation result
 */
export function validateStructure(content) {
  const sections = {};
  const missingRequired = [];

  for (const section of CONFIG.REQUIRED_SECTIONS) {
    const hasSection = section.pattern.test(content);
    sections[section.name] = hasSection;

    if (!hasSection) {
      missingRequired.push(section.description);
    }
  }

  // Check minimum content length
  if (content.trim().length < 100) {
    missingRequired.push('Minimum content length (100 chars)');
  }

  return {
    valid: missingRequired.length === 0,
    sections,
    missingRequired
  };
}

/**
 * Fetch persona data from database
 *
 * @param {string} personaName - Name of the persona
 * @returns {Promise<Object|null>} Persona record or null if not found
 */
async function fetchPersonaFromDb(personaName) {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query(
      `SELECT id, name, soul_path, soul_hash, soul_version
       FROM personas WHERE name = $1`,
      [personaName]
    );
    return rows.length > 0 ? rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Get the full path to a persona's soul file
 *
 * @param {string} soulPath - Relative soul path from database
 * @returns {string} Full absolute path
 */
function getSoulFilePath(soulPath) {
  return join(CONFIG.PERSONAS_DIR, soulPath);
}

/**
 * Validate a persona's soul file against stored hash and required structure
 *
 * @param {string} personaName - Name of the persona (e.g., 'hegel', 'moore')
 * @returns {Promise<ValidationResult>} Validation result
 */
export async function validateSoul(personaName) {
  validatePersonaName(personaName);
  const errors = [];
  const warnings = [];
  const metadata = {
    hashMatch: false,
    structureValid: false,
    currentHash: '',
    storedHash: '',
    version: 0,
    lastValidated: new Date().toISOString()
  };

  try {
    // Step 1: Fetch persona from database
    const persona = await fetchPersonaFromDb(personaName);

    if (!persona) {
      errors.push(`Persona '${personaName}' not registered`);
      return {
        valid: false,
        personaName,
        errors,
        warnings,
        metadata
      };
    }

    metadata.storedHash = persona.soul_hash;
    metadata.version = persona.soul_version;

    // Step 2: Check soul file exists
    const filePath = getSoulFilePath(persona.soul_path);

    if (!existsSync(filePath)) {
      errors.push(`Soul file not found: ${filePath}`);
      return {
        valid: false,
        personaName,
        errors,
        warnings,
        metadata
      };
    }

    // Step 3: Read and hash current file
    const content = readFileSync(filePath, 'utf8');
    const currentHash = hashContent(content);
    metadata.currentHash = currentHash;

    // Step 4: Compare hashes
    if (currentHash === persona.soul_hash) {
      metadata.hashMatch = true;
    } else {
      errors.push('Hash mismatch: soul file has been modified');
    }

    // Step 5: Validate structure
    const structureResult = validateStructure(content);
    metadata.structureValid = structureResult.valid;

    if (!structureResult.valid) {
      for (const missing of structureResult.missingRequired) {
        errors.push(`Soul file must have ${missing}`);
      }
    }

    // Determine overall validity
    const valid = metadata.hashMatch && metadata.structureValid;

    return {
      valid,
      personaName,
      errors,
      warnings,
      metadata
    };

  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
    return {
      valid: false,
      personaName,
      errors,
      warnings,
      metadata
    };
  }
}

/**
 * Log a modification attempt to the database
 *
 * @param {string} personaName - Name of the persona
 * @param {string} eventType - Type of event (hash_mismatch, validation_failed, etc.)
 * @param {string} targetFile - Path to the targeted file
 * @param {Object} details - Additional context
 * @returns {Promise<string>} Log entry UUID
 */
export async function logModificationAttempt(personaName, eventType, targetFile, details = {}) {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query(
      `SELECT log_modification_attempt($1, $2, $3, $4) as log_id`,
      [personaName, eventType, targetFile, JSON.stringify(details)]
    );
    return rows[0]?.log_id;
  } finally {
    client.release();
  }
}

/**
 * Check for critical alerts and notify operators
 *
 * @param {ValidationResult} result - Validation result
 */
export async function alertOnCritical(result) {
  if (!result.valid && !result.metadata.hashMatch) {
    // Hash mismatch is critical - log and alert
    console.error(`[CRITICAL] Soul integrity violation for ${result.personaName}`);
    console.error(`  Stored hash: ${result.metadata.storedHash}`);
    console.error(`  Current hash: ${result.metadata.currentHash}`);
    console.error(`  Errors: ${result.errors.join(', ')}`);

    // Log to database
    try {
      await logModificationAttempt(
        result.personaName,
        'hash_mismatch',
        `personas/${result.personaName}.md`,
        {
          storedHash: result.metadata.storedHash,
          currentHash: result.metadata.currentHash,
          errors: result.errors
        }
      );
    } catch (dbError) {
      console.error(`[CRITICAL] Failed to log soul integrity violation to database: ${dbError.message}`);
    }
  }
}

/**
 * Validate soul and handle errors appropriately
 * Use this in the invocation flow
 *
 * @param {string} personaName - Name of the persona
 * @returns {Promise<ValidationResult>} Validation result
 * @throws {Error} If validation fails
 */
export async function validateSoulOrThrow(personaName) {
  const result = await validateSoul(personaName);

  if (!result.valid) {
    await alertOnCritical(result);
    throw new Error(`Soul integrity check failed for ${personaName}: ${result.errors.join(', ')}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cached Validation (for invocation pipeline)
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Map<string, {result: Object, timestamp: number}>} */
const validationCache = new Map();
const CACHE_TTL_MS = 60_000; // Re-validate every 60 seconds

/**
 * Validate a persona's soul file with caching.
 * Returns cached result if within TTL, otherwise re-validates.
 *
 * @param {string} personaName - Name of the persona
 * @returns {Promise<ValidationResult>} Validation result
 */
export async function validateSoulCached(personaName) {
  const cached = validationCache.get(personaName);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }
  const result = await validateSoul(personaName);
  validationCache.set(personaName, { result, timestamp: Date.now() });
  return result;
}

/**
 * Clear the validation cache. Useful for testing.
 */
export function clearValidationCache() {
  validationCache.clear();
}

/**
 * Close database connections (for cleanup)
 * @deprecated Use closeSharedPool() from db-pool.js instead
 */
export async function closePool() {
  // No-op: pool lifecycle is managed by db-pool.js
}
