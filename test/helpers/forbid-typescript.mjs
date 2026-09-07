/**
 * Fails the process if anything resolves `typescript`.
 *
 * `module.registerHooks` is synchronous and covers both `require` and `import`,
 * so this catches a CommonJS dependency reaching for it too — which is the way
 * it would actually happen.
 */

import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'typescript' || specifier.startsWith('typescript/')) {
      throw new Error(`eslint-parser-oxc resolved '${specifier}' at runtime`);
    }
    return nextResolve(specifier, context);
  },
});
