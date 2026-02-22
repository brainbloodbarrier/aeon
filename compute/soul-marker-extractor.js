/**
 * AEON Matrix - Soul Marker Extractor
 *
 * Extracts vocabulary, tone patterns, and characteristic phrases
 * from persona soul files (.md) for voice drift detection.
 *
 * Reads persona markdown files directly — no database access required.
 *
 * Feature: 003-voice-fidelity
 * Constitution: Principle III (Voice Fidelity)
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ═══════════════════════════════════════════════════════════════════════════
// Path Resolution
// ═══════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PERSONAS_DIR = join(__dirname, '..', 'personas');

// ═══════════════════════════════════════════════════════════════════════════
// Cache
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Map<string, Object>} Cached markers per persona name */
const markersCache = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// Universal Forbidden Phrases
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Universal forbidden phrases — generic AI patterns that no historical
 * persona should ever produce. All lowercase for case-insensitive matching.
 */
const UNIVERSAL_FORBIDDEN_PHRASES = [
  // AI self-reference
  'as an ai',
  'as a language model',
  'as an artificial intelligence',
  "i'm just an ai",
  // Generic helpfulness
  "i'd be happy to",
  'great question',
  'certainly',
  'absolutely',
  'of course',
  // Hedging / disclaimers
  "it's important to note",
  'i should mention',
  'i apologize',
  'please note that',
];

/**
 * Returns the universal forbidden phrases list for generic AI detection.
 *
 * @returns {string[]} Array of lowercase forbidden phrases
 */
export function getUniversalForbiddenPhrases() {
  return UNIVERSAL_FORBIDDEN_PHRASES;
}

// ═══════════════════════════════════════════════════════════════════════════
// Persona File Discovery
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find a persona's .md file by searching all subdirectories of /personas/.
 *
 * @param {string} personaName - Name of the persona (e.g. 'hegel', 'moore')
 * @returns {Promise<string|null>} Full path to the persona file, or null
 */
async function findPersonaFile(personaName) {
  const normalizedName = personaName.toLowerCase().trim();

  try {
    const subdirs = await readdir(PERSONAS_DIR, { withFileTypes: true });

    for (const entry of subdirs) {
      if (!entry.isDirectory()) continue;

      const subdirPath = join(PERSONAS_DIR, entry.name);
      const files = await readdir(subdirPath);

      for (const file of files) {
        if (file.toLowerCase() === `${normalizedName}.md`) {
          return join(subdirPath, file);
        }
      }
    }
  } catch (error) {
    console.error(`[SoulMarkerExtractor] Error searching for persona "${personaName}":`, error.message);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown Parsing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract a named section from markdown content (## heading to next ## or EOF).
 *
 * @param {string} content - Full markdown content
 * @param {RegExp} headingPattern - Pattern matching the section heading
 * @returns {string|null} Section content (without heading), or null
 */
function extractSection(content, headingPattern) {
  const lines = content.split('\n');
  let capturing = false;
  const captured = [];

  for (const line of lines) {
    if (capturing) {
      // Stop at next H2 or H1
      if (/^#{1,2}\s+/.test(line)) break;
      captured.push(line);
    } else if (headingPattern.test(line)) {
      capturing = true;
    }
  }

  if (captured.length === 0) return null;
  return captured.join('\n').trim();
}

/**
 * Extract key-value pairs from a markdown table.
 *
 * @param {string} tableText - Markdown table text
 * @returns {Array<{key: string, value: string}>} Parsed rows
 */
function parseTable(tableText) {
  const rows = [];
  const lines = tableText.split('\n');

  for (const line of lines) {
    // Skip header separator (---|---)
    if (/^\s*\|?\s*-+/.test(line)) continue;
    // Match table rows: | key | value |
    const match = line.match(/\|\s*\*?\*?(.+?)\*?\*?\s*\|\s*(.+?)\s*\|/);
    if (match) {
      rows.push({ key: match[1].replace(/\*\*/g, '').trim(), value: match[2].trim() });
    }
  }

  return rows;
}

/**
 * Extract vocabulary terms from a section of text.
 * Looks for bold terms, table keys, and uppercase label lines (e.g. 'TESE -> ...').
 *
 * @param {string} text - Section text
 * @returns {string[]} Extracted terms
 */
function extractTerms(text) {
  const terms = [];

  // Bold terms (**term**)
  const boldMatches = text.matchAll(/\*\*(.+?)\*\*/g);
  for (const m of boldMatches) {
    const term = m[1].trim();
    // Skip very long phrases or purely descriptive text
    if (term.length > 0 && term.length <= 60) {
      terms.push(term);
    }
  }

  // Code-block lines that look like key terms (e.g. "TESE → ...")
  const codeLines = text.matchAll(/^([A-ZÁÉÍÓÚÂÊÃÕÇ][A-ZÁÉÍÓÚÂÊÃÕÇ\s/]+?)(?:\s*[→:=\-\(]|$)/gm);
  for (const m of codeLines) {
    const term = m[1].trim();
    if (term.length > 1 && term.length <= 40) {
      terms.push(term);
    }
  }

  return [...new Set(terms)];
}

/**
 * Extract tone indicators from the Voz/Voice section.
 *
 * @param {string} voiceText - Content of the Voice section
 * @returns {string[]} Tone descriptors
 */
function extractToneMarkers(voiceText) {
  if (!voiceText) return [];

  const markers = [];

  // The voice section typically has comma-separated descriptors in the first paragraph
  const firstParagraph = voiceText.split('\n\n')[0] || voiceText.split('\n')[0];
  if (firstParagraph) {
    // Split on commas and periods, clean up
    const fragments = firstParagraph.split(/[,.]/).map(f => f.trim()).filter(f => f.length > 0 && f.length < 80);
    markers.push(...fragments);
  }

  return markers;
}

/**
 * Extract characteristic speech patterns from example responses.
 *
 * @param {string} content - Full markdown content
 * @returns {Array<{name: string, regex: string}>} Pattern objects for drift detection
 */
function extractPatterns(content) {
  const patterns = [];

  // Check for blockquote responses (> text) — these contain the persona's voice samples
  const blockquotes = content.matchAll(/^>\s+(.+)/gm);
  const quotes = [];
  for (const m of blockquotes) {
    quotes.push(m[1].trim());
  }

  // If persona uses Portuguese extensively, add a pattern for non-English vocabulary
  const portugueseTerms = content.match(/[áéíóúâêãõçÁÉÍÓÚÂÊÃÕÇ]/g);
  if (portugueseTerms && portugueseTerms.length > 10) {
    patterns.push({
      name: 'uses_special_characters',
      regex: '[áéíóúâêãõçÁÉÍÓÚÂÊÃÕÇ]'
    });
  }

  // Check for characteristic punctuation patterns
  // Em dash usage (—)
  if ((content.match(/—/g) || []).length > 3) {
    patterns.push({
      name: 'uses_em_dashes',
      regex: '—'
    });
  }

  return patterns;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Export: loadPersonaMarkers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default markers returned when a persona file cannot be found.
 * Still enables universal AI detection even without persona-specific data.
 */
const DEFAULT_MARKERS = {
  vocabulary: [],
  toneMarkers: [],
  patterns: [],
  forbidden: [],
};

/**
 * Load and extract voice markers from a persona's soul file.
 *
 * Searches all subdirectories of /personas/ for the matching .md file,
 * parses the markdown structure, and extracts vocabulary, tone markers,
 * domain terms, and characteristic patterns.
 *
 * Results are cached per persona name (loaded once, reused).
 *
 * @param {string} personaName - Name of the persona (e.g. 'hegel', 'moore')
 * @returns {Promise<Object>} Markers object: { vocabulary, toneMarkers, patterns, forbidden }
 */
export async function loadPersonaMarkers(personaName) {
  const cacheKey = personaName.toLowerCase().trim();

  // Return cached markers if available
  if (markersCache.has(cacheKey)) {
    return markersCache.get(cacheKey);
  }

  // Find the persona file
  const filePath = await findPersonaFile(personaName);

  if (!filePath) {
    console.error(`[SoulMarkerExtractor] Persona file not found for "${personaName}"`);
    markersCache.set(cacheKey, DEFAULT_MARKERS);
    return DEFAULT_MARKERS;
  }

  try {
    const content = await readFile(filePath, 'utf8');

    // Extract sections
    const systemSection = extractSection(content, /^##\s+(Sistema|System)\b/mi);
    const methodSection = extractSection(content, /^##\s+(Método|Method|Filosofia|Natureza)\b/mi);
    const voiceSection = extractSection(content, /^##\s+(Voz|Voice)\b/mi);
    const barSection = extractSection(content, /^##\s+(Tom no Bar|Bar)\b/mi);
    const conceptsSection = extractSection(content, /^###?\s+(Conceitos-Chave|Conceitos|Características|Princípios|Núcleo)\b/mi);

    // Build vocabulary from multiple sources
    const vocabulary = [];

    // From system/method/concepts sections — key terms
    if (systemSection) vocabulary.push(...extractTerms(systemSection));
    if (methodSection) vocabulary.push(...extractTerms(methodSection));
    if (conceptsSection) vocabulary.push(...extractTerms(conceptsSection));

    // Table entries from concepts
    const fullContent = [systemSection, methodSection, conceptsSection].filter(Boolean).join('\n');
    const tableRows = parseTable(fullContent);
    for (const row of tableRows) {
      if (row.key.length > 0 && row.key.length <= 40) {
        vocabulary.push(row.key);
      }
    }

    // Extract opening quote as a key phrase
    const quoteMatch = content.match(/^>\s+"(.+)"/m);
    if (quoteMatch) {
      vocabulary.push(quoteMatch[1]);
    }

    // Tone markers from voice section
    const toneMarkers = extractToneMarkers(voiceSection);

    // If there's a bar section, extract tone from it too
    if (barSection) {
      const barTone = extractToneMarkers(barSection);
      toneMarkers.push(...barTone);
    }

    // Patterns from example responses and structural markers
    const patterns = extractPatterns(content);

    // Deduplicate vocabulary
    const uniqueVocabulary = [...new Set(vocabulary)];

    const markers = {
      vocabulary: uniqueVocabulary,
      toneMarkers,
      patterns,
      forbidden: [],
    };

    markersCache.set(cacheKey, markers);
    return markers;

  } catch (error) {
    console.error(`[SoulMarkerExtractor] Error reading persona file for "${personaName}":`, error.message);
    markersCache.set(cacheKey, DEFAULT_MARKERS);
    return DEFAULT_MARKERS;
  }
}

/**
 * Clear the markers cache. Useful for testing or when persona files change.
 */
export function clearCache() {
  markersCache.clear();
}
