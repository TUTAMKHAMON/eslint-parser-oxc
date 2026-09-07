/**
 * Scope-analysis cases, checked against the reference parser.
 *
 * These are the constructs where a parser that hands ESLint a plain ESTree tree
 * gets scope wrong: type-only references, enums, namespaces, overloads,
 * declaration merging, `satisfies`, `using`, decorators and
 * `import x = require()`.
 *
 * The expected findings are not written by hand — they are whatever
 * typescript-eslint produces, captured by `conformance/reference/scope.mjs`. The
 * test then asserts this parser produces exactly the same, including the cases
 * where an ESLint *core* rule is simply not TypeScript-aware (core
 * `no-redeclare` does not understand declaration merging, for instance). Parity
 * is the property under test, not the rule's opinion.
 */

export const RULES = {
  'no-unused-vars': 'error',
  'no-undef': 'error',
  'no-shadow': 'error',
  'no-redeclare': 'error',
  'no-use-before-define': 'error',
};

export const CASES = [
  {
    name: 'type-only import used in a type position',
    file: 'a.ts',
    code: "import type { Readable } from 'stream';\nexport const x: Readable = null!;\n",
  },
  {
    name: 'type-only import that nothing references',
    file: 'a.ts',
    code: "import type { Unused } from 'stream';\nexport const x = 1;\n",
  },
  {
    name: 'inline type specifier used only in a generic',
    file: 'a.ts',
    code: "import { type Item, value } from './items';\nexport const x: Array<Item> = [value];\n",
  },
  {
    name: 'enum, namespace and satisfies references',
    file: 'a.ts',
    code: [
      'enum Direction { Up, Down }',
      'namespace Space { export const value = 1; }',
      'interface Shape { kind: string }',
      'const used = { kind: Direction[Direction.Up] } satisfies Shape;',
      'export { used, Space };',
      '',
    ].join('\n'),
  },
  {
    name: 'declaration merging of a function and a namespace',
    file: 'a.ts',
    code: 'function merged(): void {}\nnamespace merged { export const extra = 1; }\nexport { merged };\n',
  },
  {
    name: 'interface declaration merging',
    file: 'a.ts',
    code: 'interface Merged { a: string }\ninterface Merged { b: number }\nexport type { Merged };\n',
  },
  {
    name: 'function overloads',
    file: 'a.ts',
    code: [
      'export function overloaded(a: string): string;',
      'export function overloaded(a: number): number;',
      'export function overloaded(a: unknown): unknown { return a; }',
      '',
    ].join('\n'),
  },
  {
    name: 'generic type parameters are not undefined values',
    file: 'a.ts',
    code: 'export function identity<T>(value: T): T { return value; }\n',
  },
  {
    name: 'undeclared value is still reported',
    file: 'a.ts',
    code: 'export const x = notDeclaredAnywhere;\n',
  },
  {
    name: 'shadowing in a nested block',
    file: 'a.ts',
    code: 'export function outer(shadowed: string) {\n  { let shadowed = 1; void shadowed; }\n  return shadowed;\n}\n',
  },
  {
    name: 'type used before its alias is declared',
    file: 'a.ts',
    code: 'export const value: Later = null!;\ntype Later = string;\n',
  },
  {
    name: 'decorators reference their imports',
    file: 'a.ts',
    code: "import { Component } from './decorators';\n@Component({})\nexport class Widget {}\n",
  },
  {
    name: 'import x = require()',
    file: 'a.ts',
    code: "import legacy = require('./legacy');\nexport const x = legacy.thing;\n",
  },
  {
    name: 'using and await using declarations',
    file: 'a.ts',
    code: 'declare function open(): Disposable;\nexport async function run() {\n  using handle = open();\n  await using other = open();\n  return [handle, other];\n}\n',
  },
  {
    name: 'ambient declarations in a .d.ts file',
    file: 'a.d.ts',
    code: 'declare const globalValue: number;\ndeclare function globalFn(a: string): void;\nexport { globalValue, globalFn };\n',
  },
  {
    name: 'JSX pragma keeps React referenced',
    file: 'a.tsx',
    code: "import React from 'react';\nexport const El = () => <div />;\n",
  },
  {
    name: 'const enum and declare enum',
    file: 'a.ts',
    code: 'export const enum Flag { On = 1 }\ndeclare enum Ambient { X }\nexport const use = Flag.On;\n',
  },
];

/** One comparable line per finding. */
export function fingerprint(messages) {
  return messages.map(
    (message) =>
      `${message.line}:${message.column}:${message.endLine ?? 0}:${message.endColumn ?? 0} ` +
      `${message.ruleId ?? 'FATAL'} ${message.message}`,
  );
}
