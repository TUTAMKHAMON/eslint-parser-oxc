/** Language selection and the ESLint options this parser honours. */

import { describe, expect, it } from 'vitest';

import { parse, parseForESLint } from '../src/index.ts';
import { langFromFilePath, resolveOptions } from '../src/options.ts';

describe('language selection', () => {
  it('maps extensions the way TypeScript does', () => {
    expect(langFromFilePath('/a/b.js')).toBe('js');
    expect(langFromFilePath('/a/b.mjs')).toBe('js');
    expect(langFromFilePath('/a/b.cjs')).toBe('js');
    expect(langFromFilePath('/a/b.jsx')).toBe('jsx');
    expect(langFromFilePath('/a/b.ts')).toBe('ts');
    expect(langFromFilePath('/a/b.mts')).toBe('ts');
    expect(langFromFilePath('/a/b.cts')).toBe('ts');
    expect(langFromFilePath('/a/b.tsx')).toBe('tsx');
    expect(langFromFilePath('/a/b.d.ts')).toBe('dts');
    expect(langFromFilePath('/a/b.d.mts')).toBe('dts');
  });

  it('keeps JSX off in a .ts file so `<T>value` is a type assertion', () => {
    const ast = parse('const a = <string>someValue;', { filePath: 'a.ts' });
    const declaration = (ast['body'] as Record<string, unknown>[])[0]!;
    const declarator = (declaration['declarations'] as Record<string, unknown>[])[0]!;
    expect((declarator['init'] as Record<string, unknown>)['type']).toBe('TSTypeAssertion');
  });

  it('parses the same text as JSX in a .tsx file', () => {
    const ast = parse('const a = <div>x</div>;', { filePath: 'a.tsx' });
    const declaration = (ast['body'] as Record<string, unknown>[])[0]!;
    const declarator = (declaration['declarations'] as Record<string, unknown>[])[0]!;
    expect((declarator['init'] as Record<string, unknown>)['type']).toBe('JSXElement');
  });

  it('honours an explicit ecmaFeatures.jsx over the extension', () => {
    expect(resolveOptions({ filePath: 'a.ts', ecmaFeatures: { jsx: true } }).lang).toBe('tsx');
    expect(resolveOptions({ filePath: 'a.tsx', ecmaFeatures: { jsx: false } }).lang).toBe('ts');
    expect(resolveOptions({ filePath: 'a.js', ecmaFeatures: { jsx: true } }).lang).toBe('jsx');
  });

  it('lets `lang` win outright', () => {
    expect(resolveOptions({ filePath: 'a.js', lang: 'tsx' }).lang).toBe('tsx');
    expect(resolveOptions({ filePath: 'a.js', lang: 'ts', ecmaFeatures: { jsx: true } }).lang).toBe('ts');
  });

  it('parses a declaration file, ambient modules and all', () => {
    const code = [
      "declare module '*.svg' { const content: string; export default content; }",
      'declare global { interface Window { custom: string } }',
      'export {};',
    ].join('\n');
    const ast = parse(code, { filePath: 'a.d.ts' });
    expect((ast['body'] as Record<string, unknown>[]).map((node) => node['type'])).toEqual([
      'TSModuleDeclaration',
      'TSModuleDeclaration',
      'ExportNamedDeclaration',
    ]);
  });

  it('falls back to tsx for an unknown extension', () => {
    expect(langFromFilePath('/a/b.vue')).toBe('tsx');
    expect(resolveOptions({}).lang).toBe('tsx');
  });
});

describe('source type', () => {
  it('defaults to module, and to commonjs for .cjs', () => {
    expect(resolveOptions({ filePath: 'a.js' }).sourceType).toBe('module');
    expect(resolveOptions({ filePath: 'a.cjs' }).sourceType).toBe('commonjs');
    // `.cts` allows `import`/`export`, so it stays a module, as in typescript-eslint.
    expect(resolveOptions({ filePath: 'a.cts' }).sourceType).toBe('module');
  });

  it('reports commonjs as `script`, which is all ESLint understands', () => {
    const ast = parse("const p = require('path');", { filePath: 'a.cjs' });
    expect(ast['sourceType']).toBe('script');
  });

  it('supports ecmaFeatures.globalReturn', () => {
    const ast = parse('return 1;', {
      filePath: 'a.js',
      sourceType: 'script',
      ecmaFeatures: { globalReturn: true },
    });
    expect((ast['body'] as Record<string, unknown>[])[0]!['type']).toBe('ReturnStatement');
  });
});

describe('parseForESLint result', () => {
  it('returns everything ESLint asks a custom parser for', () => {
    const result = parseForESLint('export const a = 1;', { filePath: 'a.ts' });
    expect(result.ast.type).toBe('Program');
    expect(Array.isArray(result.ast.tokens)).toBe(true);
    expect(Array.isArray(result.ast.comments)).toBe(true);
    expect(result.scopeManager.globalScope).toBeTruthy();
    expect(result.visitorKeys['Program']).toContain('body');
    expect(result.services).toEqual({});
  });

  it('accepts no options at all', () => {
    expect(parse('const a = 1;').type).toBe('Program');
  });
});
