/**
 * Shared benchmark plumbing.
 *
 * Rule execution dominates a lint run, so parse time and total lint time are
 * measured separately — a parser that is twice as fast still only moves the
 * part of the wall clock it is responsible for.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { collect } from '../../conformance/lib/corpus.mjs';

export function loadCorpus(root, { maxFiles = Infinity } = {}) {
  return collect(root, { maxFiles }).map((relPath) => ({
    relPath,
    filePath: join(root, relPath),
    code: readFileSync(join(root, relPath), 'utf8'),
  }));
}

/** Median of `runs` timed passes, after `warmup` untimed ones. */
export async function measure(fn, { runs = 5, warmup = 2 } = {}) {
  for (let i = 0; i < warmup; i++) await fn();

  const timings = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  return timings[timings.length >> 1];
}

/** Parse every file, counting the ones that fail rather than aborting. */
export function parseAll(files, parse) {
  let failed = 0;
  for (const file of files) {
    try {
      parse(file);
    } catch {
      failed++;
    }
  }
  return failed;
}

export function formatRow(label, parseMs, lintMs, files, bytes) {
  const perFile = (parseMs / files).toFixed(2);
  const mbPerSec = (bytes / 1e6 / (parseMs / 1000)).toFixed(1);
  return {
    parser: label,
    'parse (ms)': parseMs.toFixed(0),
    'per file (ms)': perFile,
    'MB/s': mbPerSec,
    'lint total (ms)': lintMs === null ? '—' : lintMs.toFixed(0),
  };
}
