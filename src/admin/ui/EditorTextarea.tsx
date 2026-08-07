import { onCleanup } from "solid-js";
import {
  type CaretMark,
  type EditorEngineProps,
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
    });
  }

  function onPaste(event: ClipboardEvent) {
    if (props.onImagePaste === undefined || event.clipboardData === null) return;
    const files: File[] = [];
    for (const item of event.clipboardData.items) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file !== null) files.push(file);
    }
    if (files.length === 0) return;
    event.preventDefault();
    void props.onImagePaste(files).then((text) => {
      if (text === null || el === undefined) return;
      const { selectionStart: s, selectionEnd: e, value } = el;
      const before = /(^|\n)\s*$/.test(value.slice(0, s)) ? "" : "\n\n";
      const insert = before + text + "\n\n";
      el.value = value.slice(0, s) + insert + value.slice(e);
      el.selectionStart = el.selectionEnd = s + insert.length;
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
    />
  );
}
