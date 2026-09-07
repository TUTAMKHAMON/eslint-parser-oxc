/**
 * Shared AST normalisation for the differential test.
 *
 * Runs on both sides — the reference (typescript-eslint on TypeScript 6, in its
 * own install) and this parser — so the diff only shows real disagreements.
 * Every key removed here is a declared divergence: see `divergences.mjs`.
 */

import { DROPPED_BY_TYPE, DROPPED_KEYS } from './divergences.mjs';

/** Stands in for both `null` and `undefined` in child positions. */
const ABSENT = '«absent»';

/** Keys that exist only to make the AST walkable and are never compared. */
const STRUCTURAL = new Set(['parent']);

/** Drop `Hashbang` comments so the declared hashbang divergence is not re-reported. */
export function stripHashbangComments(ast) {
  if (Array.isArray(ast?.comments)) {
    ast.comments = ast.comments.filter((comment) => comment.type !== 'Hashbang');
  }
  return ast;
}

export function normalize(value) {
  // JSON cannot carry these, and they appear as `Literal.value`.
  if (typeof value === 'bigint') return `«bigint ${value}»`;
  if (typeof value === 'undefined') return ABSENT;
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof RegExp) return `«regexp ${value.source}/${value.flags}»`;

  // `Literal.value` is the one place a real `null` is meaningful.
  const literalValue = value.type === 'Literal';

  const droppedForType = DROPPED_BY_TYPE.get(value.type);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (STRUCTURAL.has(key)) continue;
    if (DROPPED_KEYS.has(key)) continue;
    if (droppedForType === key) continue;
    // `null` and `undefined` are interchangeable for an absent child: ESLint
    // skips falsy children when traversing and every rule tests truthiness.
    // `value` is exempt, because `null` is a real literal value there.
    const child = value[key];
    const meaningfulNull = literalValue && key === 'value';
    out[key] = child === null && !meaningfulNull ? ABSENT : normalize(child);
  }
  return out;
}

/**
 * Structural diff of two normalised values.
 *
 * @returns {{path: string, expected: unknown, actual: unknown}[]}
 */
export function diff(expected, actual, path = '', out = [], limit = 200) {
  if (out.length >= limit) return out;

  if (expected === actual) return out;

  const bothObjects =
    expected !== null && actual !== null && typeof expected === 'object' && typeof actual === 'object';

  if (!bothObjects) {
    out.push({ path, expected, actual });
    return out;
  }

  if (Array.isArray(expected) !== Array.isArray(actual)) {
    out.push({ path, expected: kindOf(expected), actual: kindOf(actual) });
    return out;
  }

  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      out.push({ path: `${path}.length`, expected: expected.length, actual: actual.length });
    }
    const shared = Math.min(expected.length, actual.length);
    for (let i = 0; i < shared; i++) diff(expected[i], actual[i], `${path}[${i}]`, out, limit);
    return out;
  }

  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of [...keys].sort()) {
    const has = Object.hasOwn(expected, key);
    const other = Object.hasOwn(actual, key);
    if (!has || !other) {
      out.push({
        path: `${path}.${key}`,
        expected: has ? summarise(expected[key]) : '<missing>',
        actual: other ? summarise(actual[key]) : '<missing>',
      });
      continue;
    }
    diff(expected[key], actual[key], `${path}.${key}`, out, limit);
  }
  return out;
}

function kindOf(value) {
  return Array.isArray(value) ? 'array' : typeof value;
}

function summarise(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return `array(${value.length})`;
  return value.type ? `${value.type} node` : 'object';
}
