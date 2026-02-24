/**
 * Unit Tests: Soul Marker Extractor
 *
 * Tests for compute/soul-marker-extractor.js
 * Feature: 003-voice-fidelity
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// Mock fs/promises — avoid reading actual files in unit tests
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_HEGEL_MD = `# G.W.F. Hegel — O Dialético

> "A verdade é o todo."

## Dados Vitais
- **Stuttgart, 1770 – Berlim, 1831**
- Filósofo alemão, idealista absoluto

## Sistema

O real é racional. A razão move-se por **contradição**.

### Conceitos-Chave
| Termo | Significado |
|-------|-------------|
| **Aufhebung** | Superar + preservar + elevar |
| **Geist** | Espírito — consciência coletiva |
| **An sich / Für sich** | Em si / Para si |

## Método Hegeliano
\`\`\`
TESE      → posição inicial
ANTÍTESE  → negação
SÍNTESE   → superação (Aufhebung)
\`\`\`

## Quando Invocar
- **Impasses** entre posições opostas

## Voz

Densa, abstrata, frases longas. Parece obscuro até fazer sentido — depois, parece óbvio.

### Exemplo de Resposta

**Pergunta:** Liberdade ou bem coletivo?

**Hegel:**
> A pergunta já contém sua dissolução. "Liberdade individual" abstrata é vazia — um átomo sem mundo.

---

## Tom no Bar

Hegel fala por quarenta minutos sem pausa. Ninguém interrompe — não por respeito, mas por exaustão.
`;

const MOCK_SUBDIRS = [
  { name: 'philosophers', isDirectory: () => true },
  { name: 'magicians', isDirectory: () => true },
  { name: 'portuguese', isDirectory: () => true },
];

const MOCK_PHILOSOPHER_FILES = ['hegel.md', 'socrates.md', 'diogenes.md'];
const MOCK_MAGICIAN_FILES = ['moore.md', 'crowley.md', 'dee.md'];
const MOCK_PORTUGUESE_FILES = ['pessoa.md', 'caeiro.md', 'reis.md'];

jest.unstable_mockModule('fs/promises', () => ({
  readdir: jest.fn(async (dirPath, options) => {
    if (options && options.withFileTypes) {
      return MOCK_SUBDIRS;
    }
    if (dirPath.endsWith('philosophers')) return MOCK_PHILOSOPHER_FILES;
    if (dirPath.endsWith('magicians')) return MOCK_MAGICIAN_FILES;
    if (dirPath.endsWith('portuguese')) return MOCK_PORTUGUESE_FILES;
    return [];
  }),
  readFile: jest.fn(async (filePath) => {
    if (filePath.includes('hegel.md')) {
      return MOCK_HEGEL_MD;
    }
    throw new Error(`ENOENT: no such file: ${filePath}`);
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// Import module under test (after mocks are registered)
// ═══════════════════════════════════════════════════════════════════════════

let loadPersonaMarkers, getUniversalForbiddenPhrases, clearCache;
let mockReaddir, mockReadFile;

beforeAll(async () => {
  const module = await import('../../compute/soul-marker-extractor.js');
  loadPersonaMarkers = module.loadPersonaMarkers;
  getUniversalForbiddenPhrases = module.getUniversalForbiddenPhrases;
  clearCache = module.clearCache;

  const fsMock = await import('fs/promises');
  mockReaddir = fsMock.readdir;
  mockReadFile = fsMock.readFile;
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Soul Marker Extractor', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getUniversalForbiddenPhrases
  // ─────────────────────────────────────────────────────────────────────────

  describe('getUniversalForbiddenPhrases()', () => {
    it('returns a non-empty array of strings', () => {
      const phrases = getUniversalForbiddenPhrases();
      expect(Array.isArray(phrases)).toBe(true);
      expect(phrases.length).toBeGreaterThan(0);
      for (const phrase of phrases) {
        expect(typeof phrase).toBe('string');
      }
    });

    it('includes known AI self-reference phrases', () => {
      const phrases = getUniversalForbiddenPhrases();
      expect(phrases).toContain('as an ai');
      expect(phrases).toContain('as a language model');
      expect(phrases).toContain('as an artificial intelligence');
      expect(phrases).toContain("i'm just an ai");
    });

    it('includes known generic helpfulness phrases', () => {
      const phrases = getUniversalForbiddenPhrases();
      expect(phrases).toContain("i'd be happy to");
      expect(phrases).toContain('great question');
      expect(phrases).toContain('certainly');
      expect(phrases).toContain('absolutely');
      expect(phrases).toContain('of course');
    });

    it('includes known hedging/disclaimer phrases', () => {
      const phrases = getUniversalForbiddenPhrases();
      expect(phrases).toContain("it's important to note");
      expect(phrases).toContain('i should mention');
      expect(phrases).toContain('i apologize');
      expect(phrases).toContain('please note that');
    });

    it('returns all phrases in lowercase', () => {
      const phrases = getUniversalForbiddenPhrases();
      for (const phrase of phrases) {
        expect(phrase).toBe(phrase.toLowerCase());
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // loadPersonaMarkers
  // ─────────────────────────────────────────────────────────────────────────

  describe('loadPersonaMarkers()', () => {
    it('returns correct shape for a known persona', async () => {
      const markers = await loadPersonaMarkers('hegel');

      expect(markers).toBeDefined();
      expect(Array.isArray(markers.vocabulary)).toBe(true);
      expect(Array.isArray(markers.toneMarkers)).toBe(true);
      expect(Array.isArray(markers.patterns)).toBe(true);
      expect(Array.isArray(markers.forbidden)).toBe(true);
    });

    it('extracts vocabulary terms from persona file', async () => {
      const markers = await loadPersonaMarkers('hegel');

      // Should find bold terms and table keys
      expect(markers.vocabulary.length).toBeGreaterThan(0);

      // Should include table keys like Aufhebung, Geist
      const vocabLower = markers.vocabulary.map(v => v.toLowerCase());
      expect(vocabLower).toContain('aufhebung');
      expect(vocabLower).toContain('geist');
    });

    it('extracts the opening quote as vocabulary', async () => {
      const markers = await loadPersonaMarkers('hegel');

      const hasQuote = markers.vocabulary.some(v => v.includes('verdade'));
      expect(hasQuote).toBe(true);
    });

    it('extracts tone markers from voice section', async () => {
      const markers = await loadPersonaMarkers('hegel');

      expect(markers.toneMarkers.length).toBeGreaterThan(0);
      // The voice section for Hegel mentions "Densa, abstrata, frases longas"
      const toneLower = markers.toneMarkers.map(t => t.toLowerCase());
      const hasDense = toneLower.some(t => t.includes('densa') || t.includes('abstrata'));
      expect(hasDense).toBe(true);
    });

    it('extracts patterns (em dashes) from persona content', async () => {
      const markers = await loadPersonaMarkers('hegel');

      // Hegel's file uses em dashes (—) extensively
      const emDashPattern = markers.patterns.find(p => p.name === 'uses_em_dashes');
      expect(emDashPattern).toBeDefined();
      expect(emDashPattern.regex).toBe('—');
    });

    it('returns default markers for unknown persona', async () => {
      const markers = await loadPersonaMarkers('nonexistent_persona');

      expect(markers).toBeDefined();
      expect(markers.vocabulary).toEqual([]);
      expect(markers.toneMarkers).toEqual([]);
      expect(markers.patterns).toEqual([]);
      expect(markers.forbidden).toEqual([]);
    });

    it('caches results — second call does not re-read file', async () => {
      // First call
      await loadPersonaMarkers('hegel');
      const readCallCount = mockReadFile.mock.calls.length;

      // Second call
      await loadPersonaMarkers('hegel');

      // readFile should NOT have been called again
      expect(mockReadFile.mock.calls.length).toBe(readCallCount);
    });

    it('handles case-insensitive persona names', async () => {
      const lower = await loadPersonaMarkers('hegel');
      clearCache();
      const upper = await loadPersonaMarkers('HEGEL');

      // Both should find the same persona and have the same shape
      expect(lower.vocabulary.length).toBe(upper.vocabulary.length);
    });

    it('does not cache default markers for unknown personas (allows retry)', async () => {
      await loadPersonaMarkers('ghost');
      const readdirCount = mockReaddir.mock.calls.length;

      await loadPersonaMarkers('ghost');

      // Should re-scan directories because failure states are not cached
      expect(mockReaddir.mock.calls.length).toBeGreaterThan(readdirCount);
    });
  });
});
