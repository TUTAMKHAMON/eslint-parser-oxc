/**
 * Write reference parses to disk.
 *
 * Runs from `conformance/reference`, the only place `typescript` is installed,
 * and writes one normalised JSON snapshot per fixture. The runner at the repo
 * root then compares against these without ever loading `typescript`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseForESLint } from '@typescript-eslint/parser';

import { collect } from '../lib/corpus.mjs';
import { normalize } from '../lib/normalize.mjs';

const [, , corpusArg, outArg] = process.argv;
const corpus = resolve(corpusArg ?? join(import.meta.dirname, '..', 'fixtures'));
const outDir = resolve(outArg ?? join(import.meta.dirname, '..', '.snapshots'));
const limit = Number(process.argv[5] ?? Infinity);

const files = collect(corpus, { maxFiles: limit });
const index = [];

for (const relPath of files) {
  const full = join(corpus, relPath);
  const code = readFileSync(full, 'utf8');
  const jsx = !/\.[cm]?ts$/.test(relPath);
  let record;
  try {
    const { ast } = parseForESLint(code, {
      filePath: full,
      ecmaVersion: 'latest',
      sourceType: /\.cjs$/.test(relPath) ? 'commonjs' : 'module',
      range: true,
      loc: true,
      comment: true,
      tokens: true,
      ecmaFeatures: { jsx },
    });
    record = { ok: true, ast: normalize(ast) };
  } catch (error) {
    record = {
      ok: false,
      error: { message: error.message, lineNumber: error.lineNumber, column: error.column, index: error.index },
    };
  }
  const target = join(outDir, `${relPath}.json`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(record));
  index.push(relPath);
}

writeFileSync(join(outDir, 'index.json'), JSON.stringify({ corpus, files: index }, null, 2));
console.log(`snapshotted ${index.length} files from ${corpus}`);
