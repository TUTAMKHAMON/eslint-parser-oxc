/**
 * Capture the reference parser's scope-analysis findings for the shared cases,
 * so the unit test can assert parity without needing `typescript` installed.
 */

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Linter } from 'eslint';
import * as parser from '@typescript-eslint/parser';

import { CASES, RULES, fingerprint } from '../lib/scope-cases.mjs';

const linter = new Linter();
const expectations = {};

for (const testCase of CASES) {
  const messages = linter.verify(
    testCase.code,
    {
      files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
      languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module' },
      rules: RULES,
    },
    testCase.file,
  );
  expectations[testCase.name] = fingerprint(messages);
}

const out = resolve(join(import.meta.dirname, '..', '..', 'test', 'scope-expectations.json'));
writeFileSync(out, `${JSON.stringify(expectations, null, 2)}\n`);
console.log(`wrote ${Object.keys(expectations).length} scope expectations to ${out}`);
