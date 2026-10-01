import assert from "node:assert/strict";
import test from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { livePreview } from "./livePreview.ts";

function editor(doc: string, anchor = doc.length) {
  return EditorState.create({
    doc,
    selection: { anchor },
    extensions: [markdown(), livePreview({ assetBase: () => "/2026/09/post/" })],
  });
}

function decorations(state: EditorState) {
  const ranges: { from: number; to: number; className?: string; widget?: unknown }[] = [];
  for (const set of state.facet(EditorView.decorations)) {
    assert.notEqual(typeof set, "function");
    if (typeof set === "function") continue;
    set.between(0, state.doc.length, (from, to, decoration) => {
      ranges.push({ from, to, className: decoration.spec.class, widget: decoration.spec.widget });
    });
  }
  return ranges;
}

function dimmedText(state: EditorState) {
  return decorations(state)
    .filter((range) => range.className?.split(" ").includes("cm-md-mark"))
    .map(({ from, to }) => state.sliceDoc(from, to));
}

function hiddenText(state: EditorState) {
  return decorations(state)
    .filter((range) => range.from < range.to && !range.className && !range.widget)
    .map(({ from, to }) => state.sliceDoc(from, to));
}

test("heading and emphasis marks stay in place, dimmed, wherever the caret is", () => {
  for (const anchor of [undefined, 3]) {
    assert.deepEqual(hiddenText(editor("# Heading\n\nend", anchor)), []);
    assert.deepEqual(dimmedText(editor("# Heading\n\nend", anchor)), ["#"]);
    assert.deepEqual(dimmedText(editor("Heading\n=======\n\nend", anchor)), ["======="]);
    assert.deepEqual(dimmedText(editor("**bold** `code`\n\nend", anchor)), ["**", "**", "`", "`"]);
  }
});

test("a setext underline is set at its heading's size, so the pair reads as one heading", () => {
  const state = editor("Title\n=====\n\nSection\n-------\n\nend");
  const lineClasses = decorations(state)
    .filter((range) => range.className?.startsWith("cm-md-h"))
    .map((range) => [state.doc.lineAt(range.from).text, range.className]);
  assert.deepEqual(lineClasses, [
    ["Title", "cm-md-h1"],
    ["=====", "cm-md-h1"],
    ["Section", "cm-md-h2"],
    ["-------", "cm-md-h2"],
  ]);
});

test("only a setext underline is set in half-width columns", () => {
  const underlines = (doc: string) =>
    decorations(editor(doc))
      .filter((range) => range.className?.includes("cm-md-setext"))
      .map(({ from, to }) => doc.slice(from, to));
  assert.deepEqual(underlines("제목\n====\n\n소제목\n------\n\n## ATX\n\nend"), ["====", "------"]);
});

test("inline and reference links retain their labels and editable definitions", () => {
  const state = editor("[label](https://example.com) and [other][id]\n\n[id]: https://example.com\n\nend");
  assert.deepEqual(hiddenText(state), ["[", "](https://example.com)", "[", "][id]"]);
  assert.ok(decorations(state).some((range) => range.className === "cm-md-ref"));
});

test("images resolve relative to the published post and reveal source when selected", () => {
  for (const [url, expected] of [
    ["./photo.png", "/2026/09/post/photo.png"],
    ["photo.png", "/2026/09/post/photo.png"],
    ["/photo.png", "/photo.png"],
    ["https://example.com/photo.png", "https://example.com/photo.png"],
    ["data:image/png;base64,abc", "data:image/png;base64,abc"],
  ]) {
    const doc = `![photo](${url})\n\nend`;
    const widget = decorations(editor(doc)).find((range) => range.widget)?.widget;
    assert.ok(widget && typeof widget === "object" && "url" in widget && "alt" in widget);
    assert.equal(widget.url, expected);
    assert.equal(widget.alt, "photo");
    assert.equal(decorations(editor(doc, 4)).some((range) => range.widget), false);
  }
});

test("footnote references and definitions have distinct styles", () => {
  const state = editor("Text[^note]\n\n[^note]: detail\n\nend");
  const footnotes = decorations(state).filter((range) => range.className === "cm-md-footnote");
  assert.equal(footnotes.length, 1);
  assert.equal(state.sliceDoc(footnotes[0]!.from, footnotes[0]!.to), "[^note]");
  const definitionLines = decorations(state)
    .filter((range) => range.className === "cm-md-ref")
    .map((range) => state.doc.lineAt(range.from).text);
  assert.deepEqual([...new Set(definitionLines)], ["[^note]: detail"]);
});

test("IME composition maps existing decorations until normal editing resumes", () => {
  const before = editor("[link](https://example.com)\n\nend");
  const composing = before.update({
    changes: { from: 3, insert: "한" },
    selection: { anchor: 4 },
    annotations: Transaction.userEvent.of("input.type.compose"),
  }).state;
  assert.deepEqual(hiddenText(composing), ["[", "](https://example.com)"]);
  const after = composing.update({ selection: { anchor: 5 } }).state;
  assert.deepEqual(hiddenText(after), []);
});
