declare module '*.svg' {
  const content: string;
  export default content;
}

declare const globalValue: number;
declare function globalFn(a: string): void;
declare class GlobalClass {
  constructor(a: string);
  method(): void;
}
declare namespace GlobalNs {
  const inner: string;
}
export declare type Exported = { a: string };
export {};
