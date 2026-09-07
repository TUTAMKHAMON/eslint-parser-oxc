/**
 * Benchmark: this parser against @babel/eslint-parser and typescript-eslint.
 *
 *   node bench/run.mjs [corpus] [maxFiles]
 *
 * Parse time and total lint time are reported separately, because rule
 * execution dominates a real lint run and a faster parser only moves its own
 * share of the wall clock.
 */

import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import react from 'eslint-plugin-react';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';

import { formatRow, loadCorpus, measure, parseAll } from './lib/harness.mjs';
import { lintOnce } from './lib/lint-bench.mjs';
import { babelParser, oxcParser } from './parsers.mjs';

const corpus = resolve(process.argv[2] ?? join(import.meta.dirname, '..', 'conformance', 'fixtures'));
const maxFiles = Number(process.argv[3] ?? Infinity);

const files = loadCorpus(corpus, { maxFiles });
const bytes = files.reduce((total, file) => total + Buffer.byteLength(file.code), 0);
console.log(`Corpus: ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB — ${corpus}\n`);

const rows = [];
const notes = [];

for (const factory of [oxcParser, babelParser]) {
  const subject = await factory();
  let failed = 0;
  const parseMs = await measure(() => {
    failed = parseAll(files, subject.parse);
  });
  const lintMs = await measure(
    () =>
      lintOnce({
        parser: subject.parser,
        parserName: subject.label,
        languageOptions: subject.languageOptions,
        react,
        importX,
        jsxA11y,
        files,
        corpus,
      }),
    { runs: 3, warmup: 1 },
  );
  rows.push(formatRow(subject.label, parseMs, lintMs, files.length, bytes));
  if (failed > 0) notes.push(`${subject.label}: ${failed} file(s) failed to parse`);
}

try {
  const output = execFileSync('node', ['bench.mjs', corpus, String(maxFiles)], {
    cwd: join(import.meta.dirname, '..', 'conformance', 'reference'),
    encoding: 'utf8',
  });
  const reference = JSON.parse(output);
  rows.push(formatRow(reference.label, reference.parseMs, reference.lintMs, files.length, bytes));
  if (reference.failed > 0) notes.push(`${reference.label}: ${reference.failed} file(s) failed to parse`);
} catch (error) {
  notes.push(`typescript-eslint benchmark skipped: ${String(error.message).split('\n')[0]}`);
}

console.table(rows);
const baseline = Number(rows[0]?.['parse (ms)']);
for (const row of rows.slice(1)) {
  console.log(`${row.parser} parses ${(Number(row['parse (ms)']) / baseline).toFixed(2)}× slower than eslint-parser-oxc`);
}
for (const note of notes) console.log(note);
