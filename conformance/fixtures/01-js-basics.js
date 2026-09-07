// Plain JavaScript: the shapes core rules touch most.
'use strict';

import defaultExport, { named as renamed, other } from './mod.js';
import * as namespace from 'node:path';
export * from './re-export.js';
export * as ns from './star.js';

const { a, b: { c = 1 } = {}, ...rest } = obj;
const [first, , third = 3, ...tail] = list;

let counter = 0;
var legacy = null;

function decl(x, y = 1, ...args) {
  return x ?? y;
}

const arrow = (x) => x * 2;
const asyncArrow = async (x) => await Promise.resolve(x);

function* generator() {
  yield 1;
  yield* generator();
}

async function* asyncGenerator() {
  for await (const chunk of stream) yield chunk;
}

class Base {
  static #count = 0;
  #private = 1;
  static { Base.#count = 1; }
  accessor value = 2;
  get prop() { return this.#private; }
  set prop(next) { this.#private = next; }
  static create() { return new Base(); }
  [Symbol.iterator]() {}
}

label: for (let i = 0; i < 10; i++) {
  if (i === 5) continue label;
  if (i > 8) break label;
}

switch (counter) {
  case 0:
  case 1: {
    break;
  }
  default:
    break;
}

try {
  throw new Error('boom');
} catch {
  // optional catch binding
} finally {
  counter += 1;
}

do { counter--; } while (counter > 0);

const optional = obj?.deep?.[key]?.(arg);
const template = `a ${1 + 2} b ${`nested ${x}`} c`;
const tagged = String.raw`raw\n${x}`;
const plain = `no substitution`;
const regex = /ab+c/giu;
const divided = 10 / 2 / 1;
const big = 123n;
const numbers = [0x1f, 0b1010, 0o777, 1_000_000, .5, 1e10, 1.5e-3];
const dynamic = import('./lazy.js');
const meta = import.meta.url;
const spread = { ...rest, [computed]: 1, method() {}, get x() { return 1 }, async *gen() {} };
const seq = (1, 2, 3);
const cond = a ? .5 : 1;
const not = !void delete obj.prop;
const bits = 1 << 2 >> 3 >>> 4;
const logical = (a && b) || (c ?? d);
function target() { return new.target; }
debugger;
export default decl;
export { renamed as default2, other };
