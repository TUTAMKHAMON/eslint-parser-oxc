/**
 * Token-level view of one corpus file's differences, aligned side by side.
 *
 * The AST diff in `run.mjs` reports a token mismatch as an index, which is
 * useless on its own once the streams have drifted apart; this shows the first
 * few mismatches with the source around them.
 *
 *   node conformance/tokens.mjs <fixture-relative-path> [context]
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const snapshotDir = resolve(join(import.meta.dirname, '.snapshots'));
const { corpus } = JSON.parse(readFileSync(join(snapshotDir, 'index.json'), 'utf8'));
const relPath = process.argv[2];
const show = Number(process.argv[3] ?? 12);

const expected = JSON.parse(readFileSync(join(snapshotDir, `${relPath}.json`), 'utf8')).ast.tokens;
const full = join(corpus, relPath);
const code = readFileSync(full, 'utf8');
const parser = await import('../dist/index.mjs');
const actual = parser.parseForESLint(code, { filePath: full }).ast.tokens;

const key = (t) => (t ? `${t.type}|${t.value}|${t.range[0]}|${t.range[1]}` : '—');
let shown = 0;
for (let i = 0; i < Math.max(expected.length, actual.length) && shown < show; i++) {
  if (key(expected[i]) === key(actual[i])) continue;
  shown++;
  console.log(`#${i}`);
  console.log(`  reference: ${describe(expected[i])}`);
  console.log(`  oxc:       ${describe(actual[i])}`);
}
console.log(`\n${expected.length} reference tokens, ${actual.length} produced.`);

function describe(token) {
  if (!token) return '—';
  const start = token.range[0];
  return `${token.type.padEnd(18)} ${JSON.stringify(token.value)} @${start}..${token.range[1]} ${JSON.stringify(code.slice(start - 12, start))}»`;
}
