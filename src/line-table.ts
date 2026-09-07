/**
 * Line/column lookup over a source file.
 *
 * `oxc-parser` reports offsets as UTF-16 code units (verified in
 * `test/offsets.test.ts`), which is what ESLint wants, so offsets need no
 * conversion — only a line/column table.
 */

/** Line terminators recognised by ECMAScript, matching ESLint's own splitter. */
const LINE_BREAK = /\r\n|[\n\r\u2028\u2029]/g;

export interface Position {
  line: number;
  column: number;
}

export class LineTable {
  /** Offset of the first character of each line. `starts[0]` is always 0. */
  private readonly starts: number[];

  /** Cursor into `starts`, biased towards sequential (in-order) lookups. */
  private cursor = 0;

  constructor(code: string) {
    const starts = [0];
    LINE_BREAK.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINE_BREAK.exec(code)) !== null) {
      starts.push(match.index + match[0].length);
    }
    this.starts = starts;
  }

  /** 1-based line, 0-based column (in UTF-16 code units) for a source offset. */
  positionAt(offset: number): Position {
    const { starts } = this;

    // Locations are overwhelmingly requested in source order, so try to move
    // the cursor forward a step or two before falling back to a binary search.
    let index = this.cursor;
    if (starts[index]! <= offset) {
      const next = index + 1;
      if (next >= starts.length || starts[next]! > offset) {
        return { line: index + 1, column: offset - starts[index]! };
      }
      if (next + 1 >= starts.length || starts[next + 1]! > offset) {
        this.cursor = next;
        return { line: next + 1, column: offset - starts[next]! };
      }
    }

    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid]! <= offset) low = mid;
      else high = mid - 1;
    }
    index = low;
    this.cursor = index;
    return { line: index + 1, column: offset - starts[index]! };
  }
}
