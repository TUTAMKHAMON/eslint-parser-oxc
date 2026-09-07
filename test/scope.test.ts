/**
 * Scope analysis parity with typescript-eslint.
 *
 * The expectations in `scope-expectations.json` are captured from the reference
 * parser by `conformance/reference/scope.mjs`; this asserts that ESLint reaches
 * the same conclusions with the scope manager this parser hands it.
 */

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { CASES, RULES, fingerprint } from '../conformance/lib/scope-cases.mjs';
import expectations from './scope-expectations.json' with { type: 'json' };
import * as parser from '../src/index.ts';

const linter = new Linter();

describe('scope analysis', () => {
  for (const testCase of CASES) {
    it(`matches the reference for ${testCase.name}`, () => {
      const messages = linter.verify(
        testCase.code,
        {
          files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
          languageOptions: { parser: parser as never, ecmaVersion: 'latest', sourceType: 'module' },
          rules: RULES as Record<string, 'error'>,
        },
        testCase.file,
      );
      expect(fingerprint(messages)).toEqual(
        (expectations as Record<string, string[]>)[testCase.name],
      );
    });
  }

  it('covers every case with a captured expectation', () => {
    expect(Object.keys(expectations).sort()).toEqual(CASES.map((c) => c.name).sort());
  });
});
