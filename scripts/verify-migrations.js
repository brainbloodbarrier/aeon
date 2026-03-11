#!/usr/bin/env node

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const migrationsDir = join(root, 'db', 'migrations');
const knownHistoricalGaps = new Set([3, 4, 5, 7]);
const destructivePatterns = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /SET\s+embedding\s*=\s*NULL/i,
  /ALTER\s+COLUMN\s+.*\s+TYPE\b/i
];

function parseMigration(filename) {
  const match = filename.match(/^(\d{3})_(.+)\.sql$/);
  if (!match) return null;
  return {
    filename,
    number: Number(match[1]),
    slug: match[2]
  };
}

function main() {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const parsed = files.map(parseMigration);
  const invalid = parsed.filter((entry) => entry === null);

  if (invalid.length > 0) {
    console.error('[verify-migrations] Invalid migration filenames detected');
    for (const name of files.filter((file) => !parseMigration(file))) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }

  const entries = parsed;
  const numbers = entries.map((entry) => entry.number);
  const duplicates = numbers.filter((num, index) => numbers.indexOf(num) !== index);
  if (duplicates.length > 0) {
    console.error(`[verify-migrations] Duplicate migration numbers: ${[...new Set(duplicates)].join(', ')}`);
    process.exit(1);
  }

  const unexpectedGaps = [];
  for (let i = 1; i < numbers.length; i += 1) {
    const previous = numbers[i - 1];
    const current = numbers[i];
    for (let gap = previous + 1; gap < current; gap += 1) {
      if (!knownHistoricalGaps.has(gap)) {
        unexpectedGaps.push(gap);
      }
    }
  }

  if (unexpectedGaps.length > 0) {
    console.error(`[verify-migrations] Unexpected migration gaps: ${unexpectedGaps.join(', ')}`);
    process.exit(1);
  }

  const highest = numbers[numbers.length - 1] || 0;
  const nextNumber = String(highest + 1).padStart(3, '0');

  console.log(`[verify-migrations] Checked ${entries.length} migration files`);
  console.log(`[verify-migrations] Highest migration: ${highest}`);
  console.log(`[verify-migrations] Next migration number: ${nextNumber}`);

  const warnings = [];
  for (const entry of entries) {
    const filePath = join(migrationsDir, entry.filename);
    const content = readFileSync(filePath, 'utf-8');
    for (const pattern of destructivePatterns) {
      if (pattern.test(content)) {
        warnings.push(`${entry.filename}: matches destructive pattern ${pattern}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log('[verify-migrations] WARNINGS');
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  console.log('[verify-migrations] Migration numbering and basic sanity OK');
}

main();
