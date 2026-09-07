// Dump the reference parse (typescript-eslint) of a file as JSON on stdout.
// Runs inside conformance/reference so it can see `typescript`.
import { readFileSync } from 'node:fs';
import { parseForESLint } from '@typescript-eslint/parser';

const file = process.argv[2];
const code = readFileSync(file, 'utf8');
const jsx = !file.endsWith('.ts') && !file.endsWith('.mts') && !file.endsWith('.cts');
const { ast } = parseForESLint(code, {
  filePath: file,
  ecmaVersion: 'latest',
  sourceType: 'module',
  range: true,
  loc: true,
  comment: true,
  tokens: true,
  ecmaFeatures: { jsx },
});
process.stdout.write(JSON.stringify(ast, (k, v) => (k === 'parent' ? undefined : v), 1));
