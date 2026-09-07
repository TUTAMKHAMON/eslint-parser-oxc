import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // The differential corpus is downloaded source, not this package's tests.
    exclude: ['conformance/**', 'node_modules/**', 'dist/**'],
  },
});
