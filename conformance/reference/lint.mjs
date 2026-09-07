/** Lint a corpus with the reference parser (typescript-eslint on TypeScript 6). */

import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import js from '@eslint/js';
import * as parser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';

import { lintCorpus } from '../lib/lint-run.mjs';

const corpus = resolve(process.argv[2] ?? join(import.meta.dirname, '..', 'fixtures'));
const out = resolve(process.argv[3] ?? join(import.meta.dirname, '..', '.lint-reference.json'));
const fix = process.argv.includes('--fix');

const summary = await lintCorpus({
  ESLint, js, parser, parserName: '@typescript-eslint/parser',
  react, importX, jsxA11y, corpus, out, fix,
});
console.log(`reference: ${summary.findings} findings over ${summary.files} files -> ${out}`);
