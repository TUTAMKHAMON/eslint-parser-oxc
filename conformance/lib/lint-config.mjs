/**
 * The flat config both sides of the rule differential run.
 *
 * Syntax-only rule sets, chosen to match what the target repos actually run:
 * ESLint core recommended plus eslint-plugin-react, eslint-plugin-import-x and
 * eslint-plugin-jsx-a11y. No type-aware rules — those are out of scope for this
 * parser and are handled by oxlint-tsgolint elsewhere.
 *
 * Both sides import this with their own plugin instances, so the rule selection
 * cannot drift between the two runs.
 */

export function buildConfig({ js, parser, parserName, react, importX, jsxA11y, fix = false }) {
  return [
    {
      files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
      languageOptions: {
        parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      linterOptions: {
        // Corpus files carry disable comments aimed at other rule sets.
        reportUnusedDisableDirectives: 'off',
      },
      settings: {
        react: { version: '19.0' },
        // Lets eslint-plugin-import-x read the files an import points at.
        'import-x/parsers': {
          [parserName]: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
        },
        'import-x/extensions': ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
      },
      plugins: {
        react,
        'import-x': importX,
        'jsx-a11y': jsxA11y,
      },
      rules: {
        ...js.configs.recommended.rules,
        ...react.configs.flat.recommended.rules,
        ...jsxA11y.flatConfigs.recommended.rules,
        ...importX.flatConfigs.recommended.rules,
        // Resolution depends on where the corpus was unpacked, not on the parser.
        'import-x/no-unresolved': 'off',
        'import-x/named': 'off',
        'import-x/namespace': 'off',
        'import-x/default': 'off',
        'import-x/export': 'off',
        'react/prop-types': 'error',
        'react/display-name': 'error',
        // Autofixable, range-sensitive rules: a fixer that is one character off
        // produces different output, so these are the ones worth comparing.
        ...(fix
          ? {
              'prefer-const': 'error',
              'no-var': 'error',
              'object-shorthand': 'error',
              'dot-notation': 'error',
              'arrow-body-style': 'error',
              'no-extra-semi': 'error',
              'import-x/order': 'error',
              'import-x/newline-after-import': 'error',
            }
          : {}),
      },
    },
  ];
}

/**
 * A stable, comparable line per finding, grouped by file, plus the set of files
 * where the parser itself failed. Findings are only meaningful for files both
 * parsers accepted, so the two are kept apart.
 */
export function fingerprint(results) {
  const byFile = {};
  const fatal = {};
  for (const result of results) {
    const lines = [];
    for (const message of result.messages) {
      if (message.fatal) {
        fatal[result.relativePath] = message.message;
        continue;
      }
      lines.push(
        [
          result.relativePath,
          message.line ?? 0,
          message.column ?? 0,
          message.endLine ?? 0,
          message.endColumn ?? 0,
          message.ruleId ?? 'unknown',
          message.messageId ?? message.message,
        ].join('|'),
      );
    }
    byFile[result.relativePath] = lines.sort();
  }
  return { byFile, fatal };
}
