/**
 * Differential test: this parser against the reference snapshots.
 *
 * Runs from the repo root, where `typescript` is not a dependency of the
 * package under test, so a run that passes here is also evidence the parser
 * never reaches for it.
 *
 *   node conformance/run.mjs [--limit N] [--verbose] [--only <substring>]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { diff, normalize, stripHashbangComments } from './lib/normalize.mjs';
import { DECLARED } from './lib/divergences.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const verbose = args.includes('--verbose');
const only = flag('--only', null);
const perFileDiffs = Number(flag('--limit', '8'));

const snapshotDir = resolve(flag('--snapshots', join(import.meta.dirname, '.snapshots')));
/**
 * Files the reference parses and oxc rejects, because oxc enforces early errors
 * that TypeScript's parser tolerates. Reviewed and checked in, so a new one is
 * a failure rather than something that quietly slips through.
 */
const strictnessFile = resolve(flag('--strictness', join(snapshotDir, '..', 'strictness.json')));
const updateStrictness = args.includes('--update-strictness');
let strictness = {};
try {
  strictness = JSON.parse(readFileSync(strictnessFile, 'utf8'));
} catch {
  strictness = {};
}
const observedStrictness = {};
const { corpus, files } = JSON.parse(readFileSync(join(snapshotDir, 'index.json'), 'utf8'));
if (files.length === 0) throw new Error(`No snapshots in ${snapshotDir}; nothing to compare.`);

const parser = await import('../dist/index.mjs');

let compared = 0;
let identical = 0;
const failures = [];
/** Files the reference itself rejects; nothing to compare against. */
const referenceRejected = [];
/** Files the reference rejects and we accept — reported, but not a failure. */
const acceptedByUsOnly = [];
/** Files the reference accepts and we reject, matching the reviewed baseline. */
const stricterThanReference = [];
const differenceCounts = new Map();

for (const relPath of files) {
  if (only && !relPath.includes(only)) continue;
  compared++;

  const expected = JSON.parse(readFileSync(join(snapshotDir, `${relPath}.json`), 'utf8'));
  const full = join(corpus, relPath);
  const code = readFileSync(full, 'utf8');

  let actual;
  try {
    actual = { ok: true, ast: normalize(stripHashbangComments(parser.parseForESLint(code, { filePath: full }).ast)) };
  } catch (error) {
    actual = {
      ok: false,
      error: { message: error.message, lineNumber: error.lineNumber, column: error.column, index: error.index },
    };
  }

  if (!expected.ok) {
    // The reference could not parse it, so there is no AST to match. Corpora
    // like typescript-eslint's own fixtures include deliberately invalid files.
    referenceRejected.push(relPath);
    if (actual.ok) acceptedByUsOnly.push(relPath);
    continue;
  }

  if (!actual.ok) {
    observedStrictness[relPath] = actual.error.message;
    if (strictness[relPath] === actual.error.message) {
      stricterThanReference.push(relPath);
      continue;
    }
    failures.push({
      file: relPath,
      differences: [
        { path: '<parse>', expected: 'parsed', actual: `error: ${actual.error.message}` },
      ],
    });
    continue;
  }

  const differences = diff(expected.ast, actual.ast);
  if (differences.length === 0) {
    identical++;
    continue;
  }
  for (const d of differences) {
    const key = d.path.replaceAll(/\[\d+\]/g, '[]');
    differenceCounts.set(key, (differenceCounts.get(key) ?? 0) + 1);
  }
  failures.push({ file: relPath, differences });
}

for (const failure of failures) {
  console.log(`\n✗ ${failure.file} — ${failure.differences.length} difference(s)`);
  for (const d of failure.differences.slice(0, perFileDiffs)) {
    console.log(`    ${d.path}\n      reference: ${format(d.expected)}\n      oxc:       ${format(d.actual)}`);
  }
  if (failure.differences.length > perFileDiffs) {
    console.log(`    … ${failure.differences.length - perFileDiffs} more`);
  }
}

if (verbose && differenceCounts.size > 0) {
  console.log('\nDifferences by path:');
  for (const [path, count] of [...differenceCounts].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`  ${String(count).padStart(6)}  ${path}`);
  }
}

if (updateStrictness) {
  const sorted = Object.fromEntries(Object.entries(observedStrictness).sort());
  writeFileSync(strictnessFile, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`\nWrote ${Object.keys(sorted).length} entries to ${strictnessFile}`);
}

if (compared === 0) throw new Error('No files were compared; a passing run would mean nothing.');

const comparable = compared - referenceRejected.length - stricterThanReference.length;
console.log(`\n${identical}/${comparable} comparable files identical to the reference AST.`);
if (stricterThanReference.length > 0) {
  console.log(
    `${stricterThanReference.length} file(s) rejected here and accepted by the reference, ` +
      'all matching the reviewed strictness baseline',
  );
}
if (referenceRejected.length > 0) {
  console.log(
    `${referenceRejected.length} file(s) the reference itself rejects were skipped` +
      (acceptedByUsOnly.length > 0 ? `, ${acceptedByUsOnly.length} of which this parser accepts` : ''),
  );
  if (verbose) for (const file of acceptedByUsOnly.slice(0, 20)) console.log(`    accepted only here: ${file}`);
}
if (DECLARED.length > 0) {
  console.log(`Declared divergences excluded from the diff: ${DECLARED.map((d) => d.key).join(', ')}`);
}
process.exitCode = failures.length === 0 ? 0 : 1;

function format(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text !== undefined && text.length > 160 ? `${text.slice(0, 160)}…` : text;
}
