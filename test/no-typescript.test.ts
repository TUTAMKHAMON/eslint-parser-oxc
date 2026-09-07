/**
 * The reason this parser exists: TypeScript 7 ships no JavaScript API, so a
 * parser that loads `typescript` cannot run in a repo that has moved to it.
 *
 * `test/helpers/forbid-typescript.mjs` makes resolving `typescript` throw, for
 * `require` as well as `import`. `npm run verify:packaged` is the complementary
 * check: it installs the packed tarball somewhere with no `typescript` on disk
 * at all.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const helper = (name: string): string => fileURLToPath(new URL(`helpers/${name}`, import.meta.url));

describe('running without typescript', () => {
  it('parses and lints a TSX file with `typescript` resolution disabled', () => {
    const stdout = execFileSync(
      process.execPath,
      ['--import', helper('forbid-typescript.mjs'), helper('parse-without-typescript.mjs')],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(stdout)).toEqual({
      program: 'Program',
      tokens: expect.any(Number),
      comments: 0,
      hasScopeManager: true,
      // Core `no-unused-vars` flags enum members; the reference parser produces
      // exactly the same findings (see test/scope-expectations.json).
      findings: [
        "no-unused-vars: 'Up' is defined but never used.",
        "no-unused-vars: 'Down' is defined but never used.",
        "no-unused-vars: 'ubrugt' is assigned a value but never used.",
      ],
    });
  });

  it('proves the guard actually fires', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ['--import', helper('forbid-typescript.mjs'), '-e', "import('typescript')"],
        { encoding: 'utf8', stdio: 'pipe' },
      ),
    ).toThrow();
  });
});
