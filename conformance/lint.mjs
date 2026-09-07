/**
 * Rule-level differential: lint a corpus twice, once with the reference parser
 * and once with this one, and diff the findings by
 * `file:line:column:endLine:endColumn ruleId messageId`.
 *
 * The AST diff proves the trees match; this proves the rules agree, which is
 * the thing a repo switching parsers actually cares about.
 *
 *   node conformance/lint.mjs [corpus] [--fix]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';

import { lintCorpus } from './lib/lint-run.mjs';

const args = process.argv.slice(2);
const corpus = resolve(args.find((arg) => !arg.startsWith('--')) ?? join(import.meta.dirname, 'fixtures'));
const fix = args.includes('--fix');
const referenceOut = resolve(join(import.meta.dirname, '.lint-reference.json'));
const oursOut = resolve(join(import.meta.dirname, '.lint-oxc.json'));

// `settings['import-x/parsers']` is keyed by module name, so eslint-plugin-import-x
// has to be able to `require('eslint-parser-oxc')` when it parses an imported
// file. Linking the package into its own `node_modules` is what `npm link` does,
// and it exercises the published `exports` map rather than a relative path.
const selfLink = resolve(join(import.meta.dirname, '..', 'node_modules', 'eslint-parser-oxc'));
if (!existsSync(selfLink)) symlinkSync(resolve(join(import.meta.dirname, '..')), selfLink, 'dir');

console.log('Linting with the reference parser…');
execFileSync('node', ['lint.mjs', corpus, referenceOut, ...(fix ? ['--fix'] : [])], {
  cwd: join(import.meta.dirname, 'reference'),
  stdio: 'inherit',
});

console.log('Linting with eslint-parser-oxc…');
const parser = await import('../dist/index.mjs');
const summary = await lintCorpus({
  ESLint, js, parser, parserName: 'eslint-parser-oxc',
  react, importX, jsxA11y, corpus, out: oursOut, fix,
});
console.log(`eslint-parser-oxc: ${summary.findings} findings over ${summary.files} files`);

const reference = JSON.parse(readFileSync(referenceOut, 'utf8'));
const ours = JSON.parse(readFileSync(oursOut, 'utf8'));

if (Object.keys(reference.byFile).length === 0) {
  throw new Error(`No files were linted under ${corpus}; a passing run would mean nothing.`);
}

// Findings only mean anything where both parsers produced an AST. A file either
// side rejected is counted and reported separately.
const comparable = Object.keys(reference.byFile).filter(
  (file) => !reference.fatal[file] && !ours.fatal[file],
);

const referenceFindings = comparable.flatMap((file) => reference.byFile[file] ?? []);
const ourFindings = comparable.flatMap((file) => ours.byFile[file] ?? []);

const onlyReference = difference(referenceFindings, ourFindings);
const onlyOurs = difference(ourFindings, referenceFindings);

report('Reported by the reference only', onlyReference);
report('Reported by eslint-parser-oxc only', onlyOurs);

const fatalHereOnly = Object.keys(ours.fatal).filter((file) => !reference.fatal[file]);
const fatalReferenceOnly = Object.keys(reference.fatal).filter((file) => !ours.fatal[file]);

let fixMismatches = [];
if (fix) {
  fixMismatches = comparable.filter((file) => reference.fixed[file] !== ours.fixed[file]);
  report('`--fix` output differs', fixMismatches);
  writeFileSync(
    resolve(join(import.meta.dirname, '.fix-mismatches.json')),
    JSON.stringify(fixMismatches, null, 2),
  );
}

console.log(
  `\n${comparable.length} files parsed by both. ` +
    `${referenceFindings.length} reference findings, ${ourFindings.length} here; ` +
    `${onlyReference.length + onlyOurs.length} difference(s)` +
    (fix ? `, ${fixMismatches.length} file(s) with different --fix output` : ''),
);
console.log(
  `Parse failures: ${Object.keys(reference.fatal).length} reference, ${Object.keys(ours.fatal).length} here ` +
    `(${fatalHereOnly.length} only here, ${fatalReferenceOnly.length} only in the reference).`,
);
if (fatalHereOnly.length > 0 && args.includes('--verbose')) {
  for (const file of fatalHereOnly) console.log(`  fatal only here: ${file} — ${ours.fatal[file]}`);
}
process.exitCode = onlyReference.length + onlyOurs.length + fixMismatches.length === 0 ? 0 : 1;

function difference(a, b) {
  const other = new Set(b);
  return a.filter((entry) => !other.has(entry));
}

function report(title, entries) {
  if (entries.length === 0) return;
  console.log(`\n${title} (${entries.length}):`);
  for (const entry of entries.slice(0, 30)) console.log(`  ${entry}`);
  if (entries.length > 30) console.log(`  … ${entries.length - 30} more`);
}
