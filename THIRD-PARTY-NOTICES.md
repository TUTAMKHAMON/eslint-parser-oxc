# Third-party notices

`eslint-parser-oxc` is MIT licensed (see [LICENSE](./LICENSE)). This file covers
material in this repository that originates elsewhere, and the licences of the
packages it depends on.

## Code derived from another project

### TypeScript — `src/html-entities.ts`

The table of HTML named character references in `src/html-entities.ts` is the
253-entry set used by TypeScript's JSX scanner (the `entities` map in
`src/compiler/scanner.ts`). The entries are the HTML 4 named character
references defined by the W3C; what was taken from TypeScript is the choice of
*which* subset to recognise, which is what makes JSX text and attribute values
decode identically to `@typescript-eslint/parser`'s.

**Modifications:** the map was reformatted from a JavaScript object literal into
an exported TypeScript `Record<string, number>`, and a documentation header was
added. The names and code points are unchanged.

> TypeScript
> Copyright (c) Microsoft Corporation.
> Licensed under the Apache License, Version 2.0.
>
> You may obtain a copy of the License at
> <http://www.apache.org/licenses/LICENSE-2.0>
>
> Unless required by applicable law or agreed to in writing, software
> distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
> WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
> License for the specific language governing permissions and limitations under
> the License.

Source: <https://github.com/microsoft/TypeScript>

### Behaviour matched, not code copied

Several behaviours are reproduced deliberately so the AST and token stream match
`@typescript-eslint/parser` — which words count as `Keyword` tokens, how JSX text
tokens are delimited, and two quirks documented in
[DIVERGENCES.md](./DIVERGENCES.md#6-two-typescript-estree-quirks-reproduced-on-purpose).
These were established by observing the reference parser's output in the
differential suite, not by copying its implementation. No code from
`typescript-eslint` or `espree` is included here.

## Runtime dependencies

Installed by npm, not vendored:

| Package | License |
| --- | --- |
| [`oxc-parser`](https://github.com/oxc-project/oxc) | MIT |
| [`@typescript-eslint/scope-manager`](https://github.com/typescript-eslint/typescript-eslint) | MIT |
| [`@typescript-eslint/visitor-keys`](https://github.com/typescript-eslint/typescript-eslint) | MIT |

`eslint` is a peer dependency (MIT).

## Test corpora

The differential suite downloads source from five projects at test time. None of
it is vendored into this repository, and none of it ships in the published
package — `conformance/.corpus/` is git-ignored, and `files` in `package.json`
publishes only `dist/`, the README, DIVERGENCES.md, this file and the LICENSE.

| Project | Pinned at | License |
| --- | --- | --- |
| [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | `v8.69.0` | MIT |
| [ESLint](https://github.com/eslint/eslint) | `v9.39.5` | MIT |
| [TanStack Query](https://github.com/TanStack/query) | `v5.90.2` | MIT |
| [redux-saga](https://github.com/redux-saga/redux-saga) | commit `b603028` | MIT |
| [Vite](https://github.com/vitejs/vite) | `v7.1.5` | MIT |

Each is used only as input to a parser, for the purpose of comparing two
parsers' output.
