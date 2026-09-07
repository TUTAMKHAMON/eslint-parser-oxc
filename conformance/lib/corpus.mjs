/** Discovering the files the differential test runs over. */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const PARSEABLE = /\.(?:[cm]?jsx?|[cm]?tsx?)$/;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.snapshots', 'coverage']);

/** Walk a directory, returning every file this parser is expected to handle. */
export function collect(root, { maxFiles = Infinity, maxBytes = 2_000_000 } = {}) {
  const base = resolve(root);
  const files = [];

  const walk = (dir) => {
    if (files.length >= maxFiles) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (files.length >= maxFiles) return;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (!entry.isFile() || !PARSEABLE.test(entry.name)) continue;
      if (statSync(full).size > maxBytes) continue;
      files.push(relative(base, full));
    }
  };

  walk(base);
  return files;
}
