/**
 * Declared, intentional differences between this parser and the reference.
 *
 * Anything listed here is excluded from the AST diff. Each entry must have a
 * reason, and each is reproduced in DIVERGENCES.md. Nothing else is excluded:
 * if the diff is empty and this file is empty, the ASTs are identical.
 */

export const DECLARED = [
  {
    key: 'start',
    reason:
      'oxc emits `start`/`end` alongside `range` on every node. ESLint never reads them and ' +
      'stripping them would cost a second pass over every node, so they are left in place.',
  },
  {
    key: 'end',
    reason: 'See `start`.',
  },
];

/**
 * Not a key exclusion but a value equivalence: an absent child is spelled
 * `undefined` by typescript-estree and `null` by oxc. ESLint treats both the
 * same — `visitorKeys` traversal skips falsy children and rules test
 * truthiness — so the diff folds them together outside `Literal.value`.
 */
export const ABSENT_VALUES_EQUIVALENT = true;

/** Keys dropped only on a particular node type, as `Type.key`. */
export const DECLARED_BY_TYPE = [
  {
    key: 'TemplateElement.value',
    reason:
      "`value.cooked` disagrees with typescript-estree for templates containing escapes. oxc " +
      'matches espree — ESLint\'s own parser — and the specification, including `cooked: null` for ' +
      'an invalid escape in a tagged template. Pinned against espree in test/template-cooked.test.ts.',
  },
  {
    key: 'TSEnumMember.computed',
    reason:
      'oxc always emits `computed` on an enum member; typescript-estree omits it. Computed enum ' +
      'member names are a TypeScript error anyway, so the flag is always `false` in valid code.',
  },
];

/**
 * Comment differences, compared separately from the AST so both can be reported.
 * typescript-estree drops a hashbang entirely; espree — ESLint's own parser —
 * reports it as a `Hashbang` comment, and so do we.
 */
export const HASHBANG_COMMENT = {
  reason:
    'A `#!` line is a `Hashbang` comment here and in espree, and absent in typescript-estree. ' +
    'Program.range starts after it in all three.',
};

export const DROPPED_KEYS = new Set(DECLARED.map((entry) => entry.key));
export const DROPPED_BY_TYPE = new Map(
  DECLARED_BY_TYPE.map((entry) => {
    const [type, key] = entry.key.split('.');
    return [type, key];
  }),
);
