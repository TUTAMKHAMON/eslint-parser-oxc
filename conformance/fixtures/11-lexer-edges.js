// Cases where a scanner has to make a decision the grammar does not force.
const trailingDot = 1..toString();
const numbers = [1.5e-3, .5, 0b1010n, 0o777, 0x1Fn, 1_000_000, 1e10];
const continued = "a\
b";
const escaped = 'it\'s "kvotet"';
const inClass = /[/]/g;
const divided = (a) / b / g;
const escapedIdent = { ab: 1, \u{62}c: 2 };
const nested = `a${ { b: `${c}` } }d`;
const chained = x?.[0] ?? x?.() ?? (a ?? b);
const conditional = a ? .5 : 1;
const shifted = 1 << 2 >> 3 >>> 4;
const assigned = { v: 0 };
assigned.v >>>= 1;
assigned.v **= 2;
assigned.v ??= 3;
assigned.v ||= 4;
assigned.v &&= 5;
label: { break label; }
const generatorObject = { async *[Symbol.iterator]() {}, get ['computed']() { return 1 } };
export { trailingDot, numbers, continued, escaped, inClass, divided, escapedIdent, nested, chained, conditional, shifted, assigned, generatorObject };
