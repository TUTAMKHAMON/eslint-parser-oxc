/**
 * Syntax errors have to reach ESLint as a thrown error carrying `lineNumber`
 * and `column`, which ESLint's JS language reads verbatim with `columnStart: 0`.
 */

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { OxcSyntaxError, parse } from '../src/index.ts';
import * as parser from '../src/index.ts';

describe('syntax errors', () => {
  it('throws an error carrying a 1-based line and a 0-based column', () => {
    let thrown: unknown;
    try {
      parse('const a = ;\nconst b = 1;\n', { filePath: 'a.ts' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(OxcSyntaxError);
    const error = thrown as OxcSyntaxError;
    expect(error.lineNumber).toBe(1);
    expect(error.column).toBe(10);
    expect(error.index).toBe(10);
  });

  it('is reported by ESLint as a fatal message at the right place', () => {
    const messages = new Linter().verify(
      'const a = ;\n',
      {
        files: ['**/*.{js,ts}'],
        languageOptions: { parser: parser as never, ecmaVersion: 'latest', sourceType: 'module' },
        rules: {},
      },
      'a.ts',
    );

    expect(messages).toHaveLength(1);
    // The same line and column typescript-eslint produces for this input: ESLint
    // passes a parser's `lineNumber`/`column` through untouched.
    expect(messages[0]).toMatchObject({ fatal: true, severity: 2, line: 1, column: 10 });
    expect(messages[0]?.message).toMatch(/^Parsing error: /);
  });

  it('points at the right line in a file with emoji before the error', () => {
    let thrown: OxcSyntaxError | undefined;
    try {
      parse('const a = "🎉🎉🎉";\nconst b = ;\n', { filePath: 'a.ts' });
    } catch (error) {
      thrown = error as OxcSyntaxError;
    }
    expect(thrown?.lineNumber).toBe(2);
    expect(thrown?.column).toBe(10);
  });

  it('does not throw for a file that only has warnings', () => {
    expect(() => parse('const a = 1;\n', { filePath: 'a.ts' })).not.toThrow();
  });
});
