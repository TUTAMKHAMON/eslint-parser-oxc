/**
 * Token stream for the ESLint AST.
 *
 * `oxc-parser` has a token API in its JS layer, but the published native
 * binaries are built without the Rust `tokens` feature, so `experimentalTokens`
 * always yields an empty array (see DIVERGENCES.md). Rules reach for tokens
 * constantly — `sourceCode.getTokenBefore`, `getFirstToken`, every whitespace
 * and fixer rule — so the stream is produced here instead.
 *
 * The lexer is a plain ECMAScript scanner. The two things a scanner cannot
 * decide on its own, whether a `/` starts a regular expression and where JSX
 * text begins and ends, are taken from the AST instead of guessed (see
 * `scanAst`), which makes the result exact rather than heuristic.
 */

import type { AstScan, ClaimedSpan } from './ast.ts';
import type { LineTable, Position } from './line-table.ts';

export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface Token {
  type: string;
  value: string;
  range: [number, number];
  loc: SourceLocation;
  regex?: { pattern: string; flags: string };
}

/** A comment as `oxc-parser` reports it: offsets only, no `range` and no `loc`. */
export interface CommentSpan {
  type: 'Line' | 'Block';
  value: string;
  start: number;
  end: number;
}

export interface Comment {
  type: 'Line' | 'Block' | 'Hashbang';
  value: string;
  range: [number, number];
  loc: SourceLocation;
}

/**
 * Words that typescript-estree reports as `Keyword`.
 *
 * This is TypeScript's set of reserved words, and deliberately excludes
 * contextual keywords (`as`, `async`, `await`, `type`, `satisfies`, `declare`,
 * `abstract`, `readonly`, `accessor`, `of`, `from`, ...), which it reports as
 * `Identifier`. Reserved words used in identifier positions — `a.class`,
 * `{ default: 1 }`, `enum E { new }` — are demoted to `Identifier` by the
 * `Identifier` node spans collected from the AST, so this list can stay purely
 * lexical.
 */
const RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for',
  'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface',
  'let', 'new', 'private', 'protected', 'public', 'return', 'static', 'super',
  'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield',
]);

const PUNCTUATORS_4 = new Set(['>>>=']);
const PUNCTUATORS_3 = new Set(['...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=']);
const PUNCTUATORS_2 = new Set([
  '=>', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '&&', '||', '??', '++', '--', '**', '<<', '>>', '?.',
]);

/** What a `}` closes: an ordinary block, or the hole in a template literal. */
const CTX_BRACE = 0;
const CTX_TEMPLATE = 1;
type Ctx = typeof CTX_BRACE | typeof CTX_TEMPLATE;

const CHAR_TAB = 9;
const CHAR_LF = 10;
const CHAR_VT = 11;
const CHAR_FF = 12;
const CHAR_CR = 13;
const CHAR_SPACE = 32;
const CHAR_BANG = 33;
const CHAR_QUOTE = 34;
const CHAR_HASH = 35;
const CHAR_DOLLAR = 36;
const CHAR_APOS = 39;
const CHAR_DOT = 46;
const CHAR_0 = 48;
const CHAR_9 = 57;
const CHAR_QUESTION = 63;
const CHAR_A_UPPER = 65;
const CHAR_Z_UPPER = 90;
const CHAR_BACKSLASH = 92;
const CHAR_UNDERSCORE = 95;
const CHAR_BACKTICK = 96;
const CHAR_A_LOWER = 97;
const CHAR_Z_LOWER = 122;
const CHAR_LBRACE = 123;
const CHAR_RBRACE = 125;
const CHAR_GT = 62;
const CHAR_LT = 60;
const CHAR_NBSP = 0xa0;
const CHAR_BOM = 0xfeff;

function isWhitespace(code: number): boolean {
  if (code === CHAR_SPACE || code === CHAR_TAB || code === CHAR_LF || code === CHAR_CR) return true;
  if (code < CHAR_NBSP) return code === CHAR_VT || code === CHAR_FF;
  if (code === CHAR_NBSP || code === CHAR_BOM) return true;
  return code >= 0x1680 && /\s/.test(String.fromCharCode(code));
}

function isIdentifierStart(code: number): boolean {
  return (
    (code >= CHAR_A_LOWER && code <= CHAR_Z_LOWER) ||
    (code >= CHAR_A_UPPER && code <= CHAR_Z_UPPER) ||
    code === CHAR_UNDERSCORE ||
    code === CHAR_DOLLAR ||
    code === CHAR_BACKSLASH ||
    code >= 0x80
  );
}

function isIdentifierPart(code: number): boolean {
  return isIdentifierStart(code) || (code >= CHAR_0 && code <= CHAR_9);
}

function isDigit(code: number): boolean {
  return code >= CHAR_0 && code <= CHAR_9;
}

/**
 * Turn source text into an ESLint token stream.
 *
 * @param code       source text
 * @param scan       spans and hints collected from the AST
 * @param comments   comments from oxc, in source order; skipped by the lexer
 * @param lines      line table used to attach `loc`
 */
export function tokenize(code: string, scan: AstScan, comments: CommentSpan[], lines: LineTable): Token[] {
  const tokens: Token[] = [];
  const length = code.length;
  const { claimed, identifiers, angleCloses, angleOpens } = scan;
  /** Tracks whether a `}` closes a block or resumes a template literal. */
  const contexts: Ctx[] = [];

  // Claim starts, in source order, so the hot loop only does an integer
  // comparison per character instead of a map lookup.
  const claimStarts = [...claimed.keys()].sort((a, b) => a - b);
  let claimIndex = 0;
  let pos = 0;
  let commentIndex = 0;

  const push = (type: string, start: number, end: number, value?: string, regex?: { pattern: string; flags: string }): void => {
    const token: Token = {
      type,
      value: value ?? code.slice(start, end),
      range: [start, end],
      loc: { start: lines.positionAt(start), end: lines.positionAt(end) },
    };
    if (regex !== undefined) token.regex = regex;
    tokens.push(token);
  };

  // A hashbang is not a token and oxc does not always list it as a comment.
  if (length > 1 && code.charCodeAt(0) === CHAR_HASH && code.charCodeAt(1) === CHAR_BANG) {
    pos = lineEnd(code, 2);
  }

  while (pos < length) {
    while (commentIndex < comments.length && comments[commentIndex]!.end <= pos) commentIndex++;
    const comment = comments[commentIndex];
    if (comment !== undefined && comment.start === pos) {
      pos = comment.end;
      continue;
    }

    // Checked before whitespace: a JSX text token can start with whitespace,
    // and its leading whitespace belongs to the token.
    while (claimIndex < claimStarts.length && claimStarts[claimIndex]! < pos) claimIndex++;
    if (claimStarts[claimIndex] === pos) {
      pos = emitClaimed(claimed.get(pos)!, pos, push);
      claimIndex++;
      continue;
    }

    const char = code.charCodeAt(pos);

    if (isWhitespace(char)) {
      pos++;
      continue;
    }

    if (isIdentifierStart(char)) {
      const end = readWord(code, pos);
      push(wordType(code.slice(pos, end), pos, identifiers), pos, end);
      pos = end;
      continue;
    }

    if (isDigit(char) || (char === CHAR_DOT && isDigit(code.charCodeAt(pos + 1)))) {
      const end = readNumber(code, pos);
      push('Numeric', pos, end);
      pos = end;
      continue;
    }

    if (char === CHAR_QUOTE || char === CHAR_APOS) {
      const end = readString(code, pos, char);
      push('String', pos, end);
      pos = end;
      continue;
    }

    if (char === CHAR_BACKTICK) {
      const { end, open } = readTemplate(code, pos);
      push('Template', pos, end);
      if (open) contexts.push(CTX_TEMPLATE);
      pos = end;
      continue;
    }

    if (char === CHAR_RBRACE && contexts[contexts.length - 1] === CTX_TEMPLATE) {
      contexts.pop();
      const { end, open } = readTemplate(code, pos);
      push('Template', pos, end);
      if (open) contexts.push(CTX_TEMPLATE);
      pos = end;
      continue;
    }

    if (char === CHAR_LBRACE) {
      contexts.push(CTX_BRACE);
      push('Punctuator', pos, pos + 1);
      pos += 1;
      continue;
    }

    if (char === CHAR_RBRACE) {
      contexts.pop();
      push('Punctuator', pos, pos + 1);
      pos += 1;
      continue;
    }

    const end = readPunctuator(code, pos, angleCloses, angleOpens);
    push('Punctuator', pos, end);
    pos = end;
  }

  return tokens;
}

function emitClaimed(
  claim: ClaimedSpan,
  start: number,
  push: (type: string, start: number, end: number, value?: string, regex?: { pattern: string; flags: string }) => void,
): number {
  push(claim.type, start, claim.end, claim.value, claim.regex);
  return claim.end;
}

function wordType(value: string, start: number, identifiers: Set<number>): string {
  // Only the start is compared: a parameter's `Identifier` node covers its type
  // annotation too, so `(this: Ctx)` has an `Identifier` spanning `this: Ctx`.
  if (identifiers.has(start)) return 'Identifier';
  if (value === 'true' || value === 'false') return 'Boolean';
  if (value === 'null') return 'Null';
  if (RESERVED.has(value)) return 'Keyword';
  return 'Identifier';
}

function lineEnd(code: string, from: number): number {
  let pos = from;
  while (pos < code.length) {
    const char = code.charCodeAt(pos);
    if (char === CHAR_LF || char === CHAR_CR || char === 0x2028 || char === 0x2029) break;
    pos++;
  }
  return pos;
}

function readWord(code: string, start: number): number {
  let pos = start;
  while (pos < code.length) {
    const char = code.charCodeAt(pos);
    if (char === CHAR_BACKSLASH) {
      // `\u{...}` or `\uXXXX` escape inside an identifier.
      pos += 2;
      if (code.charCodeAt(pos) === CHAR_LBRACE) {
        const close = code.indexOf('}', pos);
        pos = close === -1 ? code.length : close + 1;
      } else {
        pos += 4;
      }
      continue;
    }
    if (!isIdentifierPart(char)) break;
    pos++;
  }
  return pos;
}

function readNumber(code: string, start: number): number {
  const second = code.charCodeAt(start + 1);
  if (
    code.charCodeAt(start) === CHAR_0 &&
    (second === 120 || second === 88 || second === 98 || second === 66 || second === 111 || second === 79)
  ) {
    // `0x` / `0b` / `0o`, with digits, separators and an optional `n` suffix.
    let pos = start + 2;
    while (pos < code.length && isIdentifierPart(code.charCodeAt(pos))) pos++;
    return pos;
  }

  let pos = start;
  let seenDot = false;
  let seenExponent = false;
  while (pos < code.length) {
    const char = code.charCodeAt(pos);

    if (isDigit(char) || char === CHAR_UNDERSCORE) {
      pos++;
      continue;
    }

    // A number has at most one `.`, and none after an exponent. Without this,
    // `1..toString()` reads as one number instead of `1.` and a member access.
    if (char === CHAR_DOT && !seenDot && !seenExponent) {
      seenDot = true;
      pos++;
      continue;
    }

    if ((char === 101 || char === 69) && !seenExponent) {
      // `e` / `E` only counts as an exponent when a digit follows it, so that
      // `1e` stays a single malformed number rather than swallowing an operator.
      const next = code.charCodeAt(pos + 1);
      const afterSign = next === 43 || next === 45 ? code.charCodeAt(pos + 2) : next;
      if (!isDigit(afterSign)) break;
      seenExponent = true;
      pos += next === 43 || next === 45 ? 2 : 1;
      continue;
    }

    if (char === 110) pos++; // BigInt suffix `n`
    break;
  }
  return pos;
}

function readString(code: string, start: number, quote: number): number {
  let pos = start + 1;
  while (pos < code.length) {
    const char = code.charCodeAt(pos);
    if (char === CHAR_BACKSLASH) {
      pos += 2;
      continue;
    }
    pos++;
    if (char === quote) break;
  }
  return pos;
}

/**
 * Read one template chunk, starting at a backtick or at the `}` that resumes a
 * template. Returns where the chunk ends and whether it opened a `${`
 * substitution, matching espree's `` `a${ `` / `` }b${ `` / `` }c` `` chunking.
 */
function readTemplate(code: string, start: number): { end: number; open: boolean } {
  let pos = start + 1;
  while (pos < code.length) {
    const char = code.charCodeAt(pos);
    if (char === CHAR_BACKSLASH) {
      pos += 2;
      continue;
    }
    if (char === CHAR_BACKTICK) return { end: pos + 1, open: false };
    if (char === CHAR_DOLLAR && code.charCodeAt(pos + 1) === CHAR_LBRACE) {
      return { end: pos + 2, open: true };
    }
    pos++;
  }
  return { end: code.length, open: false };
}

function readPunctuator(code: string, start: number, angleCloses: Set<number>, angleOpens: Set<number>): number {
  const char = code.charCodeAt(start);

  // A `>` that closes a type argument list is always its own token, so
  // `Array<Array<T>>` yields two `>` rather than one `>>`. TypeScript's scanner
  // re-scans the same way, and fixers depend on the split.
  if (char === CHAR_GT && angleCloses.has(start + 1)) return start + 1;
  // Mirror image: `f<<T>() => T>()` opens two argument lists in a row.
  if (char === CHAR_LT && angleOpens.has(start + 1)) return start + 1;

  // `a ? .5 : b` is a conditional and a number, not an optional chain.
  if (char === CHAR_QUESTION && code.charCodeAt(start + 1) === CHAR_DOT && isDigit(code.charCodeAt(start + 2))) {
    return start + 1;
  }

  if (PUNCTUATORS_4.has(code.slice(start, start + 4))) return start + 4;
  if (PUNCTUATORS_3.has(code.slice(start, start + 3))) return start + 3;
  if (PUNCTUATORS_2.has(code.slice(start, start + 2))) return start + 2;
  return start + 1;
}

/**
 * Rebuild oxc's comments as ESLint comments: `{ type, value, range, loc }`,
 * without the `start`/`end` offsets oxc also carries.
 */
export function convertComments(comments: CommentSpan[], lines: LineTable): Comment[] {
  return comments.map((comment) => ({
    type: comment.type,
    value: comment.value,
    range: [comment.start, comment.end] as [number, number],
    loc: { start: lines.positionAt(comment.start), end: lines.positionAt(comment.end) },
  }));
}
