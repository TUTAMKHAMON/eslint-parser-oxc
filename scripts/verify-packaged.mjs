/**
 * Install the packed tarball into a throwaway project that has no `typescript`
 * on disk at all, then run ESLint over a TSX file with it.
 *
 * The unit test in `test/no-typescript.test.ts` blocks `typescript` resolution
 * inside this repo; this proves the same thing against the published artefact,
 * including that `files`, `exports` and the dependency list are right.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'eslint-parser-oxc-'));

/**
 * npm exports its own configuration into lifecycle scripts as `npm_config_*`,
 * so a nested npm command silently inherits the *outer* command's flags. This
 * script runs from `prepublishOnly`, which means that under
 * `npm publish --dry-run` every npm call below would inherit
 * `npm_config_dry_run=true`: `npm pack` prints a filename without writing the
 * file, and the install turns into a no-op. Stripping the injected config makes
 * the child commands behave as they would from a fresh shell.
 *
 * Only npm's lowercase lifecycle variables are removed. The uppercase
 * `NPM_CONFIG_USERCONFIG` that actions/setup-node sets is a real user setting
 * and is left in place.
 */
const CLEAN_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('npm_config_')),
);

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], env: CLEAN_ENV });

try {
  console.log('Building…');
  run('npm', ['run', 'build'], repo);

  console.log('Packing…');
  const tarball = run('npm', ['pack', '--pack-destination', scratch], repo).trim().split('\n').pop();

  // `npm pack` reports the filename it would write even when it writes nothing,
  // so the file is checked rather than assumed; otherwise the failure surfaces
  // three steps later as an unexplained ENOENT from `npm install`.
  const packed = join(scratch, tarball);
  if (!existsSync(packed)) {
    throw new Error(`npm pack reported ${tarball} but wrote no file to ${scratch}`);
  }
  console.log(`Packed ${tarball} (${(statSync(packed).size / 1024).toFixed(1)} kB)`);

  writeFileSync(
    join(scratch, 'package.json'),
    `${JSON.stringify(
      {
        name: 'no-typescript-consumer',
        private: true,
        version: '0.0.0',
        type: 'module',
        dependencies: { eslint: '9.39.5', 'eslint-parser-oxc': `file:${packed}` },
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
