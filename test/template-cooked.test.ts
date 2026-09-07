/**
 * `TemplateElement.value.cooked` is the one AST field where this parser
 * deliberately disagrees with typescript-estree (see DIVERGENCES.md). The
 * behaviour it agrees with instead is espree's — ESLint's own parser — so that
 * is what the divergence is pinned against.
 */

import * as espree from 'espree';
import { describe, expect, it } from 'vitest';

import { parse } from '../src/index.ts';

const CASES = [
  'const a = `plain`;',
  'const b = `x${1}y${2}z`;',
  'const c = `line\\nbreak`;',
  'const d = `unicode \\u00e6\\u00f8\\u00e5 \\u{1F389}`;',
  'tag`\\1(a)`',
  'tag`\\u{}`',
  'tag`\\x`',
  'String.raw`[ \\\\uf\\e0f]`',
  'const e = `dansk: æøå 🎉`;',
];

function cookedValues(ast: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record['type'] === 'TemplateElement') out.push(record['value']);
    for (const key of Object.keys(record)) {
      if (key === 'parent') continue;
      walk(record[key]);
    }
  };
  walk(ast);
  return out;
}

describe('TemplateElement cooked values', () => {
  for (const code of CASES) {
    it(`matches espree for ${JSON.stringify(code)}`, () => {
      const expected = cookedValues(
        espree.parse(code, { ecmaVersion: 'latest', sourceType: 'module', range: true }),
      );
      expect(cookedValues(parse(code, { filePath: 'a.js' }))).toEqual(expected);
    });
  }

  it('reports a null cooked value for an invalid escape in a tagged template', () => {
    const [first] = cookedValues(parse('tag`\\1(a)`', { filePath: 'a.js' })) as {
      raw: string;
      cooked: string | null;
    }[];
    expect(first).toEqual({ raw: '\\1(a)', cooked: null });
  });
});
