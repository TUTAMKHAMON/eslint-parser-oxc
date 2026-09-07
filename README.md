# eslint-parser-oxc

An ESLint 9/10 custom parser backed by [`oxc-parser`](https://oxc.rs), the
Rust-based Oxc parser. It parses JavaScript, JSX, TypeScript and TSX for
**syntax-only rules**, and it does not depend on `typescript` at runtime.

That last part is the point. TypeScript 7 ships no JavaScript API, so
`@typescript-eslint/parser` cannot run in a repo that has moved to it. The
usual escape hatch is `@babel/eslint-parser`, which works but is a JavaScript
parser with a Babel-AST-to-ESTree conversion layer and drags in `@babel/core`.
This is a thin adapter over a parser that already emits an ESTree/TS-ESTree
shaped AST.

```
npm install --save-dev eslint-parser-oxc
```

Runtime dependencies: `oxc-parser`, `@typescript-eslint/scope-manager`,
`@typescript-eslint/visitor-keys`. None of them load `typescript` — the
`@typescript-eslint` packages import it only in `.d.ts` files, and
`npm run verify:packaged` proves it by installing the packed tarball into a
project with no `typescript` on disk and linting a `.tsx` file with it.

`@typescript-eslint/scope-manager` handles JavaScript files too, rather than
falling back to `eslint-scope` for them. It is a superset — a fork of
`eslint-scope` with TypeScript support added — so using it everywhere means one
code path, one dependency fewer, and JavaScript results that are identical to
typescript-eslint's for the same reason the TypeScript ones are.

## Usage

```js
// eslint.config.mjs
import * as oxcParser from 'eslint-parser-oxc';

export default [
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    languageOptions: {
      parser: oxcParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
];
```

That is the whole setup. The language — and in particular whether JSX is on — is
taken from the file extension, so `.ts` and `.tsx` do not need separate config
blocks the way a Babel setup does.

### With `eslint-plugin-import-x`

`import-x` parses the files an import points at, and needs to be told which
parser handles which extensions:

```js
import * as oxcParser from 'eslint-parser-oxc';
import importX from 'eslint-plugin-import-x';

export default [
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    languageOptions: { parser: oxcParser, ecmaVersion: 'latest', sourceType: 'module' },
    settings: {
      'import-x/parsers': {
        'eslint-parser-oxc': ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
      },
      'import-x/extensions': ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
      'import-x/resolver': { typescript: true },
    },
    plugins: { 'import-x': importX },
    rules: importX.flatConfigs.recommended.rules,
  },
];
```

The same key works for `eslint-plugin-import`'s `import/parsers`.

### CommonJS

Flat config loads parsers with `import`, but a CJS build is published for jiti
and for `require`-based configs:

```js
const oxcParser = require('eslint-parser-oxc');
```

## Options

Everything goes under `languageOptions.parserOptions`.

| Option | Default | Effect |
| --- | --- | --- |
| `lang` | from the file extension | `'js'`, `'jsx'`, `'ts'`, `'tsx'` or `'dts'`. Overrides everything else. |
| `sourceType` | `'module'`, or `'commonjs'` for `.cjs` | `'script'`, `'module'`, `'commonjs'` or `'unambiguous'`. Passed through to oxc; `'commonjs'` is reported as `'script'` on the AST, which is all ESLint understands. Under ESLint the default never applies — ESLint always supplies `languageOptions.sourceType`, so set it there for `.cjs` files. |
| `ecmaFeatures.jsx` | from the file extension | Forces JSX on or off. Ignored when `lang` is set. |
| `ecmaFeatures.globalReturn` | `false` | Allows a top-level `return`, by parsing as CommonJS. |
| `jsxPragma` | `'React'` | Identifier marked as referenced by every JSX element, so `no-unused-vars` does not flag `import React`. `null` for the automatic runtime. |
| `jsxFragmentName` | `null` | As above, for fragments. |
| `lib` | `['esnext']` | TypeScript `lib` names, used by the scope manager to predeclare ambient type names. |
| `preserveParens` | `false` | Leave this alone. ESLint's AST contract has no `ParenthesizedExpression`. |
| `showSemanticErrors` | `false` | Also report oxc's scope- and symbol-level diagnostics as parse errors. |
| `ecmaVersion` | — | Accepted and ignored; oxc always parses the latest syntax. |

### Language selection

| Extension | `lang` | JSX |
| --- | --- | --- |
| `.js` `.mjs` `.cjs` | `js` | off |
| `.jsx` | `jsx` | on |
| `.ts` `.mts` `.cts` | `ts` | **off** |
| `.tsx` | `tsx` | on |
| `.d.ts` `.d.mts` `.d.cts` | `dts` | off |
| anything else | `tsx` | on |

JSX is off for `.ts` on purpose: with it on, `<T>value` parses as a JSX element
instead of a type assertion, and `const f = <T,>() => …` changes meaning.
TypeScript itself makes the same extension-based split.

## Compatibility

| | `eslint-parser-oxc` | `@typescript-eslint/parser` | `@babel/eslint-parser` |
| --- | --- | --- | --- |
| Runs without `typescript` installed | **yes** | no | yes |
| AST | TS-ESTree | TS-ESTree | Babel AST converted to ESTree |
| `scopeManager` | `@typescript-eslint/scope-manager` | `@typescript-eslint/scope-manager` | `eslint-scope`, patched |
| `visitorKeys` | `@typescript-eslint/visitor-keys` | `@typescript-eslint/visitor-keys` | Babel's |
| Type-aware rules | no | yes | no |
| `parserServices.program` | no | yes | no |
| JSX on for `.ts` | no (correct) | no | yes unless configured per-extension |
| Core rules, `import-x`, `react`, `jsx-a11y` | identical findings (verified) | baseline | mostly, with known AST gaps |
| Runtime dependencies | 3 | 6, incl. `typescript` | `@babel/core` and its tree |
| Extra `start`/`end` on nodes | yes | no | yes |

Where the ASTs differ at all, it is written down: see
[DIVERGENCES.md](./DIVERGENCES.md). The short version is that the AST, ranges,
locs, comments and tokens are identical to typescript-eslint's, with five
documented exceptions, two of which are cases where this parser matches
**espree** — ESLint's own parser — and typescript-eslint does not.

## Limitations

- **No type information.** `services` is `{}`. Type-aware rules
  (`@typescript-eslint/no-floating-promises` and friends) will not run. Use
  [`oxlint-tsgolint`](https://github.com/oxc-project/tsgolint) for those.
- **`ecmaVersion` is ignored.** oxc always parses the latest syntax, so this
  parser will not turn newer syntax into a syntax error for you.
- **Stricter than TypeScript's parser.** TypeScript recovers from most errors
  and reports them from the compiler instead; oxc reports them at parse time, so
  ESLint sees a fatal parse error. In a 3,124-file corpus this affected 38
  files, every one of them code TypeScript itself rejects. The list and the
  classes are in [DIVERGENCES.md](./DIVERGENCES.md#8-oxc-rejects-code-typescripts-parser-accepts).
- **No Flow, Vue SFCs, Svelte or MDX.**
- **`oxc-parser` is pinned to an exact version** and should stay that way. Its
  ESTree output is still moving; the conformance suite is what says whether a
  bump is safe.

## Verification

The claim "identical to typescript-eslint" is a test, not an opinion. The
reference parser lives in `conformance/reference/`, its own npm install with
`typescript@6.0.3`, so the package under test is always exercised in a tree with
no `typescript` in it.

```bash
npm run build
npm run conformance:corpus     # fetch the external corpora (~45 MB)
npm run conformance:snapshot   # parse everything with the reference
npm run conformance            # diff the ASTs
npm run conformance:lint       # diff the ESLint findings, and --fix output
npm run verify:packaged        # install the tarball where typescript is absent
npm test                       # unit tests
```

The corpus is typescript-eslint's `ast-spec` fixtures (one file per syntactic
form), ESLint's `lib` and parsing fixtures, and four real repositories —
TanStack Query, Vite, redux-saga and typescript-eslint itself — pinned to exact
tags. Point the suite at your own monorepo with
`node conformance/reference/snapshot.mjs <dir> conformance/.snapshots-mine`
followed by `node conformance/run.mjs --snapshots conformance/.snapshots-mine`.

Current results, `oxc-parser@0.148.0` against
`@typescript-eslint/parser@8.69.0` on `typescript@6.0.3`:

| Check | Result |
| --- | --- |
| ASTs identical (nodes, ranges, locs, comments, tokens) | **2754 / 2754** comparable files |
| ESLint findings identical | **0 differences** across **17,050** findings |
| `--fix` output byte-identical | **0 files differ** |
| Scope analysis on TS-only constructs | 17 cases, all matching the reference |
| Files rejected here and accepted by the reference | 38, all reviewed and checked in |

The rule set is ESLint core recommended plus `eslint-plugin-react`,
`eslint-plugin-import-x` and `eslint-plugin-jsx-a11y` recommended, with the
resolution-dependent `import-x` rules off. `--fix` adds `prefer-const`,
`no-var`, `object-shorthand`, `dot-notation`, `arrow-body-style`,
`no-extra-semi`, `import-x/order` and `import-x/newline-after-import`.

## Benchmark

`bench/run.mjs` times parsing and a full lint pass separately, because rule
execution dominates a real lint run — a parser that is twice as fast only moves
its own share of the wall clock.

3,124 files / 17.2 MB (the conformance corpus), Node 24, Apple M-series, median
of five parse passes and three lint passes after warmup:

| Parser | Parse | Per file | Throughput | Full lint |
| --- | --- | --- | --- | --- |
| `eslint-parser-oxc` | **1,792 ms** | 0.57 ms | 9.6 MB/s | **6,477 ms** |
| `@babel/eslint-parser` | 3,527 ms | 1.13 ms | 4.9 MB/s | 8,670 ms |
| `@typescript-eslint/parser` (TypeScript 6) | 3,745 ms | 1.20 ms | 4.6 MB/s | 8,693 ms |

So parsing is about **2× faster** than either alternative, and a full lint of
this corpus with the same rule set is about **25% faster** end to end. Parsing
is roughly 28% of the lint run here rather than 43%.

Two caveats on the parse column. It includes the work oxc does not do itself —
attaching `loc`, tokenizing, decoding JSX entities — so it is a fair
apples-to-apples number for what ESLint receives, not a measurement of the Rust
parser alone. And the three parsers reject slightly different files (359, 448
and 332 of 3,124 respectively), so each is doing marginally different work.

Run it yourself with `npm run bench -- conformance/.corpus`.

## Development

```bash
npm install
npm run build       # tsdown, ESM + CJS + types
npm run typecheck
npm test
```

`src/` is small and each file has one job:

| File | Job |
| --- | --- |
| `index.ts` | `parseForESLint`, `parse`, `meta` |
| `options.ts` | file extension and `parserOptions` to oxc options |
| `line-table.ts` | offset to line/column |
| `ast.ts` | one traversal: attach `loc`, collect tokenizer hints, repair ranges |
| `tokenizer.ts` | the token stream |
| `jsx-entities.ts`, `html-entities.ts` | JSX entity decoding |
| `normalize.ts` | hashbang and `sourceType` reconciliation |
| `errors.ts` | oxc diagnostics to the error shape ESLint reads |

When a conformance run reports a token mismatch, `node conformance/tokens.mjs
<file>` shows the first few side by side with their source context, and
`node conformance/reference/probe.mjs '[["case", "code", false]]'` prints what
the reference parser makes of an arbitrary snippet.

## License

MIT — see [LICENSE](./LICENSE).

The HTML entity table in `src/html-entities.ts` is derived from TypeScript
(Apache-2.0); the differential suite downloads source from five other projects
at test time without vendoring any of it. Both are covered in
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

Contributions are accepted under the same MIT license as the project.
