/**
 * Install the packed tarball into a throwaway project that has no `typescript`
 * on disk at all, then run ESLint over a TSX file with it.
 *
 * The unit test in `test/no-typescript.test.ts` blocks `typescript` resolution
 * inside this repo; this proves the same thing against the published artefact,
 * including that `files`, `exports` and the dependency list are right.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'eslint-parser-oxc-'));

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

try {
  console.log('Building…');
  run('npm', ['run', 'build'], repo);

  console.log('Packing…');
  const tarball = run('npm', ['pack', '--pack-destination', scratch], repo).trim().split('\n').pop();

  writeFileSync(
    join(scratch, 'package.json'),
    `${JSON.stringify(
      {
        name: 'no-typescript-consumer',
        private: true,
        version: '0.0.0',
        type: 'module',
        dependencies: { eslint: '9.39.5', 'eslint-parser-oxc': `file:${join(scratch, tarball)}` },
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(scratch, 'eslint.config.mjs'),
    [
      "import * as oxcParser from 'eslint-parser-oxc';",
      '',
      'export default [',
      '  {',
      "    files: ['**/*.{ts,tsx}'],",
      "    languageOptions: { parser: oxcParser, ecmaVersion: 'latest', sourceType: 'module' },",
      "    rules: { 'no-unused-vars': 'error' },",
      '  },',
      '];',
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(scratch, 'component.tsx'),
    [
      "import React, { type ReactNode } from 'react';",
      'const ubrugt = 42;',
      'export const El = ({ children }: { children?: ReactNode }) => <div>{children} 🎉</div>;',
      '',
    ].join('\n'),
  );

  console.log('Installing the tarball…');
  run('npm', ['install', '--no-audit', '--no-fund'], scratch);

  const installed = readdirSync(join(scratch, 'node_modules'));
  if (installed.includes('typescript') || existsSync(join(scratch, 'node_modules', 'typescript'))) {
    throw new Error('`typescript` was installed into the consumer project; the check proves nothing');
  }
  console.log(`No \`typescript\` in node_modules (${installed.length} packages installed).`);

  console.log('Running ESLint…');
  let output;
  try {
    output = run('npx', ['eslint', 'component.tsx', '--format', 'json'], scratch);
  } catch (error) {
    output = error.stdout ?? '';
  }

  const [result] = JSON.parse(output);
  const messages = (result?.messages ?? []).map((m) => `${m.ruleId ?? 'FATAL'}: ${m.message}`);
  console.log(`ESLint reported: ${JSON.stringify(messages)}`);

  const fatal = (result?.messages ?? []).filter((m) => m.fatal);
  if (fatal.length > 0) throw new Error(`Parse failed: ${fatal[0].message}`);
  if (!messages.some((m) => m.includes("'ubrugt'"))) {
    throw new Error('Expected `no-unused-vars` to report `ubrugt`; the parser did not produce a usable AST');
  }

  console.log('\nOK: the packaged parser lints TSX in a project with no `typescript` installed.');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
