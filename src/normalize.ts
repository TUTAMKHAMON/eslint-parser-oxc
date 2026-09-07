/**
 * Reconciling oxc's ESTree output with what ESLint and TSESTree consumers
 * expect. Every adjustment here is recorded in DIVERGENCES.md.
 */

import type { OxcNode } from './ast.ts';
import type { LineTable } from './line-table.ts';
import type { Comment } from './tokenizer.ts';

/**
 * Fold a hashbang into the comment list.
 *
 * oxc reports `#!/usr/bin/env node` as `Program.hashbang` and, like both espree
 * and typescript-estree, starts `Program.range` after it. espree then exposes it
 * as a `Hashbang` comment, which is what ESLint core rules expect, so that is
 * what we do — typescript-estree drops it entirely.
 */
export function extractHashbang(program: OxcNode, lines: LineTable): Comment | undefined {
  const hashbang = program['hashbang'] as OxcNode | undefined;
  delete program['hashbang'];
  if (!hashbang?.range) return undefined;

  return {
    type: 'Hashbang' as Comment['type'],
    value: String(hashbang['value'] ?? ''),
    range: hashbang.range,
    loc: { start: lines.positionAt(hashbang.range[0]), end: lines.positionAt(hashbang.range[1]) },
  };
}

/** ESLint's `SourceCode` only understands `'module'` and `'script'`. */
export function normalizeSourceType(program: OxcNode): void {
  if (program['sourceType'] === 'commonjs' || program['sourceType'] === 'unambiguous') {
    program['sourceType'] = 'script';
  }
}
