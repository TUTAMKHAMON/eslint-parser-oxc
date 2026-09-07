// TypeScript shapes where `<` and `>` are not what they look like.
declare const f: <T>(x: T) => T;
declare const g: any;
const compared = a < b > c;
const called = f<string>('x');
const nestedGenerics: Map<string, Array<Set<number>>> = null!;
const shiftedNotGeneric = 1 >> 2;
const assertion = <Array<string>>g;
type Query = typeof g;
type ThisQuery = { m(): typeof this };
declare function withThis(this: Window, x: number): void;
type ImportAttrs = import('./m', { with: { type: 'json' } });
enum Quoted { 'a-name' = 1, plain = 2 }
class Decorated {
  method(@inject() plain: number, @inject() optional?: string, @inject() defaulted = 1, @inject() ...rest: unknown[]) {}
  constructor(@inject() private readonly dep: string) {}
}
export { compared, called, nestedGenerics, shiftedNotGeneric, assertion, Quoted, Decorated };
export type { Query, ThisQuery, ImportAttrs };
