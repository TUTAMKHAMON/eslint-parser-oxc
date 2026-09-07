/** Types for `scope-cases.mjs`, which the TypeScript test suite imports. */

export interface ScopeCase {
  name: string;
  file: string;
  code: string;
}

export declare const CASES: ScopeCase[];
export declare const RULES: Record<string, 'error'>;
export declare function fingerprint(messages: unknown[]): string[];
