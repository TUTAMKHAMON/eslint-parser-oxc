/**
 * The parser adapters under test, minus typescript-eslint, which needs
 * `typescript` and so lives in `conformance/reference/bench.mjs`.
 */

export async function oxcParser() {
  const parser = await import('../dist/index.mjs');
  return {
    label: 'eslint-parser-oxc',
    parser,
    parse: (file) => parser.parseForESLint(file.code, { filePath: file.filePath }),
  };
}

export async function babelParser() {
  const parser = await import('@babel/eslint-parser');
  const options = {
    requireConfigFile: false,
    babelOptions: {
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['jsx', 'typescript'] },
    },
  };
  return {
    label: '@babel/eslint-parser',
    parser: parser.default ?? parser,
    languageOptions: { parserOptions: options },
    parse: (file) => (parser.default ?? parser).parseForESLint(file.code, { ...options, filePath: file.filePath }),
  };
}
