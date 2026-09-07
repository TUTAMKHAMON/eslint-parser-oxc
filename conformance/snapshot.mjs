/**
 * Regenerate the reference snapshots.
 *
 * Runs `conformance/reference/snapshot.mjs` in its own install — the only one
 * with `typescript` — for the in-repo fixtures and, if it has been fetched, the
 * external corpus.
 *
 *   node conformance/snapshot.mjs [corpus-dir] [snapshot-dir]
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const reference = join(import.meta.dirname, 'reference');
const [, , corpusArg, outArg] = process.argv;

const targets = corpusArg
  ? [[corpusArg, outArg ?? join(import.meta.dirname, '.snapshots-custom')]]
  : [
      [join(import.meta.dirname, 'fixtures'), join(import.meta.dirname, '.snapshots')],
      [join(import.meta.dirname, '.corpus'), join(import.meta.dirname, '.snapshots-corpus')],
    ];

for (const [corpus, out] of targets) {
  if (!existsSync(corpus)) {
    console.log(`skipping ${corpus} (not fetched — run \`npm run conformance:corpus\`)`);
    continue;
  }
  execFileSync('node', ['snapshot.mjs', corpus, out], { cwd: reference, stdio: 'inherit' });
}
