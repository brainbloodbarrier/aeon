/**
 * AEON Matrix - Persona Name Validator
 *
 * Validates persona names against directory traversal and injection attacks.
 * Any function receiving a persona name to construct a file path must use
 * this validator before proceeding.
 *
 * Security: Constitution Principle I (Soul Immutability)
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONAS_DIR = resolve(__dirname, '..', 'personas');

/**
 * Validate a persona name for safe use in file path construction.
 *
 * Rejects:
 * - null, undefined, empty, or non-string values
 * - Names containing '..' (directory traversal)
 * - Names containing '/' or '\' (path separators)
 * - Names containing null bytes (\x00)
 *
 * Additionally verifies the resolved path stays within PERSONAS_DIR.
 *
 * @param {string} personaName - Name of the persona to validate
 * @returns {string} The sanitized (trimmed, lowercased) persona name
 * @throws {Error} If the persona name is invalid
 */
export function validatePersonaName(personaName) {
  if (!personaName || typeof personaName !== 'string') {
    throw new Error('Persona name must be a non-empty string');
  }

  const trimmed = personaName.trim();

  if (trimmed.length === 0) {
    throw new Error('Persona name must be a non-empty string');
  }

  if (trimmed.includes('..')) {
    throw new Error(`Invalid persona name: directory traversal detected in "${trimmed}"`);
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`Invalid persona name: path separator detected in "${trimmed}"`);
  }

  if (trimmed.includes('\x00')) {
    throw new Error(`Invalid persona name: null byte detected in "${trimmed}"`);
  }

  // Verify the resolved path stays within PERSONAS_DIR
  const resolvedPath = resolve(PERSONAS_DIR, `${trimmed}.md`);
  if (!resolvedPath.startsWith(PERSONAS_DIR)) {
    throw new Error(`Invalid persona name: resolved path escapes personas directory`);
  }

  return trimmed;
}

export { PERSONAS_DIR };
