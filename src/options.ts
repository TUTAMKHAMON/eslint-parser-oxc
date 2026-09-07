/** Resolution of ESLint `parserOptions` / `languageOptions` into oxc options. */

/** The `lang` values `oxc-parser` accepts. */
export type Lang = 'js' | 'jsx' | 'ts' | 'tsx' | 'dts';

export type SourceType = 'script' | 'module' | 'commonjs' | 'unambiguous';

export interface ParserOptions {
  /** Supplied by ESLint. Used to pick the language when `lang` is not set. */
  filePath?: string;
  /** Force the oxc language instead of deriving it from the file extension. */
  lang?: Lang;
  /**
   * Whether the AST carries TypeScript-shaped properties. Defaults to `'ts'`
   * for every language, including plain JavaScript, because typescript-eslint
   * always emits `decorators`, `optional` and `typeAnnotation` and rules are
   * written against that shape.
   */
  astType?: 'js' | 'ts';
  sourceType?: SourceType;
  /**
   * Accepted for compatibility with espree/typescript-eslint configs and
   * otherwise ignored: oxc always parses the latest ECMAScript syntax.
   */
  ecmaVersion?: number | 'latest';
  ecmaFeatures?: {
    /** Force JSX on or off, overriding the file extension. */
    jsx?: boolean;
    /**
     * Allow `return` at the top level. Implemented by parsing as CommonJS,
     * which is the mode in which oxc permits it.
     */
    globalReturn?: boolean;
  };
  /**
   * Emit `ParenthesizedExpression` nodes. ESLint's AST contract has no such
   * node, so this defaults to `false` and should be left alone.
   */
  preserveParens?: boolean;
  /** Report scope/symbol-level errors from oxc in addition to syntax errors. */
  showSemanticErrors?: boolean;
  /**
   * Root identifier the JSX transform calls, marked as referenced by every JSX
   * element so `no-unused-vars` does not flag `import React`. `null` disables
   * it, which is what the automatic runtime wants.
   */
  jsxPragma?: string | null;
  /** Root identifier used for JSX fragments, if the transform needs a separate one. */
  jsxFragmentName?: string | null;
  /** TypeScript `lib` names, used to predeclare ambient type names. */
  lib?: string[];
  /** Anything else ESLint hands us is ignored rather than rejected. */
  [key: string]: unknown;
}

export interface ResolvedOptions {
  filePath: string;
  lang: Lang;
  sourceType: SourceType;
  jsx: boolean;
  astType: 'js' | 'ts';
  preserveParens: boolean;
  showSemanticErrors: boolean;
  jsxPragma: string | null;
  jsxFragmentName: string | null;
  lib: string[];
}

const DECLARATION = /\.d\.(?:[cm]?ts)$/i;

const BY_EXTENSION = new Map<string, Lang>([
  ['.js', 'js'],
  ['.mjs', 'js'],
  ['.cjs', 'js'],
  ['.jsx', 'jsx'],
  ['.mjsx', 'jsx'],
  ['.ts', 'ts'],
  ['.mts', 'ts'],
  ['.cts', 'ts'],
  ['.tsx', 'tsx'],
  ['.mtsx', 'tsx'],
]);

function extensionOf(filePath: string): string {
  const base = filePath.slice(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

/**
 * Pick the oxc language for a file.
 *
 * `.ts` deliberately maps to `ts` and not `tsx`: with JSX enabled, `<T>value`
 * parses as a JSX element instead of a type assertion, and `const f = <T,>() =>`
 * changes meaning. TypeScript itself makes the same extension-based split.
 */
export function langFromFilePath(filePath: string): Lang {
  if (DECLARATION.test(filePath)) return 'dts';
  return BY_EXTENSION.get(extensionOf(filePath)) ?? 'tsx';
}

/** Apply an explicit `ecmaFeatures.jsx` on top of an extension-derived lang. */
function withJsx(lang: Lang, jsx: boolean): Lang {
  switch (lang) {
    case 'js':
    case 'jsx':
      return jsx ? 'jsx' : 'js';
    case 'ts':
    case 'tsx':
      return jsx ? 'tsx' : 'ts';
    case 'dts':
      return 'dts';
  }
}

export function resolveOptions(options: ParserOptions = {}): ResolvedOptions {
  const filePath = typeof options.filePath === 'string' ? options.filePath : '<input>';

  let lang = options.lang ?? langFromFilePath(filePath);
  const explicitJsx = options.ecmaFeatures?.jsx;
  if (typeof explicitJsx === 'boolean' && options.lang === undefined) {
    lang = withJsx(lang, explicitJsx);
  }

  // ESLint's own language config treats `.cjs` as CommonJS; mirror that when the
  // caller has not said otherwise. `.cts` is deliberately left as `module`,
  // because `import`/`export` are legal there and typescript-eslint does the same.
  let sourceType = options.sourceType ?? (extensionOf(filePath) === '.cjs' ? 'commonjs' : 'module');
  // oxc has no `globalReturn` switch, but its CommonJS mode is exactly the mode
  // that allows a top-level `return`.
  if (options.ecmaFeatures?.globalReturn === true && sourceType === 'script') sourceType = 'commonjs';

  return {
    filePath,
    lang,
    sourceType,
    jsx: lang === 'jsx' || lang === 'tsx',
    astType: options.astType ?? 'ts',
    preserveParens: options.preserveParens ?? false,
    showSemanticErrors: options.showSemanticErrors ?? false,
    jsxPragma: options.jsxPragma === undefined ? 'React' : options.jsxPragma,
    jsxFragmentName: options.jsxFragmentName ?? null,
    lib: options.lib ?? ['esnext'],
  };
}
