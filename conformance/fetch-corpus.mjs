/**
 * Download the external corpora the differential test runs over.
 *
 * The in-repo fixtures cover the syntax surface deliberately; these cover the
 * shapes real code actually takes, at a scale where rare divergences show up.
 * Everything lands in `conformance/.corpus`, which is git-ignored.
 *
 * Every source is pinned to a tag or a commit, because
 * `conformance/strictness-corpus.json` records per-file expectations and would
 * drift the moment the corpus did.
 *
 *   node conformance/fetch-corpus.mjs [name ...]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { collect } from './lib/corpus.mjs';

const SOURCES = [
  {
    name: 'typescript-eslint',
    url: 'https://codeload.github.com/typescript-eslint/typescript-eslint/tar.gz/refs/tags/v8.69.0',
    // The parser's own fixture corpus: one file per syntactic form.
    include: ['*/packages/ast-spec/src/*/*/fixtures/*/*', '*/packages/typescript-estree/tests/fixtures/*'],
    minFiles: 800,
  },
  {
    name: 'eslint',
    url: 'https://codeload.github.com/eslint/eslint/tar.gz/refs/tags/v9.39.5',
    include: ['*/lib/*', '*/tests/fixtures/*'],
    minFiles: 1200,
  },
  {
    name: 'tanstack-query',
    url: 'https://codeload.github.com/TanStack/query/tar.gz/refs/tags/v5.90.2',
    // A real TS/TSX React monorepo.
    include: ['*/packages/*/src/*'],
    minFiles: 300,
  },
  {
    name: 'redux-saga',
    // Pinned to a commit: the repository's newest tag is far behind `main`.
    url: 'https://codeload.github.com/redux-saga/redux-saga/tar.gz/b603028ae2d6f1f96f94fb4f016bde3fa32d6a2d',
    include: ['*/packages/*/src/*', '*/packages/*/types/*'],
    minFiles: 50,
  },
  {
    name: 'vite',
    url: 'https://codeload.github.com/vitejs/vite/tar.gz/refs/tags/v7.1.5',
    include: ['*/packages/vite/src/*'],
    minFiles: 250,
  },
];

/**
 * bsdtar (macOS) and GNU tar (Linux) share no filtering flag: `--include` is
 * bsdtar-only and `--wildcards` is GNU-only. Pattern operands work on both, and
 * `--wildcards` is added on GNU so the matching does not depend on its default.
 */
const IS_GNU_TAR = !execFileSync('tar', ['--version'], { encoding: 'utf8' }).includes('bsdtar');

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
  execFileSync('curl', ['-sSLf', '-o', tarball, source.url], { stdio: 'inherit' });

  mkdirSync(target, { recursive: true });
  const args = ['-xzf', tarball, '-C', target, '--strip-components=1'];
  if (IS_GNU_TAR) args.push('--wildcards');
  args.push(...source.include);

  try {
    execFileSync('tar', args, { stdio: 'inherit' });
  } finally {
    rmSync(tarball, { force: true });
  }

  // A silent extraction failure would turn the whole differential suite into a
  // green run over nothing, so the result is checked rather than assumed.
  const extracted = collect(target).length;
  if (extracted < source.minFiles) {
    rmSync(target, { recursive: true, force: true });
    throw new Error(
      `${source.name}: extracted ${extracted} parseable files, expected at least ${source.minFiles}. ` +
        `The archive layout or the tar patterns have changed.`,
    );
  }
  console.log(`${source.name}: ${extracted} files`);
}
