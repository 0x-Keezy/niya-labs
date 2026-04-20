#!/usr/bin/env node
// Scans extension/src/ for banned vocabulary per Niya brand guidelines.
// Exit code 1 if any found. Wired into `npm run build` as a pre-step.
//
// Only flags standalone user-visible text. Ignores:
// - Comments (lines starting with // or * after trim)
// - HTML attributes (target=, entry of ResizeObserver)
// - JS identifiers where the word is part of a camelCase compound
// - The linter itself and vocab.ts

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Words banned from user-visible UI text.
const BANNED_UI = [
  'support',
  'resistance',
  'fibonacci',
  'order block',
  'CHoCH',
  'BOS',
  'FVG',
  'SMC',
  'ICT',
  'DTFX',
];

// Files where banned words are expected (the linter itself, vocab constants).
const IGNORED_FILES = ['check-banned.js', 'vocab.ts'];

const EXTS = new Set(['.ts', '.tsx']);

function walk(dir) {
  const results = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (e === 'node_modules' || e === 'dist') continue;
      results.push(...walk(full));
    } else if (EXTS.has(extname(e))) {
      results.push(full);
    }
  }
  return results;
}

function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const srcDir = join(__dirname, '..', 'src');
const files = walk(srcDir);
let violations = 0;

for (const filePath of files) {
  const base = filePath.split(/[\\/]/).pop();
  if (IGNORED_FILES.includes(base)) continue;

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comment lines entirely — banned words in comments are fine.
    if (isComment(line)) continue;

    for (const word of BANNED_UI) {
      // Case-insensitive standalone word match.
      const re = new RegExp(`\\b${word}\\b`, 'i');
      if (!re.test(line)) continue;

      // Allow the word when it's part of a larger identifier (camelCase).
      // E.g., "detectSupportResistance" or "isSupportedDappUrl".
      const compoundRe = new RegExp(`[a-zA-Z_]${word}|${word}[a-zA-Z_]`, 'i');
      if (compoundRe.test(line)) continue;

      // If we get here, it's a standalone usage in non-comment code.
      console.log(`  BANNED "${word}" at ${filePath}:${i + 1}`);
      console.log(`    ${line.trim()}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.log(`\n${violations} banned-word violation(s) found.`);
  process.exit(1);
} else {
  console.log('Banned-words check passed.');
}
