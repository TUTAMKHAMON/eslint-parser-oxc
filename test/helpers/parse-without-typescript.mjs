/**
 * Parse and lint a TSX file with every hook in place, in a process where
 * resolving `typescript` throws. Prints a JSON summary for the test to assert.
 */

import { Linter } from 'eslint';
import * as parser from '../../dist/index.mjs';

const code = [
  "import React, { type ReactNode } from 'react';",
  'enum Direction { Up, Down }',
  'namespace Space { export const value = 1; }',
  'interface Props { children?: ReactNode }',
  'const ubrugt = 42;',
  'export const El = ({ children }: Props) => <div aria-label="Hovedindhold">{children} 🎉</div>;',
  'export { Direction, Space };',
].join('\n');

const result = parser.parseForESLint(code, { filePath: 'component.tsx' });

const messages = new Linter().verify(
  code,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module' },
    rules: { 'no-unused-vars': 'error', 'no-undef': 'error' },
  },
  'component.tsx',
);

process.stdout.write(
  JSON.stringify({
    program: result.ast.type,
    tokens: result.ast.tokens.length,
    comments: result.ast.comments.length,
    hasScopeManager: Boolean(result.scopeManager.globalScope),
    findings: messages.map((message) => `${message.ruleId ?? 'FATAL'}: ${message.message}`),
  }),
);
