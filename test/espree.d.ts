/** Minimal declaration for espree, which the template-cooked test compares against. */
declare module 'espree' {
  export function parse(code: string, options?: Record<string, unknown>): unknown;
}
