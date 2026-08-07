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
}

export interface EditorHandle {
  /** Replace the whole document (after hongdown) while keeping the caret. */
  replaceAll: (next: string) => void;
  focus: () => void;
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
