// TypeScript with JSX deliberately off: `<T>value` must be a type assertion.
import type { Readable } from 'node:stream';
import { type A, type B as C, real } from './mixed.js';
import legacy = require('./legacy');

export type Alias = string | number | null;
export type Generic<T extends object = {}> = { [K in keyof T]?: T[K] };
export type Mapped<T> = { readonly [K in keyof T as `get${Capitalize<string & K>}`]-?: () => T[K] };
export type Conditional<T> = T extends Array<infer U> ? U : never;
export type Tuple = [first: string, second?: number, ...rest: boolean[]];
export type Fn = (a: string, b?: number) => asserts a is string;
export type Ctor = new (a: string) => Alias;
export type Query = typeof legacy;
export type Indexed = Alias['length'];
export type Template = `prefix-${string}`;
export type Union = { kind: 'a'; value: 1 } | { kind: 'b'; value: 2 };
export type Intersect = Union & { extra: true };
export type Import = import('./other').Thing<string>;
export type Nested = Map<string, Array<Set<number>>>;

export interface Shape<in out T> extends Base<T> {
  readonly id: string;
  method(arg: T): void;
  new (arg: T): Shape<T>;
  (call: T): void;
  [key: string]: unknown;
}

export enum Direction { Up = 1, Down, Left = 'left' }
export const enum Const { A }
declare enum Ambient { X }

export namespace Outer {
  export namespace Inner {
    export const value = 1;
  }
}

declare module 'untyped-package' {
  export function thing(): void;
}

declare global {
  interface Window { custom: string }
}

export abstract class Widget<T> implements Shape<T> {
  declare readonly id: string;
  protected abstract render(): void;
  private static instances = 0;
  public override toString(): string { return ''; }
  constructor(private readonly dep: T, public other?: string) { super(); }
}

export function overloaded(a: string): string;
export function overloaded(a: number): number;
export function overloaded(a: unknown): unknown { return a; }

const assertion = <Alias>someValue;
const nestedAssertion = <Array<string>>someValue;
const asExpr = someValue as unknown as Alias;
const satisfiesExpr = { kind: 'a' } satisfies Union;
const nonNull = maybe!.definitely!;
const instantiation = overloaded<string>;

using resource = getResource();
await using asyncResource = getAsyncResource();

function assertIsString(x: unknown): asserts x is string {}
label: while (true) break label;

export = Widget;
