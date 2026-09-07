# Divergences

Everything this parser does differently from
[`@typescript-eslint/parser`](https://typescript-eslint.io) 8.69 running on
TypeScript 6, plus the places `oxc-parser` needed help.

The reference for every claim here is the differential suite: `npm run
conformance` parses a corpus with both parsers and diffs the normalised ASTs —
nodes, ranges, locs, comments and tokens. As of `oxc-parser@0.148.0`, **2754 of
2754 comparable files are identical**, and `npm run conformance:lint` finds
**0 differences across 17,050 ESLint findings** and **0 files whose `--fix`
output differs**. Everything below is either excluded from that diff by an
explicit declaration in `conformance/lib/divergences.mjs`, or is a
parse/reject difference tracked in `conformance/strictness*.json`.

---

## 1. The token stream is built here, not by oxc

`oxc-parser` does have a token API: `parseSync(…, { experimentalRawTransfer:
true, experimentalTokens: true })` returns a `tokens` array, and the JS-side
deserializer in `src-js/raw-transfer/eager.js` already emits Esprima-style token
types.

It does not work in the published package. The Rust side gates token collection
behind a Cargo feature:

```toml
# napi/parser/Cargo.toml
[features]
default = []
tokens = ["dep:oxc_estree_tokens"]
```

and the release build does not enable it:

```json
"build": "pnpm run build-dev --features allocator --release"
```

So `experimentalTokens: true` returns `[]` with no error. Confirmed on
`oxc-parser@0.148.0` / darwin-arm64 by reading the token length directly out of
the raw-transfer buffer (`TOKENS_LEN_POS_32` is `0`).

Tokens are not optional — `sourceCode.getTokenBefore`, `getFirstToken` and every
fixer depend on them — so `src/tokenizer.ts` produces them. It is a plain
ECMAScript scanner for the unambiguous parts, and takes the two genuinely
ambiguous decisions from the AST rather than guessing:

- **`/` — regular expression or division.** Every `Literal` node carrying a
  `regex` property contributes its exact span, so the scanner never has to
  apply the "what was the previous token" heuristic.
- **JSX.** JSX text tokens are derived as the *complement* of an element's
  non-text children inside its children region, which reproduces
  typescript-estree exactly, including its use of `getFullStart()` (leading
  whitespace belongs to the text token) and its omission of empty gaps.

Two more things come from the AST:

- **Reserved words in identifier positions.** `a.class`, `{ default: 1 }`,
  `enum E { new }` and `interface I { delete(): void }` are `Identifier` tokens,
  not `Keyword`. The scanner classifies purely lexically and then demotes any
  word that an `Identifier` node starts at. `import.meta` and `new.target` are
  the exceptions in the other direction: they hold `Identifier` nodes but stay
  keywords, so they are re-promoted.
- **The `>` that closes a type argument list.** `Array<Array<T>>` must be two
  `>` tokens, while `1 >> 2` is one `>>`. The ends of every
  `TSTypeParameterInstantiation`, `TSTypeParameterDeclaration` and
  `TSTypeAssertion` say where the split goes.

If oxc ever ships the `tokens` feature enabled, this module can be deleted; the
conformance suite is what will say whether that swap is safe.

## 2. `TemplateElement.value.cooked`

typescript-estree derives `cooked` from TypeScript's scanner, which disagrees
with the specification for escapes. This parser matches **espree** — ESLint's
own parser — and therefore acorn and the spec:

| source | espree / here | typescript-estree |
| --- | --- | --- |
| ``tag`\1(a)` `` | `cooked: null` | `cooked: "\\1(a)"` |
| ``tag`\u{}` `` | `cooked: null` | `cooked: "\\u{}"` |
| ``String.raw`[ \\uf\e0f]` `` | `cooked: "[ \\ufe0f]"` | `cooked: null` |

An invalid escape in a *tagged* template is legal and must produce
`cooked: undefined`/`null`; a valid one must be cooked. Pinned against espree in
`test/template-cooked.test.ts`, and excluded from the AST diff.

## 3. Hashbang

A `#!` line is reported as a `Hashbang` comment, exactly as espree does.
typescript-estree drops it entirely. All three parsers start `Program.range`
after it, so nothing else moves.

This only shows up when the parser is called directly, by tooling that invokes
`parseForESLint` itself. ESLint rewrites `#!` to `//` before it ever reaches a
parser:

```js
// eslint/lib/languages/js/index.js
const textToParse = text.replace(astUtils.shebangPattern, (match, captured) => `//${captured}`);
```

so under ESLint the line arrives as an ordinary `Line` comment either way. The
espree behaviour is the one worth matching for everyone else, since it is
ESLint's own parser and core rules (`lines-around-comment`, `no-inline-comments`)
are written against it.

## 4. Extra properties oxc emits

| property | note |
| --- | --- |
| `start` / `end` on every node | oxc emits these alongside `range`. ESLint never reads them, and removing them would cost a second pass over every node, so they stay. Babel's ESLint parser emits them too. |
| `TSEnumMember.computed` | Always `false` in valid code — a computed enum member name is a TypeScript error. typescript-estree omits the property. |

## 5. Absent children are `null`, not `undefined`

typescript-estree writes `typeAnnotation: undefined`, `superClass: undefined`
and so on; oxc writes `null`. ESLint treats them identically — `visitorKeys`
traversal skips falsy children and every rule tests truthiness — so the diff
folds them together, except for `Literal.value`, where `null` is a real value.

## 6. Two typescript-estree quirks reproduced on purpose

Both are token types, both come from how typescript-estree walks TypeScript's
token tree rather than from anything ESTree requires, and both are reproduced
here so the token streams match:

- **Identifiers in member expressions inside JSX** are `JSXIdentifier`. In
  `<div>{items.map(fn)}</div>`, both `items` and `map` come out as
  `JSXIdentifier`. (`getTokenType` in `node-utils.ts`: an `Identifier` whose
  parent is a `PropertyAccessExpression` and which has a JSX ancestor.)
- **A namespaced JSX name** — `<svg:rect a:b="c" />` — tokenizes as `Identifier`,
  not `JSXIdentifier`, even though the AST nodes are `JSXIdentifier`.

## 7. Token coverage where typescript-estree has a gap

When two type argument lists open in a row, typescript-estree emits one `<`
where the source has two, leaving a character covered by no token:

```ts
const r = g<<U>(u: U) => U>(null as any);
//         ^^ typescript-estree emits a single `<`
```

This parser emits both, so the token stream covers the whole file. Checked by
`test/tokens.test.ts`, which asserts that tokens and comments together account
for every non-whitespace character.

## 8. oxc rejects code TypeScript's parser accepts

TypeScript's parser recovers from most errors and hands typescript-estree a tree
anyway; the error surfaces later, from the compiler. oxc reports these at parse
time, so ESLint sees a fatal parse error instead of rule findings.

Across the external corpus this is 38 files out of 3,124, and every one is code
TypeScript itself rejects. The full list is checked in as
`conformance/strictness-corpus.json` so a new one fails the suite rather than
slipping through. The classes:

| count | message |
| --- | --- |
| 9 | `A 'return' statement can only be used within a function body.` |
| 6 | `Missing initializer in destructuring declaration` |
| 5 | `'const' modifier can only appear on a type parameter of a function, method or class` |
| 2 | `Only ambient modules can use quoted names.` |
| 2 | `Missing initializer in const declaration` |
| 2 | `Type parameters cannot appear on a constructor declaration` |
| 1 each | `accessor` with `declare`/`readonly`, accessibility modifier on a private name, `await` outside an async context, `new.target` at the top level, index-signature arity/annotation errors, `declare` in an ambient context, a `set` accessor with a return type |

Top-level `return` is the only one of these that is legal in some
configurations, and it is supported: `ecmaFeatures.globalReturn: true` parses
the file as CommonJS, which is the mode in which oxc allows it.

In the other direction, oxc accepts 11 corpus files that typescript-estree
rejects. All are typescript-eslint's own `_error_` fixtures.

## 9. Things oxc gets wrong that this parser repairs

- **Parameter decorator ranges.** A decorated parameter that is optional or has
  a default gets a range starting at the decorator, where every other decorated
  parameter — and typescript-estree — starts at the binding:

  ```ts
  class A { m(@c() x: number, @c() y?: boolean, @c() z = 1) {} }
  //          x: [17,26] ✓     y: [@c()…] ✗      z: [@c()…] ✗
  ```

  Ranges drive `--fix`, so `src/ast.ts` moves the range start past the last
  decorator for `Identifier` and `AssignmentPattern` parameters. `RestElement`
  and `TSParameterProperty` legitimately include their decorators in both
  parsers and are left alone.

- **JSX entity decoding.** oxc reports JSX text and JSX attribute string values
  verbatim, entities and all. TypeScript, Babel and the JSX runtime all decode
  them, and `react/no-unescaped-entities` reads the decoded `value`, so
  `src/jsx-entities.ts` decodes numeric references and the same 253 HTML 4 named
  entities TypeScript's JSX scanner knows. Unknown names are left alone, as in
  TypeScript.

## 10. Options that are accepted and ignored

- **`ecmaVersion`** — oxc always parses the latest ECMAScript syntax. Passing
  `2015` will not make `const { a } = b` a syntax error.
- **`ecmaFeatures.impliedStrict`** — not passed through to oxc.

## 11. Out of scope by design

No type information: `services` is `{}`, there is no `parserServices.program`,
no `projectService`, and no support for `parserOptions.project`. Type-aware
rules need a type checker, and TypeScript 7 has no JavaScript API to be one.
Flow, Vue SFCs, Svelte and MDX are not supported.
