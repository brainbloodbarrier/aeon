/**
 * Unit tests for persona-validator.js
 * Security: Validates persona name sanitization against directory traversal
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => ({ query: jest.fn(), end: jest.fn() }))
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// Import after mocking
const { validatePersonaName, PERSONAS_DIR } = await import('../../compute/persona-validator.js');

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Persona Validator Module', () => {
  describe('validatePersonaName', () => {
    // ─────────────────────────────────────────────────────────────────────
    // Valid names
    // ─────────────────────────────────────────────────────────────────────
    describe('valid persona names', () => {
      test('accepts simple lowercase name', () => {
        expect(validatePersonaName('pessoa')).toBe('pessoa');
      });

      test('accepts name with hyphen', () => {
        expect(validatePersonaName('sun-tzu')).toBe('sun-tzu');
      });

      test('accepts mixed case name', () => {
        expect(validatePersonaName('Feynman')).toBe('Feynman');
      });

      test('trims whitespace', () => {
        expect(validatePersonaName('  hegel  ')).toBe('hegel');
      });

      test('accepts name with numbers', () => {
        expect(validatePersonaName('persona1')).toBe('persona1');
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Directory traversal rejection
    // ─────────────────────────────────────────────────────────────────────
    describe('directory traversal rejection', () => {
      test('rejects ../../../etc/passwd', () => {
        expect(() => validatePersonaName('../../../etc/passwd')).toThrow('directory traversal');
      });

      test('rejects persona/../secret', () => {
        expect(() => validatePersonaName('persona/../secret')).toThrow('directory traversal');
      });

      test('rejects ..', () => {
        expect(() => validatePersonaName('..')).toThrow('directory traversal');
      });

      test('rejects name with embedded ..', () => {
        expect(() => validatePersonaName('foo..bar')).toThrow('directory traversal');
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Path separator rejection
    // ─────────────────────────────────────────────────────────────────────
    describe('path separator rejection', () => {
      test('rejects forward slash', () => {
        expect(() => validatePersonaName('persona/sub')).toThrow('path separator');
      });

      test('rejects backslash', () => {
        expect(() => validatePersonaName('persona\\sub')).toThrow('path separator');
      });

      test('rejects absolute path', () => {
        expect(() => validatePersonaName('/etc/passwd')).toThrow('path separator');
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Null byte rejection
    // ─────────────────────────────────────────────────────────────────────
    describe('null byte rejection', () => {
      test('rejects null byte in name', () => {
        expect(() => validatePersonaName('persona\x00.md')).toThrow('null byte');
      });

      test('rejects embedded null byte', () => {
        expect(() => validatePersonaName('foo\x00bar')).toThrow('null byte');
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Empty/null rejection
    // ─────────────────────────────────────────────────────────────────────
    describe('empty and null rejection', () => {
      test('rejects null', () => {
        expect(() => validatePersonaName(null)).toThrow('non-empty string');
      });

      test('rejects undefined', () => {
        expect(() => validatePersonaName(undefined)).toThrow('non-empty string');
      });

      test('rejects empty string', () => {
        expect(() => validatePersonaName('')).toThrow('non-empty string');
      });

      test('rejects whitespace-only string', () => {
        expect(() => validatePersonaName('   ')).toThrow('non-empty string');
      });

      test('rejects number', () => {
        expect(() => validatePersonaName(42)).toThrow('non-empty string');
      });

      test('rejects object', () => {
        expect(() => validatePersonaName({})).toThrow('non-empty string');
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // PERSONAS_DIR export
    // ─────────────────────────────────────────────────────────────────────
    test('exports PERSONAS_DIR as absolute path', () => {
      expect(PERSONAS_DIR).toBeDefined();
      expect(typeof PERSONAS_DIR).toBe('string');
      expect(PERSONAS_DIR).toContain('personas');
    });
  });
});
