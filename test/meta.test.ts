import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { meta } from '../src/index.ts';

describe('meta', () => {
  it('reports the name and version ESLint shows in error messages', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      name: string;
      version: string;
    };
    expect(meta.name).toBe(pkg.name);
    expect(meta.version).toBe(pkg.version);
  });
});
