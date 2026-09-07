import type { OnlyType } from './types';
import { type MixedType, realValue } from './mixed';

export enum LocalEnum { A, B }
export namespace LocalNs { export const x = 1; }

interface Merged { a: string }
interface Merged { b: number }
function merged(): void {}
namespace merged { export const extra = 1; }

export function overload(a: string): void;
export function overload(a: number): void;
export function overload(a: unknown): void {}

const typed: OnlyType = null!;
const mixed: MixedType = realValue;
const enumUse = LocalEnum.A;
const nsUse = LocalNs.x;
const mergedUse = merged.extra;

function shadow(shadowed: string) {
  { let shadowed = 1; void shadowed; }
  return shadowed;
}

const sat = { a: 1 } satisfies Merged;
using handle = open();

export { shadow, typed, mixed, enumUse, nsUse, mergedUse, sat, handle };
export type { Merged };
