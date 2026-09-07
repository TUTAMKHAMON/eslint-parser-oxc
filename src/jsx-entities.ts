/**
 * JSX entity decoding.
 *
 * oxc reports JSX text and JSX attribute string values exactly as written,
 * entities and all. TypeScript, Babel and the JSX runtime all decode them, and
 * rules such as `react/no-unescaped-entities` read the decoded `value`, so the
 * decoding is done here.
 */

import { HTML_ENTITIES } from './html-entities.ts';

const ENTITY = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;

/** Decode HTML entities, leaving unrecognised names untouched. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;

  return text.replace(ENTITY, (match, name: string) => {
    if (name.charCodeAt(0) === 35 /* # */) {
      const hex = name.charCodeAt(1) === 120 || name.charCodeAt(1) === 88; // x / X
      const codePoint = Number.parseInt(hex ? name.slice(2) : name.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      return String.fromCodePoint(codePoint);
    }
    const codePoint = HTML_ENTITIES[name];
    return codePoint === undefined ? match : String.fromCodePoint(codePoint);
  });
}
