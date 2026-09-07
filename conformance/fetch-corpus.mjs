/**
 * Download the external corpora the differential test runs over.
 *
 * The in-repo fixtures cover the syntax surface deliberately; these cover the
 * shapes real code actually takes, at a scale where rare divergences show up.
 * Everything lands in `conformance/.corpus`, which is git-ignored.
 *
 *   node conformance/fetch-corpus.mjs [name ...]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SOURCES = [
  {
    name: 'typescript-eslint',
    url: 'https://codeload.github.com/typescript-eslint/typescript-eslint/tar.gz/refs/tags/v8.69.0',
    // The parser's own fixture corpus: one file per syntactic form.
    include: ['*/packages/ast-spec/src/*/*/fixtures/*/*', '*/packages/typescript-estree/tests/fixtures/*'],
  },
  {
    name: 'eslint',
    url: 'https://codeload.github.com/eslint/eslint/tar.gz/refs/tags/v9.39.5',
    include: ['*/lib/*', '*/tests/fixtures/*'],
  },
  {
    name: 'tanstack-query',
    url: 'https://codeload.github.com/TanStack/query/tar.gz/refs/tags/v5.90.2',
    // A real TS/TSX React monorepo.
    include: ['*/packages/*/src/*'],
  },
  {
    name: 'redux-saga',
    url: 'https://codeload.github.com/redux-saga/redux-saga/tar.gz/refs/heads/main',
    include: ['*/packages/*/src/*', '*/packages/*/types/*'],
  },
  {
    name: 'vite',
    url: 'https://codeload.github.com/vitejs/vite/tar.gz/refs/tags/v7.1.5',
    include: ['*/packages/vite/src/*'],
  },
];

const root = resolve(join(import.meta.dirname, '.corpus'));
const wanted = process.argv.slice(2);
mkdirSync(root, { recursive: true });

for (const source of SOURCES) {
  if (wanted.length > 0 && !wanted.includes(source.name)) continue;
  const target = join(root, source.name);
  if (existsSync(target)) {
    console.log(`${source.name}: already present`);
    continue;
  }

  const tarball = join(root, `${source.name}.tgz`);
  console.log(`${source.name}: downloading…`);
  execFileSync('curl', ['-sSL', '-o', tarball, source.url], { stdio: 'inherit' });

  mkdirSync(target, { recursive: true });
  const args = ['-xzf', tarball, '-C', target, '--strip-components=1'];
  for (const pattern of source.include) args.push('--include', pattern);
  try {
    execFileSync('tar', args, { stdio: 'inherit' });
  } catch {
    console.log(`${source.name}: tar reported missing patterns; keeping what was extracted`);
  }
  rmSync(tarball);
  console.log(`${source.name}: ready`);
}
