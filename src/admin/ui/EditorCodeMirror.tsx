import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { onCleanup } from "solid-js";
import {
  type CaretMark,
  type EditorEngineProps,
  fingerprintOf,
  findLine,
} from "./engine.ts";
import { livePreview } from "./livePreview.ts";

export default function EditorCodeMirror(props: EditorEngineProps) {
  let view: EditorView | undefined;

  function mount(el: HTMLDivElement) {
    view = new EditorView({
      parent: el,
      state: EditorState.create({
        doc: props.value,
        extensions: [
          history(),
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                props.onSaveRequest();
                return true;
              },
            },
            // Nothing may be bound to Alt-Enter: macOS Hanja conversion sends
            // it, and neither defaultKeymap nor historyKeymap claims it.
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          markdown(),
          livePreview({ ...(props.assetBase ? { assetBase: props.assetBase } : {}) }),
          EditorView.lineWrapping,
          EditorView.domEventHandlers({
            paste: (event) => handleFiles(event, event.clipboardData),
            drop: (event) => handleFiles(event, event.dataTransfer),
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) props.onChange(u.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            scroll: (_event, v) => {
              if (props.onScroll === undefined) return false;
              const el = v.scrollDOM;
              const max = el.scrollHeight - el.clientHeight;
              props.onScroll(max <= 0 ? 0 : el.scrollTop / max);
              return false;
            },
          }),
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-content": {
              fontFamily: "var(--sans)",
              fontSize: "15px",
              lineHeight: "1.75",
              padding: "16px 20px 40vh",
              caretColor: "var(--ink)",
            },
            ".cm-scroller": { overflow: "auto" },
            "&.cm-focused": { outline: "none" },
          }),
        ],
      }),
    });
    props.ref?.({ replaceAll, focus: () => view?.focus() });
    onCleanup(() => view?.destroy());
  }

  /**
   * Grab the Blob synchronously -- the DataTransfer is neutered as soon as the
   * handler returns -- then do the async work.  Anything that is not an image
   * falls through to the native paste; the composition path is never touched.
   */
  function handleFiles(event: Event, dt: DataTransfer | null): boolean {
    if (props.onImagePaste === undefined || dt === null) return false;
    const files: File[] = [];
    for (const item of dt.items) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file !== null) files.push(file);
    }
    if (files.length === 0) return false;
    event.preventDefault();
    void props.onImagePaste(files).then((markdownText) => {
      if (markdownText === null || view === undefined) return;
      insertBlock(view, markdownText);
    });
    return true;
  }

  function replaceAll(next: string) {
    if (view === undefined) return;
    const current = view.state.doc.toString();
    // Skip entirely when hongdown changed nothing, so an already-formatted save
    // does not flicker or move the caret at all.
    if (current === next) return;

    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    const mark: CaretMark = {
      line: line.number,
      fingerprint: fingerprintOf(line.text),
    };
    const lines = next.split("\n");
    const targetLine = findLine(lines, mark);
    const doc = EditorState.create({ doc: next }).doc;
    const pos = doc.line(Math.min(targetLine, doc.lines)).from;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      selection: { anchor: Math.min(pos, next.length) },
      scrollIntoView: true,
    });
  }

  return <div class="editor-surface" ref={mount} />;
}

function insertBlock(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  // Keep the image on a line of its own so hongdown treats it as a block.
  const before = line.text.slice(0, from - line.from).trim() === "" ? "" : "\n\n";
  // Always leave a blank line after, and park the caret there: sitting at the
  // image's own end would count as touching it, which keeps the live preview
  // showing raw markdown for the picture just pasted.
  const insert = before + text + "\n\n";
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
  });
  view.focus();
}
