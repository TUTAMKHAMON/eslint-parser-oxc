/**
 * Benchmark the reference parser, in the install that has `typescript`.
 * Prints one JSON line for `bench/run.mjs` to merge.
 */

import { resolve } from 'node:path';
import * as parser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';

import { loadCorpus, measure, parseAll } from '../../bench/lib/harness.mjs';
import { lintOnce } from '../../bench/lib/lint-bench.mjs';

const corpus = resolve(process.argv[2]);
const maxFiles = Number(process.argv[3] ?? Infinity);
const files = loadCorpus(corpus, { maxFiles });

let failed = 0;
const parseMs = await measure(() => {
  failed = parseAll(files, (file) =>
    parser.parseForESLint(file.code, {
      filePath: file.filePath,
      ecmaVersion: 'latest',
      sourceType: 'module',
      range: true,
      loc: true,
      comment: true,
      tokens: true,
      ecmaFeatures: { jsx: !/\.[cm]?ts$/.test(file.filePath) },
    }),
  );
});

const lintMs = await measure(
  () => lintOnce({ parser, parserName: '@typescript-eslint/parser', react, importX, jsxA11y, files, corpus }),
  { runs: 3, warmup: 1 },
);

process.stdout.write(JSON.stringify({ label: '@typescript-eslint/parser (TypeScript 6)', parseMs, lintMs, failed }));
