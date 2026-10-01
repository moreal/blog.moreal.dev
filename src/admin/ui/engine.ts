/** What Editor.tsx needs from a writing surface, so the two are swappable. */
export interface EditorEngineProps {
  value: string;
  onChange: (next: string) => void;
  /** Cmd-S. */
  onSaveRequest: () => void;
  /** Returns the markdown to insert, or null if the user cancelled. */
  onImagePaste?: (files: File[]) => Promise<string | null>;
  /** Called once with a handle for imperative operations. */
  ref?: (handle: EditorHandle) => void;
  assetBase?: () => string;
  /** Scroll position as 0..1, for mirroring into the preview pane. */
  onScroll?: (ratio: number) => void;
  /** The 1-based line the caret is on, whenever it moves. */
  onCaretLine?: (line: number) => void;
}

export interface EditorHandle {
  /** Replace the whole document (after hongdown) while keeping the caret. */
  replaceAll: (next: string) => void;
  focus: () => void;
  /** The element that scrolls, for the overlay scrollbar to follow. */
  scroller: HTMLElement;
  /** Put the caret at the end of a 1-based line and bring it to the top. */
  revealLine: (line: number) => void;
}

const CARET_AT_LINE_START = /(^|\n)\s*$/;

const BLANK_LINE = "\n\n";

export function blockInsertion(textBeforeCaret: string, block: string): string {
  const separator = CARET_AT_LINE_START.test(textBeforeCaret) ? "" : BLANK_LINE;
  return separator + block + BLANK_LINE;
}

/**
 * hongdown rewraps every paragraph, so the caret cannot be restored by offset.
 * Remember which line it was on and what that line started with, then find the
 * nearest line in the new document that still starts the same way.
 */
export interface CaretMark {
  line: number;
  fingerprint: string;
}

export function fingerprintOf(lineText: string): string {
  return lineText.replace(/\s+/g, "").slice(0, 24);
}

export function findLine(lines: string[], mark: CaretMark): number {
  if (mark.fingerprint === "") {
    return Math.min(mark.line, lines.length);
  }
  for (let d = 0; d < lines.length; d++) {
    for (const i of [mark.line - 1 + d, mark.line - 1 - d]) {
      if (i < 0 || i >= lines.length) continue;
      if (fingerprintOf(lines[i]!) === mark.fingerprint) return i + 1;
    }
  }
  return Math.min(mark.line, lines.length);
}

/**
 * Only the span hongdown actually touched, so the lines around it keep their
 * place on screen instead of the whole document being swapped under the reader.
 */
export function changedSpan(
  current: string,
  next: string,
): { from: number; to: number; insert: string } {
  const shorter = Math.min(current.length, next.length);
  let prefix = 0;
  while (prefix < shorter && current[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    from: prefix,
    to: current.length - suffix,
    insert: next.slice(prefix, next.length - suffix),
  };
}
