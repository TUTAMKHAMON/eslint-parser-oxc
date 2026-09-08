/**
 * `eslint-parser-oxc` — an ESLint custom parser backed by `oxc-parser`.
 *
 * Parses JavaScript, JSX, TypeScript and TSX for syntax-only rules. There is no
 * type information and no `typescript` dependency at runtime, which is the
 * point: TypeScript 7 ships no JavaScript API, so a parser that needs one can
 * no longer run alongside it.
 */

import { analyze } from '@typescript-eslint/scope-manager';
import { visitorKeys } from '@typescript-eslint/visitor-keys';
import { parseSync } from 'oxc-parser';

import packageJson from '../package.json' with { type: 'json' };

import { scanAst, type OxcNode } from './ast.ts';
import { throwIfFatal, type OxcError } from './errors.ts';
import { LineTable } from './line-table.ts';
import { extractHashbang, normalizeSourceType } from './normalize.ts';
import { resolveOptions, type ParserOptions } from './options.ts';
import { convertComments, tokenize, type Comment, type CommentSpan, type Token } from './tokenizer.ts';

export type { ParserOptions, Lang, SourceType } from './options.ts';
export type { Token, Comment } from './tokenizer.ts';
export { OxcSyntaxError } from './errors.ts';

/**
 * ESLint shows this in messages about the parser. Read from `package.json` so a
 * version bump cannot leave it stale — `test/meta.test.ts` guards the link.
 */
export const meta = {
  name: packageJson.name,
  version: packageJson.version,
} as const;

export interface Program extends OxcNode {
  comments: Comment[];
  tokens: Token[];
}

export interface ParseForESLintResult {
  ast: Program;
  scopeManager: ReturnType<typeof analyze>;
  visitorKeys: typeof visitorKeys;
  services: Record<string, never>;
}

/**
 * The ESLint custom-parser entry point.
 *
 * @throws {OxcSyntaxError} on a syntax error, carrying `lineNumber` (1-based)
 * and `column` (0-based) for ESLint to report as a fatal message.
 */
export function parseForESLint(code: string, options?: ParserOptions): ParseForESLintResult {
  const resolved = resolveOptions(options);

  const result = parseSync(resolved.filePath, code, {
    lang: resolved.lang,
    sourceType: resolved.sourceType,
    astType: resolved.astType,
    range: true,
    preserveParens: resolved.preserveParens,
    showSemanticErrors: resolved.showSemanticErrors,
  });

  const lines = new LineTable(code);
  throwIfFatal(result.errors as unknown as OxcError[], lines);

  const oxcComments = result.comments as unknown as CommentSpan[];
  const program = result.program as unknown as OxcNode;
  const scan = scanAst(program, code, lines);

  const hashbang = extractHashbang(program, lines);
  normalizeSourceType(program);

  const ast = program as Program;
  const comments = convertComments(oxcComments, lines);
  ast.comments = hashbang === undefined ? comments : [hashbang, ...comments];
  ast.tokens = tokenize(code, scan, oxcComments, lines);

  const scopeManager = analyze(ast as never, {
    childVisitorKeys: visitorKeys,
    globalReturn: options?.ecmaFeatures?.globalReturn ?? false,
    impliedStrict: false,
    jsxPragma: resolved.jsxPragma,
    jsxFragmentName: resolved.jsxFragmentName,
    lib: resolved.lib as never,
    sourceType: resolved.sourceType === 'module' ? 'module' : 'script',
  });

  return { ast, scopeManager, visitorKeys, services: {} };
}

/** For tools that only want the AST. */
export function parse(code: string, options?: ParserOptions): Program {
  return parseForESLint(code, options).ast;
}

export default { meta, parse, parseForESLint };
