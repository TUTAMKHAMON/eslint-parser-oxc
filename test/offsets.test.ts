/**
 * ESLint positions are UTF-16 code units, 1-based lines and 0-based columns.
 * Danish text and emoji are the cases that break a parser reporting UTF-8 byte
 * offsets, so they are pinned here against plain JavaScript string indexing.
 */

import { describe, expect, it } from 'vitest';

import { parse } from '../src/index.ts';

const findFirst = (node: unknown, type: string): Record<string, unknown> | undefined => {
  if (node === null || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirst(child, type);
      if (found) return found;
    }
    return undefined;
  }
  const record = node as Record<string, unknown>;
  if (record['type'] === type) return record;
  for (const key of Object.keys(record)) {
    if (key === 'parent') continue;
    const found = findFirst(record[key], type);
    if (found) return found;
  }
  return undefined;
};

describe('offsets', () => {
  it('reports UTF-16 offsets for text after an emoji', () => {
    const code = 'const hilsen = "🎉 hej";\nconst efter = 1;\n';
    const ast = parse(code, { filePath: 'a.ts' });

    const declaration = (ast['body'] as Record<string, unknown>[])[1]!;
    const range = declaration['range'] as [number, number];
    expect(code.slice(range[0], range[1])).toBe('const efter = 1;');
  });

  it('counts a surrogate pair as two columns, like ESLint does', () => {
    const code = 'const a = "🎉";\n';
    const literal = findFirst(parse(code, { filePath: 'a.ts' }), 'Literal')!;
    const loc = literal['loc'] as { start: { column: number }; end: { column: number } };

    expect(loc.start.column).toBe(code.indexOf('"'));
    expect(loc.end.column).toBe(code.indexOf(';'));
  });

  it('numbers lines from 1 and columns from 0 across Danish text', () => {
    const code = '// æøå\nconst blåbær = "smør";\n';
    const ast = parse(code, { filePath: 'a.ts' });
    const declaration = (ast['body'] as Record<string, unknown>[])[0]!;
    const loc = declaration['loc'] as { start: { line: number; column: number } };

    expect(loc.start.line).toBe(2);
    expect(loc.start.column).toBe(0);
  });

  it('handles every line terminator ECMAScript recognises', () => {
    const code = 'a;\rb;\r\nc; d; e;\nf;';
    const ast = parse(code, { filePath: 'a.js' });
    const lines = (ast['body'] as Record<string, unknown>[]).map(
      (statement) => (statement['loc'] as { start: { line: number } }).start.line,
    );

    expect(lines).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
