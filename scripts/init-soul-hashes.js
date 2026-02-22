#!/usr/bin/env node
/**
 * Initialize Soul Hashes
 *
 * Scans all .md files in personas/ subdirectories, computes SHA-256 hashes,
 * and writes them to personas/.soul-hashes.json.
 *
 * Used to verify soul file integrity per Constitution Principle I.
 *
 * Usage:
 *   node scripts/init-soul-hashes.js
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const personasDir = join(projectRoot, 'personas');

function collectMarkdownFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectMarkdownFiles(fullPath, files);
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function hashFile(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function main() {
  const files = collectMarkdownFiles(personasDir);
  files.sort();

  console.log(`[SoulHashes] Hashing ${files.length} persona files...`);

  const hashes = {};
  for (const filePath of files) {
    const relativePath = relative(personasDir, filePath);
    const hash = hashFile(filePath);
    hashes[relativePath] = hash;
    console.log(`[SoulHashes] ${relativePath} \u2192 ${hash.slice(0, 12)}...`);
  }

  const outputPath = join(personasDir, '.soul-hashes.json');
  writeFileSync(outputPath, JSON.stringify(hashes, null, 2) + '\n');
  console.log(`[SoulHashes] Written to personas/.soul-hashes.json`);
}

main();
