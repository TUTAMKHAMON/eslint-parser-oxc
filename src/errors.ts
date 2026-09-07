/**
 * Turning oxc diagnostics into the error shape ESLint expects.
 *
 * ESLint's JS language reads `lineNumber` and `column` off the thrown error and
 * reports them as-is, with `columnStart: 0` — so `column` is 0-based, exactly
 * what typescript-eslint's `TSError` also provides.
 */

import type { LineTable } from './line-table.ts';

export interface OxcErrorLabel {
  message: string | null;
  start: number;
  end: number;
}

export interface OxcError {
  severity: string;
  message: string;
  labels: OxcErrorLabel[];
  helpMessage: string | null;
  codeframe: string | null;
}

export class OxcSyntaxError extends Error {
  /** 1-based. */
  readonly lineNumber: number;
  /** 0-based, to match ESLint's `columnStart: 0`. */
  readonly column: number;
  /** Offset of the error in the source text, in UTF-16 code units. */
  readonly index: number;

  constructor(message: string, index: number, lineNumber: number, column: number) {
    super(message);
    this.name = 'OxcSyntaxError';
    this.index = index;
    this.lineNumber = lineNumber;
    this.column = column;
  }
}

/**
 * Throw the first fatal diagnostic, if there is one.
 *
 * Warnings and advice are dropped: ESLint has no channel for a non-fatal parser
 * diagnostic, and surfacing them as fatal errors would fail files that parse.
 */
export function throwIfFatal(errors: readonly OxcError[], lines: LineTable): void {
  const fatal = errors.find((error) => error.severity === 'Error');
  if (fatal === undefined) return;

  const index = fatal.labels[0]?.start ?? 0;
  const { line, column } = lines.positionAt(index);
  const detail = fatal.labels[0]?.message;

  throw new OxcSyntaxError(detail ? `${fatal.message}: ${detail}` : fatal.message, index, line, column);
}
