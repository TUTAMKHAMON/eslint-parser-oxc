/**
 * Single traversal of the oxc AST that does three jobs at once:
 *
 *  1. attaches ESLint's `loc` to every node (oxc only reports offsets),
 *  2. collects the source spans the tokenizer cannot work out on its own
 *     (regular expressions, JSX text, JSX identifiers, private names), and
 *  3. records where a `>` must be its own token because it closes a type
 *     argument list.
 *
 * Doing it in one pass keeps the per-file cost to a single walk.
 */

import { decodeEntities } from './jsx-entities.ts';
import type { LineTable } from './line-table.ts';

export interface OxcNode {
  type: string;
  range: [number, number];
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
  [key: string]: unknown;
}

/** A source span the tokenizer must emit verbatim rather than lex. */
export interface ClaimedSpan {
  type: 'RegularExpression' | 'JSXText' | 'JSXIdentifier' | 'PrivateIdentifier' | 'Identifier';
  end: number;
  /** Overrides the raw source slice as the token's `value`. */
  value?: string;
  regex?: { pattern: string; flags: string };
}

export interface AstScan {
  /** Keyed by start offset. */
  claimed: Map<number, ClaimedSpan>;
  /** Start offset of every `Identifier` node, used to demote reserved words. */
  identifiers: Set<number>;
  /** Offsets at which a single `>` token must end. */
  angleCloses: Set<number>;
  /** Offsets at which a single `<` token must end. */
  angleOpens: Set<number>;
}

/**
 * Keys that never hold child nodes. Everything else is recursed into, because
 * node-bearing key names (`value`, `name`, `body`, ...) vary by node type and a
 * missed child would mean a node with no `loc`.
 */
const SKIPPED_KEYS = new Set(['type', 'range', 'loc', 'start', 'end']);

export function scanAst(program: OxcNode, code: string, lines: LineTable): AstScan {
  const claimed = new Map<number, ClaimedSpan>();
  const identifiers = new Set<number>();
  const angleCloses = new Set<number>();
  const angleOpens = new Set<number>();
  /** Children of `JSXNamespacedName`, which typescript-estree tokenizes as plain identifiers. */
  const namespacedParts: number[] = [];
  /** The `import` of `import.meta` and the `new` of `new.target`, which stay keywords. */
  const metaKeywords: number[] = [];

  const scan: AstScan = { claimed, identifiers, angleCloses, angleOpens };

  const walk = (node: unknown, insideJsx: boolean): void => {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const child of node) walk(child, insideJsx);
      return;
    }

    const record = node as Record<string, unknown>;
    const type = record['type'];
    let childrenInsideJsx = insideJsx;

    if (typeof type === 'string' && Array.isArray(record['range'])) {
      repairRange(type, record, code);
      const range = record['range'] as [number, number];
      record['loc'] = { start: lines.positionAt(range[0]), end: lines.positionAt(range[1]) };
      collect(type, record, range, code, scan, namespacedParts, metaKeywords);

      if (type === 'JSXElement' || type === 'JSXFragment') childrenInsideJsx = true;
      if (insideJsx && type === 'MemberExpression' && record['computed'] !== true) {
        claimJsxMemberParts(record, scan);
      }
    }

    for (const key in record) {
      if (SKIPPED_KEYS.has(key)) continue;
      walk(record[key], childrenInsideJsx);
    }
  };

  walk(program, false);

  // A namespaced JSX name is emitted by typescript-estree as `Identifier`
  // tokens, not `JSXIdentifier`. Applied last so it wins over the generic
  // `JSXIdentifier` claim made while walking.
  // `import.meta` and `new.target` hold `Identifier` nodes for the keyword half,
  // but typescript-estree still tokenizes `import` and `new` as keywords.
  for (const start of metaKeywords) scan.identifiers.delete(start);

  for (const start of namespacedParts) {
    const span = claimed.get(start);
    if (span !== undefined && span.type === 'JSXIdentifier') span.type = 'Identifier';
  }

  return scan;
}

/**
 * typescript-estree types every identifier inside a member expression as
 * `JSXIdentifier` as long as it has a JSX ancestor, so `{items.map(...)}` in a
 * JSX child yields `JSXIdentifier` for both `items` and `map`. That is a quirk
 * of how it walks TypeScript's tokens rather than anything ESTree requires, but
 * reproducing it keeps the token streams identical.
 */
function claimJsxMemberParts(record: Record<string, unknown>, scan: AstScan): void {
  for (const key of ['object', 'property'] as const) {
    const part = record[key] as OxcNode | undefined;
    if (part?.type === 'Identifier' && part.range) {
      scan.claimed.set(part.range[0], { type: 'JSXIdentifier', end: part.range[1] });
    }
  }
}

/**
 * Work around an oxc bug: a decorated parameter that is optional (`@dec x?: T`)
 * or has a default (`@dec x = 1`) gets a range that starts at the decorator,
 * where every other decorated parameter — and typescript-estree — starts at the
 * binding. Ranges drive `--fix`, so this has to be exact.
 *
 * `RestElement` and `TSParameterProperty` legitimately include their decorators
 * in both parsers and are left alone.
 */
function repairRange(type: string, record: Record<string, unknown>, code: string): void {
  if (type !== 'Identifier' && type !== 'AssignmentPattern') return;

  const decorators = record['decorators'] as OxcNode[] | undefined;
  const last = decorators?.[decorators.length - 1];
  if (!last?.range) return;

  const range = record['range'] as [number, number];
  if (range[0] > last.range[0]) return;

  record['range'] = [skipTrivia(code, last.range[1]), range[1]];
}

/** Advance past whitespace and comments. */
function skipTrivia(code: string, from: number): number {
  let pos = from;
  while (pos < code.length) {
    const char = code[pos]!;
    if (char === '/' && code[pos + 1] === '/') {
      const newline = code.indexOf('\n', pos);
      pos = newline === -1 ? code.length : newline + 1;
      continue;
    }
    if (char === '/' && code[pos + 1] === '*') {
      const close = code.indexOf('*/', pos);
      pos = close === -1 ? code.length : close + 2;
      continue;
    }
    if (!/\s/.test(char)) break;
    pos++;
  }
  return pos;
}

function collect(
  type: string,
  node: Record<string, unknown>,
  range: [number, number],
  code: string,
  scan: AstScan,
  namespacedParts: number[],
  metaKeywords: number[],
): void {
  switch (type) {
    case 'Identifier':
      scan.identifiers.add(range[0]);
      return;

    case 'JSXIdentifier':
      scan.claimed.set(range[0], { type: 'JSXIdentifier', end: range[1] });
      return;

    case 'TSTypeQuery': {
      // `typeof this` — TypeScript tokenizes the `this` of a type query as an
      // identifier, unlike a bare `this` type, which stays a keyword.
      let name = node['exprName'] as Record<string, unknown> | undefined;
      while (name?.['type'] === 'TSQualifiedName') name = name['left'] as Record<string, unknown>;
      if (name?.['type'] === 'ThisExpression') {
        const thisRange = name['range'] as [number, number] | undefined;
        if (thisRange) scan.identifiers.add(thisRange[0]);
      }
      return;
    }

    case 'TSImportType': {
      // `import('m', { with: { type: 'json' } })` in a type position: TypeScript
      // keeps `with` as a keyword token even though the AST holds an identifier.
      const options = node['options'] as Record<string, unknown> | undefined;
      for (const property of (options?.['properties'] as OxcNode[] | undefined) ?? []) {
        const key = property['key'] as OxcNode | undefined;
        if (key?.type === 'Identifier' && (key['name'] === 'with' || key['name'] === 'assert') && key.range) {
          metaKeywords.push(key.range[0]);
        }
      }
      return;
    }

    case 'MetaProperty': {
      const meta = node['meta'] as OxcNode | undefined;
      if (meta?.range) metaKeywords.push(meta.range[0]);
      return;
    }

    case 'JSXNamespacedName': {
      for (const key of ['namespace', 'name'] as const) {
        const part = node[key] as OxcNode | undefined;
        if (part?.range) namespacedParts.push(part.range[0]);
      }
      return;
    }

    case 'PrivateIdentifier':
      scan.claimed.set(range[0], {
        type: 'PrivateIdentifier',
        end: range[1],
        value: code.slice(range[0] + 1, range[1]),
      });
      return;

    case 'Literal': {
      const regex = node['regex'] as { pattern: string; flags: string } | undefined;
      if (regex) {
        scan.claimed.set(range[0], { type: 'RegularExpression', end: range[1], regex });
      }
      return;
    }

    case 'JSXText':
      node['value'] = decodeEntities(String(node['value'] ?? ''));
      return;

    case 'JSXAttribute': {
      const value = node['value'] as OxcNode | undefined;
      if (value?.type === 'Literal' && value.range) {
        // A JSX attribute string is a `JSXText` token, not a `String` token.
        scan.claimed.set(value.range[0], { type: 'JSXText', end: value.range[1] });
        if (typeof value['value'] === 'string') value['value'] = decodeEntities(value['value']);
      }
      return;
    }

    case 'JSXElement':
    case 'JSXFragment': {
      claimJsxText(type, node, scan);
      return;
    }

    case 'TSTypeParameterInstantiation':
    case 'TSTypeParameterDeclaration':
      scan.angleOpens.add(range[0] + 1);
      scan.angleCloses.add(range[1]);
      return;

    case 'TSTypeAssertion': {
      // `<T>expr`: the closing `>` sits between the type and the expression.
      const annotation = node['typeAnnotation'] as OxcNode | undefined;
      if (annotation?.range) {
        const close = code.indexOf('>', annotation.range[1]);
        if (close !== -1) scan.angleCloses.add(close + 1);
      }
      return;
    }
  }
}

/**
 * JSX text tokens are the parts of an element's children region that are not
 * covered by a nested element or an expression container. Deriving them as the
 * complement rather than from `JSXText` nodes reproduces typescript-estree,
 * which starts each JSX text token at the end of the previous token (so leading
 * whitespace belongs to the text token) and emits nothing for empty gaps.
 */
function claimJsxText(type: string, node: Record<string, unknown>, scan: AstScan): void {
  const opening = node[type === 'JSXElement' ? 'openingElement' : 'openingFragment'] as OxcNode | undefined;
  const closing = node[type === 'JSXElement' ? 'closingElement' : 'closingFragment'] as OxcNode | undefined;
  if (!opening?.range || !closing?.range) return;

  let cursor = opening.range[1];
  const regionEnd = closing.range[0];
  const children = (node['children'] as OxcNode[] | undefined) ?? [];

  for (const child of children) {
    if (child.type === 'JSXText' || !child.range) continue;
    if (child.range[0] > cursor) {
      scan.claimed.set(cursor, { type: 'JSXText', end: child.range[0] });
    }
    cursor = Math.max(cursor, child.range[1]);
  }

  if (regionEnd > cursor) {
    scan.claimed.set(cursor, { type: 'JSXText', end: regionEnd });
  }
}
