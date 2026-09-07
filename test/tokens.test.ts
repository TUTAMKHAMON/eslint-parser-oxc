/**
 * The token stream is produced here rather than by oxc (see DIVERGENCES.md), so
 * these pin the cases a scanner gets wrong: regular expression versus division,
 * the type-argument `>`, JSX text and attributes, template chunking, and which
 * words count as keywords.
 */

import { describe, expect, it } from 'vitest';

import { parse } from '../src/index.ts';

function tokens(code: string, filePath = 'a.tsx'): string[] {
  const ast = parse(code, { filePath });
  return (ast.tokens as { type: string; value: string }[]).map(
    (token) => `${token.type}(${token.value})`,
  );
}

function covers(code: string, filePath = 'a.tsx'): boolean {
  const ast = parse(code, { filePath });
  const list = ast.tokens as { range: [number, number] }[];
  const comments = ast.comments as { range: [number, number] }[];
  const claimed = [...list, ...comments].sort((a, b) => a.range[0] - b.range[0]);

  let cursor = 0;
  for (const item of claimed) {
    if (item.range[0] < cursor) return false;
    if (code.slice(cursor, item.range[0]).trim() !== '') return false;
    cursor = item.range[1];
  }
  return code.slice(cursor).trim() === '';
}

describe('tokens', () => {
  it('tells a regular expression from division', () => {
    expect(tokens('const a = /ab+c/gi; const b = 1 / 2 / 3;', 'a.js')).toContain('RegularExpression(/ab+c/gi)');
    expect(tokens('const b = 1 / 2 / 3;', 'a.js').filter((t) => t.startsWith('Punctuator(/)'))).toHaveLength(2);
  });

  it('carries the pattern and flags on a regular expression token', () => {
    const ast = parse('const a = /ab+c/giu;', { filePath: 'a.js' });
    const token = (ast.tokens as { type: string; regex?: { pattern: string; flags: string } }[]).find(
      (t) => t.type === 'RegularExpression',
    );
    expect(token?.regex).toEqual({ pattern: 'ab+c', flags: 'giu' });
  });

  it('splits the `>` that closes a type argument list', () => {
    expect(tokens('const a: Array<Array<number>> = [];', 'a.ts')).toEqual([
      'Keyword(const)', 'Identifier(a)', 'Punctuator(:)', 'Identifier(Array)', 'Punctuator(<)',
      'Identifier(Array)', 'Punctuator(<)', 'Identifier(number)', 'Punctuator(>)', 'Punctuator(>)',
      'Punctuator(=)', 'Punctuator([)', 'Punctuator(])', 'Punctuator(;)',
    ]);
  });

  it('leaves a shift operator alone', () => {
    expect(tokens('const a = 1 >> 2 >>> 3;', 'a.js')).toContain('Punctuator(>>)');
    expect(tokens('const a = 1 >> 2 >>> 3;', 'a.js')).toContain('Punctuator(>>>)');
  });

  it('chunks template literals the way espree does', () => {
    expect(tokens('const a = `x${1}y${2}z`;', 'a.js')).toEqual([
      'Keyword(const)', 'Identifier(a)', 'Punctuator(=)', 'Template(`x${)', 'Numeric(1)',
      'Template(}y${)', 'Numeric(2)', 'Template(}z`)', 'Punctuator(;)',
    ]);
  });

  it('does not mistake a nested object brace for a template hole', () => {
    expect(covers('const a = `x${ { y: `${z}` } }w`;', 'a.js')).toBe(true);
  });

  it('reports JSX text, including leading whitespace, and attribute strings', () => {
    expect(tokens('const a = <div className="x">  hej {1} </div>;')).toEqual([
      'Keyword(const)', 'Identifier(a)', 'Punctuator(=)', 'Punctuator(<)', 'JSXIdentifier(div)',
      'JSXIdentifier(className)', 'Punctuator(=)', 'JSXText("x")', 'Punctuator(>)',
      'JSXText(  hej )', 'Punctuator({)', 'Numeric(1)', 'Punctuator(})', 'JSXText( )',
      'Punctuator(<)', 'Punctuator(/)', 'JSXIdentifier(div)', 'Punctuator(>)', 'Punctuator(;)',
    ]);
  });

  it('keeps a hyphenated JSX attribute name as one token', () => {
    expect(tokens('const a = <div data-testid="x" />;')).toContain('JSXIdentifier(data-testid)');
  });

  it('reports private names without the hash', () => {
    expect(tokens('class A { #p = 1; m() { return this.#p } }', 'a.ts')).toContain('PrivateIdentifier(p)');
  });

  it('treats reserved words in identifier positions as identifiers', () => {
    expect(tokens('a.if; const o = { class: 1 }; enum E { default }', 'a.ts')).toEqual([
      'Identifier(a)', 'Punctuator(.)', 'Identifier(if)', 'Punctuator(;)', 'Keyword(const)',
      'Identifier(o)', 'Punctuator(=)', 'Punctuator({)', 'Identifier(class)', 'Punctuator(:)',
      'Numeric(1)', 'Punctuator(})', 'Punctuator(;)', 'Keyword(enum)', 'Identifier(E)',
      'Punctuator({)', 'Identifier(default)', 'Punctuator(})',
    ]);
  });

  it('treats contextual keywords as identifiers', () => {
    const code = 'type T = string; const x = y as T; async function f() { await 1 } declare const d: T;';
    const list = tokens(code, 'a.ts');
    for (const word of ['type', 'as', 'async', 'await', 'declare']) {
      expect(list).toContain(`Identifier(${word})`);
    }
  });

  it('keeps `import` and `new` keywords in meta properties', () => {
    expect(tokens('const m = import.meta.url; function f() { return new.target }', 'a.js')).toEqual(
      expect.arrayContaining(['Keyword(import)', 'Keyword(new)', 'Identifier(meta)', 'Identifier(target)']),
    );
  });

  it('reports `true`, `false` and `null` with their own token types', () => {
    expect(tokens('const a = [true, false, null];', 'a.js')).toEqual(
      expect.arrayContaining(['Boolean(true)', 'Boolean(false)', 'Null(null)']),
    );
  });

  it('reads `a ? .5 : 1` as a conditional, not an optional chain', () => {
    expect(tokens('const c = a ? .5 : 1;', 'a.js')).toEqual(
      expect.arrayContaining(['Punctuator(?)', 'Numeric(.5)', 'Punctuator(:)']),
    );
  });

  it('covers the whole file with tokens and comments', () => {
    const code = [
      '#!/usr/bin/env node',
      '// æøå 🎉',
      '/* blok */',
      "import type { A } from 'a';",
      'const re = /x/g, n = 0x1f, b = 1_000n, s = "🎉";',
      'const t = `a${b}c`;',
      'export const el = <div a="b" {...s}>tekst {n} <br/></div>;',
      'export type { A };',
    ].join('\n');
    expect(covers(code)).toBe(true);
  });

  it('emits both `<` when two type argument lists open in a row', () => {
    // typescript-estree emits a single `<` here, leaving a character covered by
    // no token at all. See DIVERGENCES.md §7.
    const code = 'declare const g: any;\nconst r = g<<U>(u: U) => U>(null as any);';
    expect(tokens(code, 'a.ts').filter((token) => token === 'Punctuator(<)')).toHaveLength(2);
    expect(covers(code, 'a.ts')).toBe(true);
  });

  it('skips the hashbang and reports it as a comment', () => {
    const ast = parse('#!/usr/bin/env node\nconst a = 1;\n', { filePath: 'a.js' });
    expect((ast.comments as { type: string; value: string }[])[0]).toMatchObject({
      type: 'Hashbang',
      value: '/usr/bin/env node',
    });
    expect((ast.tokens as { value: string }[])[0]?.value).toBe('const');
  });
});
