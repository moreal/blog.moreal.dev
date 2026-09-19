import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  type Extension,
  type Range,
  StateField,
  type Transaction,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";

export interface LivePreviewOptions {
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

type MarkdownNode = ReturnType<typeof syntaxTree>["topNode"];

const FOOTNOTE_REFERENCE = /\[\^[^\]\s]+\](?!:)/g;
const FOOTNOTE_DEFINITION = /^\[\^[^\]\s]+\]:/;
interface InlineStyle {
  className: string;
  marks: string[];
}

const INLINE_STYLES: Partial<Record<string, InlineStyle>> = {
  StrongEmphasis: {
    className: "cm-md-strong",
    marks: ["EmphasisMark", "StrikethroughMark"],
  },
  Emphasis: {
    className: "cm-md-em",
    marks: ["EmphasisMark", "StrikethroughMark"],
  },
  Strikethrough: {
    className: "cm-md-strike",
    marks: ["EmphasisMark", "StrikethroughMark"],
  },
  InlineCode: { className: "cm-md-code", marks: ["CodeMark"] },
};

function resolveImageUrl(url: string, assetBase: string): string {
  return /^(https?:|data:|\/)/.test(url)
    ? url
    : assetBase + url.replace(/^\.\//, "");
}

class MarkdownDecorations {
  private readonly ranges: Range<Decoration>[] = [];

  constructor(
    private readonly state: EditorState,
    private readonly options: LivePreviewOptions,
  ) {}

  build(): DecorationSet {
    syntaxTree(this.state).iterate({
      enter: ({ node }) => {
        this.decorateNode(node);
      },
    });
    this.decorateFootnotes();
    return Decoration.set(this.ranges, true);
  }

  private selectionTouches({ from, to }: MarkdownNode): boolean {
    return this.state.selection.ranges.some(
      (selection) => selection.from <= to && selection.to >= from,
    );
  }

  private add(from: number, to: number, decoration: Decoration): void {
    if (from <= to) this.ranges.push(decoration.range(from, to));
  }

  private hide(from: number, to: number): void {
    if (from < to) this.ranges.push(hidden.range(from, to));
  }

  private styleLine(position: number, className: string): void {
    const { from } = this.state.doc.lineAt(position);
    this.add(from, from, Decoration.line({ class: className }));
  }

  private styleBlock(node: MarkdownNode, className: string): void {
    const doc = this.state.doc;
    const firstLine = doc.lineAt(node.from).number;
    const lastLine = doc.lineAt(node.to).number;
    for (let number = firstLine; number <= lastLine; number++) {
      this.styleLine(doc.line(number).from, className);
    }
  }

  private decorateNode(node: MarkdownNode): void {
    const heading = /^(ATX|Setext)Heading(\d)$/.exec(node.name);
    if (heading) {
      this.decorateHeading(node, heading[1] === "Setext", heading[2]!);
      return;
    }
    const inlineStyle = INLINE_STYLES[node.name];
    if (inlineStyle) {
      this.decorateInline(node, inlineStyle);
      return;
    }
    switch (node.name) {
      case "Image":
        this.decorateImage(node);
        break;
      case "Link":
        this.decorateLink(node);
        break;
      case "Autolink":
        this.decorateAutolink(node);
        break;
      case "LinkReference":
        this.styleLine(node.from, "cm-md-ref");
        break;
      case "FencedCode":
        this.styleBlock(node, "cm-md-fence");
        break;
      case "Blockquote":
        this.styleBlock(node, "cm-md-quote");
        break;
    }
  }

  private decorateHeading(
    node: MarkdownNode,
    setext: boolean,
    level: string,
  ): void {
    this.styleLine(node.from, `cm-md-h${level}`);
    if (this.selectionTouches(node)) return;
    const mark = node.getChild("HeaderMark");
    if (!mark) return;
    if (setext) {
      this.hideUnderlineWithPrecedingNewline(mark);
    } else {
      this.hideHeadingPrefixWithSpace(mark, node.to);
    }
  }

  private hideUnderlineWithPrecedingNewline(mark: MarkdownNode): void {
    this.hide(mark.from - 1, mark.to);
  }

  private hideHeadingPrefixWithSpace(
    mark: MarkdownNode,
    headingEnd: number,
  ): void {
    this.hide(mark.from, Math.min(mark.to + 1, headingEnd));
  }

  private decorateInline(
    node: MarkdownNode,
    { className, marks }: InlineStyle,
  ): void {
    this.add(node.from, node.to, Decoration.mark({ class: className }));
    if (this.selectionTouches(node)) return;
    for (const name of marks) {
      for (const mark of node.getChildren(name)) this.hide(mark.from, mark.to);
    }
  }

  private decorateImage(node: MarkdownNode): void {
    const text = this.state.doc.sliceString(node.from, node.to);
    const image = /^!\[([^\]]*)\]\(\s*<?([^)>\s]+)/.exec(text);
    if (!image || this.selectionTouches(node)) return;
    const url = resolveImageUrl(image[2]!, this.options.assetBase?.() ?? "");
    this.add(
      node.from,
      node.to,
      Decoration.replace({ widget: new ImageWidget(url, image[1] ?? "") }),
    );
  }

  private decorateLink(node: MarkdownNode): void {
    this.add(node.from, node.to, Decoration.mark({ class: "cm-md-link" }));
    if (this.selectionTouches(node)) return;
    this.hideLinkSyntaxOutsideLabel(node);
  }

  private hideLinkSyntaxOutsideLabel(node: MarkdownNode): void {
    const marks = node.getChildren("LinkMark");
    if (marks.length < 2) return;
    this.hide(marks[0]!.from, marks[0]!.to);
    this.hide(marks[1]!.from, node.to);
  }

  private decorateAutolink(node: MarkdownNode): void {
    this.add(node.from, node.to, Decoration.mark({ class: "cm-md-link" }));
    if (this.selectionTouches(node)) return;
    this.hide(node.from, node.from + 1);
    this.hide(node.to - 1, node.to);
  }

  private decorateFootnotes(): void {
    const doc = this.state.doc;
    for (let number = 1; number <= doc.lines; number++) {
      const line = doc.line(number);
      if (!line.text.includes("[^")) continue;
      for (const reference of line.text.matchAll(FOOTNOTE_REFERENCE)) {
        const from = line.from + reference.index;
        this.add(
          from,
          from + reference[0].length,
          Decoration.mark({ class: "cm-md-footnote" }),
        );
      }
      if (FOOTNOTE_DEFINITION.test(line.text)) this.styleLine(line.from, "cm-md-ref");
    }
  }
}

function preserveDecorationsDuringComposition(
  decorations: DecorationSet,
  transaction: Transaction,
): DecorationSet {
  return transaction.docChanged
    ? decorations.map(transaction.changes)
    : decorations;
}

export function livePreview(opts: LivePreviewOptions = {}): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => new MarkdownDecorations(state, opts).build(),
    update(value, tr) {
      if (tr.isUserEvent("input.type.compose")) {
        return preserveDecorationsDuringComposition(value, tr);
      }
      if (!tr.docChanged && !tr.selection && !tr.effects.length) return value;
      return new MarkdownDecorations(tr.state, opts).build();
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
