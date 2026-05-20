#!/usr/bin/env node

import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const personasDir = join(root, 'personas');
const hashesPath = join(personasDir, '.soul-hashes.json');

const sectionMatchers = {
  voice: /^##\s+(Voz|Voice)\b/m,
  method: /^##\s+(Metodo|M[eé]todo|Sistema|Filosofia|Natureza|Funcao|Fun[cç][aã]o|Mito|Hermetismo|Dominios|Dom[ií]nios|Manifestacoes|Manifesta[cç][oõ]es|Origem|Transformacao|Transforma[cç][aã]o|O Paradoxo|O Sistema|O Escandalo|O Esc[aâ]ndalo|Significados)\b/m,
  invocation: /^##\s+(Quando Invocar|Quando Aparece|Como Usar|When)\b/m,
  bar: /^##\s+(Tom no Bar|Bar|Os Heteronimos|Os Heter[oô]nimos)\b/m
};

function collectPersonaFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectPersonaFiles(fullPath, files);
      continue;
    }
    if (!entry.endsWith('.md')) continue;
    if (entry === 'AGENTS.md') continue;
    files.push(fullPath);
  }
  return files.sort();
}

function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

function validatePersonaFile(filePath, content, hashes) {
  const relPath = relative(personasDir, filePath);
  const errors = [];
  const trimmed = content.trim();

  if (!trimmed.startsWith('# ')) {
    errors.push('missing H1 title');
  }

  if (trimmed.length < 100) {
    errors.push('content shorter than 100 chars');
  }

  for (const [name, regex] of Object.entries(sectionMatchers)) {
    if (!regex.test(content)) {
      errors.push(`missing required ${name} section`);
    }
  }

  const expectedHash = hashes[relPath];
  if (!expectedHash) {
    errors.push('missing entry in personas/.soul-hashes.json');
  } else {
    const actualHash = hashContent(content);
    if (actualHash !== expectedHash) {
      errors.push('hash mismatch (run npm run init-hashes)');
    }
  }

  return { relPath, errors };
}

function main() {
  let hashes;
  try {
    hashes = JSON.parse(readFileSync(hashesPath, 'utf-8'));
  } catch (error) {
    console.error(`[verify-personas] Failed to read ${relative(root, hashesPath)}: ${error.message}`);
    process.exit(1);
  }

  const files = collectPersonaFiles(personasDir);
  const results = files.map((filePath) => {
    const content = readFileSync(filePath, 'utf-8');
    return validatePersonaFile(filePath, content, hashes);
  });

  const failures = results.filter((result) => result.errors.length > 0);

  console.log(`[verify-personas] Checked ${results.length} persona files`);
  for (const result of results) {
    if (result.errors.length === 0) {
      console.log(`PASS ${result.relPath}`);
    } else {
      console.log(`FAIL ${result.relPath}`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }
  }

  const hashEntries = Object.keys(hashes).filter((key) => key.endsWith('.md'));
  const fileSet = new Set(results.map((result) => result.relPath));
  const staleEntries = hashEntries.filter((entry) => !fileSet.has(entry));
  for (const stale of staleEntries) {
    console.log(`FAIL ${stale}`);
    console.log('  - stale hash entry with no matching persona file');
  }

  if (failures.length > 0 || staleEntries.length > 0) {
    console.error(`[verify-personas] ${failures.length + staleEntries.length} file(s) failed persona verification`);
    process.exit(1);
  }

  console.log('[verify-personas] Persona integrity OK');
}

main();
