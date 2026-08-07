import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  type Extension,
  type Range,
  StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

/**
 * Obsidian-style live preview: markup is hidden until the cursor enters the
 * element it belongs to, so the writing surface reads as formatted text while
 * the document underneath stays plain markdown.
 *
 * Scope is deliberately narrow -- only the constructs this blog actually uses,
 * which is also why hongdown's output (setext headings, reference-style links,
 * ~~~~ fences) is handled properly here where general-purpose tools tend not to.
 *
 * Two rules learned the hard way and encoded below:
 *   - a StateField, never a ViewPlugin: decorations that change vertical layout
 *     have to be provided directly, not through a plugin field;
 *   - no atomicRanges: it makes Backspace swallow a whole hidden span.
 */

export interface LivePreviewOptions {
  /** Prefix that makes `./foo.png` resolvable, e.g. "/__admin/asset/2026/02/x/". */
  assetBase?: () => string;
}

const hidden = Decoration.replace({});

class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
  ) {
    super();
  }
  override eq(other: ImageWidget): boolean {
    return other.url === this.url && other.alt === this.alt;
  }
  override toDOM(): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-md-image";
    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.alt;
    img.loading = "lazy";
    img.onerror = () => {
      wrap.classList.add("missing");
      wrap.textContent = `⚠ ${this.alt || this.url}`;
    };
    wrap.appendChild(img);
    return wrap;
  }
  override ignoreEvent(): boolean {
    return false;
  }
}

function touches(state: EditorState, from: number, to: number): boolean {
  for (const r of state.selection.ranges) {
    if (r.from <= to && r.to >= from) return true;
  }
  return false;
}

/** Footnotes are not in the markdown grammar, so they are matched textually. */
const FOOTNOTE = /\[\^[^\]\s]+\](?!:)/g;

function buildDecorations(
  state: EditorState,
  opts: LivePreviewOptions,
): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const doc = state.doc;
  const add = (from: number, to: number, deco: Decoration) => {
    if (from <= to) ranges.push(deco.range(from, to));
  };
  const hide = (from: number, to: number) => {
    if (from < to) ranges.push(hidden.range(from, to));
  };

  syntaxTree(state).iterate({
    enter(node) {
      const { name, from, to } = node;

      // ---- headings ----
      const atx = /^ATXHeading(\d)$/.exec(name);
      if (atx !== null) {
        const level = atx[1]!;
        add(doc.lineAt(from).from, doc.lineAt(from).from, Decoration.line({ class: `cm-md-h${level}` }));
        if (!touches(state, from, to)) {
          const mark = node.node.getChild("HeaderMark");
          // Swallow the single space after the hashes too, so the text lines up
          // with surrounding paragraphs instead of sitting one column in.
          if (mark) hide(mark.from, Math.min(mark.to + 1, to));
        }
        return;
      }

      const setext = /^SetextHeading(\d)$/.exec(name);
      if (setext !== null) {
        const level = setext[1]!;
        const first = doc.lineAt(from);
        add(first.from, first.from, Decoration.line({ class: `cm-md-h${level}` }));
        if (!touches(state, from, to)) {
          const mark = node.node.getChild("HeaderMark");
          // Replacing the newline as well collapses the underline's whole line
          // rather than leaving a blank one behind.
          if (mark) hide(mark.from - 1, mark.to);
        }
        return;
      }

      // ---- inline emphasis ----
      if (name === "StrongEmphasis" || name === "Emphasis" || name === "Strikethrough") {
        const cls =
          name === "StrongEmphasis"
            ? "cm-md-strong"
            : name === "Emphasis"
            ? "cm-md-em"
            : "cm-md-strike";
        add(from, to, Decoration.mark({ class: cls }));
        if (!touches(state, from, to)) {
          for (const child of node.node.getChildren("EmphasisMark")) {
            hide(child.from, child.to);
          }
          for (const child of node.node.getChildren("StrikethroughMark")) {
            hide(child.from, child.to);
          }
        }
        return;
      }

      if (name === "InlineCode") {
        add(from, to, Decoration.mark({ class: "cm-md-code" }));
        if (!touches(state, from, to)) {
          for (const child of node.node.getChildren("CodeMark")) {
            hide(child.from, child.to);
          }
        }
        return;
      }

      // ---- links and images ----
      if (name === "Image") {
        const text = doc.sliceString(from, to);
        const m = /^!\[([^\]]*)\]\(\s*<?([^)>\s]+)/.exec(text);
        if (m !== null && !touches(state, from, to)) {
          const raw = m[2]!;
          const base = opts.assetBase?.() ?? "";
          // Links are written URL-relative (./foo.png next to the post's own
          // index.html), which is not where the file sits on disk, so the
          // preview has to route them through the asset base.
          const url = /^(https?:|data:|\/)/.test(raw)
            ? raw
            : base + raw.replace(/^\.\//, "");
          add(
            from,
            to,
            Decoration.replace({ widget: new ImageWidget(url, m[1] ?? "") }),
          );
        }
        return;
      }

      if (name === "Link") {
        add(from, to, Decoration.mark({ class: "cm-md-link" }));
        if (!touches(state, from, to)) {
          const marks = node.node.getChildren("LinkMark");
          // [text](url) and [text][label] both open with one mark and close
          // with the rest; hiding everything from the second mark on leaves
          // just the visible text.
          if (marks.length >= 2) {
            hide(marks[0]!.from, marks[0]!.to);
            hide(marks[1]!.from, to);
          }
        }
        return;
      }

      if (name === "Autolink") {
        add(from, to, Decoration.mark({ class: "cm-md-link" }));
        if (!touches(state, from, to)) {
          hide(from, from + 1);
          hide(to - 1, to);
        }
        return;
      }

      // Reference definitions are structural bookkeeping hongdown maintains at
      // section ends; dim them rather than hide, so they stay editable.
      if (name === "LinkReference") {
        add(
          doc.lineAt(from).from,
          doc.lineAt(from).from,
          Decoration.line({ class: "cm-md-ref" }),
        );
        return;
      }

      if (name === "FencedCode") {
        for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) {
          const line = doc.line(n);
          add(line.from, line.from, Decoration.line({ class: "cm-md-fence" }));
        }
        return;
      }

      if (name === "Blockquote") {
        for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) {
          const line = doc.line(n);
          add(line.from, line.from, Decoration.line({ class: "cm-md-quote" }));
        }
        return;
      }
      return;
    },
  });

  // Footnote references, matched on the text since the grammar has no node.
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (!line.text.includes("[^")) continue;
    for (const m of line.text.matchAll(FOOTNOTE)) {
      const from = line.from + (m.index ?? 0);
      add(from, from + m[0].length, Decoration.mark({ class: "cm-md-footnote" }));
    }
    if (/^\[\^[^\]\s]+\]:/.test(line.text)) {
      add(line.from, line.from, Decoration.line({ class: "cm-md-ref" }));
    }
  }

  return Decoration.set(ranges, true);
}

export function livePreview(opts: LivePreviewOptions = {}): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state, opts),
    update(value, tr) {
      // Never re-decorate mid-composition: replacing the text node a composition
      // lives in aborts the IME, which is exactly what breaks Hanja conversion.
      if (tr.isUserEvent("input.type.compose")) {
        return tr.docChanged ? value.map(tr.changes) : value;
      }
      if (!tr.docChanged && !tr.selection && !tr.effects.length) return value;
      return buildDecorations(tr.state, opts);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  return [field, theme];
}

const theme = EditorView.baseTheme({
  ".cm-md-h1": { fontSize: "1.6em", fontWeight: "700", lineHeight: "1.3" },
  ".cm-md-h2": { fontSize: "1.35em", fontWeight: "700", lineHeight: "1.3" },
  ".cm-md-h3": { fontSize: "1.15em", fontWeight: "700" },
  ".cm-md-h4, .cm-md-h5, .cm-md-h6": { fontWeight: "700" },
  ".cm-md-strong": { fontWeight: "700" },
  ".cm-md-em": { fontStyle: "italic" },
  ".cm-md-strike": { textDecoration: "line-through", opacity: "0.7" },
  ".cm-md-code": {
    fontFamily: "var(--mono)",
    fontSize: "0.92em",
    background: "var(--bg)",
    borderRadius: "3px",
    padding: "0.1em 0.3em",
  },
  ".cm-md-link": { color: "var(--accent)", textDecoration: "underline" },
  ".cm-md-footnote": { color: "var(--accent)", fontSize: "0.85em", verticalAlign: "super" },
  ".cm-md-ref": { opacity: "0.55", fontSize: "0.9em" },
  ".cm-md-fence": { fontFamily: "var(--mono)", fontSize: "0.92em", background: "var(--bg)" },
  ".cm-md-quote": {
    borderLeft: "3px solid var(--line)",
    paddingLeft: "10px",
    fontStyle: "italic",
    opacity: "0.85",
  },
  ".cm-md-image": { display: "inline-block", maxWidth: "100%", verticalAlign: "top" },
  ".cm-md-image img": {
    maxWidth: "min(100%, 520px)",
    maxHeight: "360px",
    borderRadius: "6px",
    border: "1px solid var(--line)",
    display: "block",
  },
  ".cm-md-image.missing": {
    color: "var(--bad)",
    fontFamily: "var(--mono)",
    fontSize: "0.85em",
  },
});
