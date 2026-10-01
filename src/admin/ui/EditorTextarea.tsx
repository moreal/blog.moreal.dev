import { captureImageFiles } from "./imageFiles.ts";
import { onCleanup } from "solid-js";
import {
  type CaretMark,
  type EditorEngineProps,
  blockInsertion,
  fingerprintOf,
  findLine,
} from "./engine.ts";

/**
 * Fallback surface.  Kept permanently rather than deleted: if an OS or browser
 * update ever breaks IME handling in contenteditable, switching
 * ADMIN_CONFIG.editorEngine to "textarea" is the whole fix.
 */
export default function EditorTextarea(props: EditorEngineProps) {
  let el: HTMLTextAreaElement | undefined;

  function mount(node: HTMLTextAreaElement) {
    el = node;
    node.value = props.value;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        props.onSaveRequest();
      }
    };
    node.addEventListener("keydown", onKey);
    onCleanup(() => node.removeEventListener("keydown", onKey));
    props.ref?.({
      replaceAll,
      focus: () => node.focus(),
      scroller: node,
      revealLine,
    });
  }

  // A textarea cannot say where a wrapped line sits, so this estimates by the
  // line's share of the document; good enough for a fallback surface.
  function revealLine(number: number) {
    if (el === undefined) return;
    const lines = el.value.split("\n");
    const target = Math.min(Math.max(1, number), lines.length);
    const end = lines.slice(0, target).join("\n").length;
    el.focus({ preventScroll: true });
    el.setSelectionRange(end, end);
    reportCaretLine();
    el.scrollTop = ((target - 1) / lines.length) * el.scrollHeight;
  }

  function reportCaretLine() {
    if (el === undefined || props.onCaretLine === undefined) return;
    props.onCaretLine(el.value.slice(0, el.selectionStart).split("\n").length);
  }

  function reportScroll() {
    if (el === undefined || props.onScroll === undefined) return;
    const max = el.scrollHeight - el.clientHeight;
    props.onScroll(max <= 0 ? 0 : el.scrollTop / max);
  }

  function onPaste(event: ClipboardEvent) {
    if (props.onImagePaste === undefined || event.clipboardData === null) return;
    const files = captureImageFiles(event.clipboardData);
    if (files.length === 0) return;
    event.preventDefault();
    void props.onImagePaste(files).then((text) => {
      if (text === null || el === undefined) return;
      const { selectionStart, selectionEnd, value } = el;
      const insert = blockInsertion(value.slice(0, selectionStart), text);
      el.value = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
      el.selectionStart = el.selectionEnd = selectionStart + insert.length;
      props.onChange(el.value);
      el.focus();
    });
  }

  function replaceAll(next: string) {
    if (el === undefined || el.value === next) return;
    const upto = el.value.slice(0, el.selectionStart).split("\n");
    const mark: CaretMark = {
      line: upto.length,
      fingerprint: fingerprintOf(upto.at(-1) ?? ""),
    };
    const lines = next.split("\n");
    const target = findLine(lines, mark);
    const pos = lines.slice(0, target - 1).join("\n").length +
      (target > 1 ? 1 : 0);
    el.value = next;
    el.selectionStart = el.selectionEnd = Math.min(pos, next.length);
  }

  return (
    <textarea
      class="editor-surface plain"
      spellcheck={false}
      ref={mount}
      onInput={(e) => props.onChange(e.currentTarget.value)}
      onPaste={onPaste}
      onScroll={reportScroll}
      onSelect={reportCaretLine}
      onKeyUp={reportCaretLine}
      onClick={reportCaretLine}
    />
  );
}
