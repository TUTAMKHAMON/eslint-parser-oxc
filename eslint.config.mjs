/**
 * This repository lints itself with the parser it publishes. It is the cheapest
 * possible smoke test: if the parser cannot handle its own TypeScript source,
 * `npm run lint` says so.
 *
 * Requires `npm run build` first, since it loads the built parser the way a
 * consumer would.
 */

import js from '@eslint/js';
import * as oxcParser from './dist/index.mjs';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'conformance/.corpus/**',
      'conformance/.snapshots*/**',
      // Deliberately odd code, linted by the conformance suite instead.
      'conformance/fixtures/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    languageOptions: {
      parser: oxcParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        performance: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // The TypeScript-aware replacements live in typescript-eslint, which this
      // package deliberately does not depend on; the core rule misreads types,
      // interfaces and overloads.
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-undef': 'off',
    },
  },
];
