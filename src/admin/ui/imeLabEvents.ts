import type { LogEntry } from "./imeLabModel.ts";

/** CJK Unified Ideographs, including the common extensions. */
function isHanja(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x2ebef)
  );
}

export function codepoints(text: string): { cp: string; hanja: boolean }[] {
  return [...text].slice(0, 60).map((character) => {
    const cp = character.codePointAt(0) ?? 0;
    return {
      cp: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
      hanja: isHanja(cp),
    };
  });
}

function nodeLabel(node: Node): string {
  return node.nodeType === Node.TEXT_NODE ? "#text" : node.nodeName.toLowerCase();
}

/** The text a StaticRange covers -- i.e. exactly what the IME is replacing. */
function staticRangeText(targetRange: StaticRange): string {
  try {
    const range = document.createRange();
    range.setStart(targetRange.startContainer, targetRange.startOffset);
    range.setEnd(targetRange.endContainer, targetRange.endOffset);
    return range.toString();
  } catch {
    return "?";
  }
}

function keyDetail(event: KeyboardEvent): Record<string, unknown> {
  return {
    key: event.key,
    code: event.code,
    // Deprecated, but it is the IME signal: a key handled by the input method
    // reports keyCode 229 while `key` still says "Enter".
    keyCode: event.keyCode,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    isComposing: event.isComposing,
    repeat: event.repeat,
  };
}

function inputDetail(event: InputEvent): Record<string, unknown> {
  const detail: Record<string, unknown> = {
    inputType: event.inputType,
    data: event.data,
    isComposing: event.isComposing,
    cancelable: event.cancelable,
  };
  const text = event.dataTransfer?.getData("text/plain");
  if (text) detail["dataTransfer"] = text;
  // The decisive field: a non-collapsed range here means the IME is replacing
  // committed text rather than inserting at the caret.
  if (typeof event.getTargetRanges === "function") {
    const ranges = event.getTargetRanges();
    if (ranges.length > 0) {
      detail["targetRanges"] = ranges.map((targetRange) => ({
        start: `${nodeLabel(targetRange.startContainer)}:${targetRange.startOffset}`,
        end: `${nodeLabel(targetRange.endContainer)}:${targetRange.endOffset}`,
        collapsed: targetRange.collapsed,
        text: staticRangeText(targetRange),
      }));
    }
  }
  return detail;
}

export function eventDetail(type: string, event: Event): Record<string, unknown> {
  if (type === "keydown" || type === "keyup") {
    return keyDetail(event as KeyboardEvent);
  }
  if (type === "beforeinput" || type === "input") {
    return inputDetail(event as InputEvent);
  }
  return { data: (event as CompositionEvent).data };
}

export function eventRowClass(entry: LogEntry): string | undefined {
  const ranges = entry.detail["targetRanges"];
  const replacesText = entry.detail["inputType"] === "insertReplacementText" ||
    (Array.isArray(ranges) && ranges.some((range) => !range.collapsed));
  if (replacesText) return "is-replacement";
  if (entry.type.startsWith("composition")) return "is-composition";
  if (entry.type.startsWith("key")) return "is-key";
  return undefined;
}
