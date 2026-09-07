/**
 * Ad-hoc probe: what does the reference parser emit for these snippets?
 *
 *   node probe.mjs '[["name", "const a = 1;", false]]'
 *
 * Each case is `[name, code, jsx]`. Prints the token stream, which is where
 * most of the interesting differences live.
 */

import { parseForESLint } from '@typescript-eslint/parser';
const cases = JSON.parse(process.argv[2]);
for (const [name, code, jsx] of cases) {
  try {
    const { ast } = parseForESLint(code, {
      ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true,
      comment: true, tokens: true, ecmaFeatures: { jsx: !!jsx },
    });
    console.log(name, '::', ast.tokens.map(t => `${t.type}(${JSON.stringify(t.value)})`).join(' '));
  } catch (e) { console.log(name, ':: ERROR', e.message); }
}
