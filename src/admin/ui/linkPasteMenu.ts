import { type Extension, Prec } from "@codemirror/state";
import {
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
} from "@codemirror/view";
import {
  LINK_PASTE_ACTIONS,
  type LinkPasteAction,
  type LinkPasteOutcome,
} from "./linkPasteActions.ts";

/**
 * Notion-style paste menu for bare URLs.  The URL is inserted immediately and
 * the menu floats next to the caret, so dismissing it -- Escape, clicking
 * elsewhere, or just continuing to type -- always leaves a plain pasted URL
 * behind; no choice is ever forced.  The menu items themselves live in
 * linkPasteActions.ts.
 *
 * Typing closes the menu via docChanged, which is also what keeps the stored
 * range trustworthy: while the menu is open the document cannot have changed,
 * so from/to still delimit exactly the URL that was pasted.
 */
export function linkPasteMenu(
  actions: readonly LinkPasteAction[] = LINK_PASTE_ACTIONS,
): Extension {
  const plugin = ViewPlugin.define(
    (view) => new MenuController(view, actions),
    {
      eventHandlers: {
        paste(event) {
          return this.onPaste(event);
        },
      },
    },
  );
  // Prec.highest so these run before defaultKeymap's Enter/arrow bindings;
  // every handler declines when no menu is open, so writing is unaffected.
  return [
    plugin,
    Prec.highest(
      keymap.of([
        { key: "ArrowDown", run: (v) => v.plugin(plugin)?.move(1) ?? false },
        { key: "ArrowUp", run: (v) => v.plugin(plugin)?.move(-1) ?? false },
        { key: "Enter", run: (v) => v.plugin(plugin)?.pick() ?? false },
        { key: "Escape", run: (v) => v.plugin(plugin)?.dismiss() ?? false },
      ]),
    ),
  ];
}

/** One line, no whitespace, parseable, http(s) -- anything else pastes natively. */
function asPastedUrl(text: string): string | null {
  const t = text.trim();
  if (t === "" || /\s/.test(t) || !/^https?:\/\//i.test(t)) return null;
  try {
    new URL(t);
  } catch {
    return null;
  }
  return t;
}

function renderItem(b: HTMLButtonElement, action: LinkPasteAction) {
  const label = document.createElement("span");
  label.textContent = action.label;
  b.replaceChildren(label);
  if (action.hint !== undefined) {
    const hint = document.createElement("span");
    hint.className = "lpm-hint";
    hint.textContent = action.hint;
    b.appendChild(hint);
  }
}

interface OpenMenu {
  from: number;
  to: number;
  url: string;
  replacedText: string;
  dom: HTMLDivElement;
  items: HTMLButtonElement[];
  errorEl: HTMLParagraphElement;
  active: number;
  busy: boolean;
}

class MenuController {
  private menu: OpenMenu | null = null;

  constructor(
    readonly view: EditorView,
    readonly actions: readonly LinkPasteAction[],
  ) {}

  onPaste(event: ClipboardEvent): boolean {
    const dt = event.clipboardData;
    if (dt === null) return false;
    // Files belong to the image-paste handler in EditorCodeMirror.tsx.
    for (const item of dt.items) if (item.kind === "file") return false;
    const url = asPastedUrl(dt.getData("text/plain"));
    if (url === null) return false;
    event.preventDefault();
    const { from, to } = this.view.state.selection.main;
    const replacedText = this.view.state.sliceDoc(from, to);
    this.view.dispatch({
      changes: { from, to, insert: url },
      selection: { anchor: from + url.length },
      scrollIntoView: true,
    });
    this.open({ from, to: from + url.length, url, replacedText });
    return true;
  }

  update(u: ViewUpdate) {
    // Any edit or caret move -- typing on, undo, clicking into the text --
    // means the user has moved past the decision.
    if (this.menu !== null && (u.docChanged || u.selectionSet)) this.close();
  }

  destroy() {
    this.close();
  }

  move(delta: number): boolean {
    const menu = this.menu;
    if (menu === null) return false;
    if (!menu.busy) {
      this.setActive((menu.active + delta + menu.items.length) % menu.items.length);
    }
    return true;
  }

  pick(): boolean {
    const menu = this.menu;
    if (menu === null) return false;
    if (!menu.busy) void this.run(menu.active);
    return true;
  }

  dismiss(): boolean {
    if (this.menu === null) return false;
    this.close();
    return true;
  }

  private open(at: Pick<OpenMenu, "from" | "to" | "url" | "replacedText">) {
    this.close();
    const dom = document.createElement("div");
    dom.className = "link-paste-menu";

    const head = document.createElement("div");
    head.className = "lpm-head";
    head.textContent = new URL(at.url).hostname;
    dom.appendChild(head);

    const items = this.actions.map((action, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lpm-item";
      renderItem(b, action);
      b.addEventListener("mouseenter", () => this.setActive(i));
      // Keep focus (and the caret) in the editor while clicking.
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => void this.run(i));
      dom.appendChild(b);
      return b;
    });

    const errorEl = document.createElement("p");
    errorEl.className = "lpm-error";
    errorEl.hidden = true;
    dom.appendChild(errorEl);

    document.body.appendChild(dom);
    this.menu = { ...at, dom, items, errorEl, active: 0, busy: false };
    this.setActive(0);
    this.position();
    window.addEventListener("mousedown", this.onGlobalMousedown, true);
    window.addEventListener("scroll", this.onGlobalScroll, true);
  }

  private close() {
    if (this.menu === null) return;
    this.menu.dom.remove();
    this.menu = null;
    window.removeEventListener("mousedown", this.onGlobalMousedown, true);
    window.removeEventListener("scroll", this.onGlobalScroll, true);
  }

  private onGlobalMousedown = (e: MouseEvent) => {
    if (this.menu !== null && !this.menu.dom.contains(e.target as Node)) {
      this.close();
    }
  };

  // Following the caret keeps the menu attached through the scrollIntoView
  // that the paste itself may trigger; closing here instead would make the
  // menu vanish before it was ever seen.
  private onGlobalScroll = () => this.position();

  private position() {
    const menu = this.menu;
    if (menu === null) return;
    const coords = this.view.coordsAtPos(menu.to);
    if (coords === null) {
      this.close();
      return;
    }
    const pad = 8;
    const w = menu.dom.offsetWidth;
    const h = menu.dom.offsetHeight;
    let top = coords.bottom + 6;
    if (top + h > window.innerHeight - pad) top = coords.top - h - 6;
    menu.dom.style.left =
      `${Math.max(pad, Math.min(coords.left, window.innerWidth - w - pad))}px`;
    menu.dom.style.top = `${Math.max(pad, top)}px`;
  }

  private setActive(i: number) {
    const menu = this.menu;
    if (menu === null) return;
    menu.active = i;
    menu.items.forEach((b, j) => b.classList.toggle("active", j === i));
  }

  private async run(i: number) {
    const menu = this.menu;
    if (menu === null || menu.busy) return;
    const action = this.actions[i]!;
    menu.errorEl.hidden = true;

    let outcome: LinkPasteOutcome | null;
    try {
      const r = action.run({ url: menu.url, replacedText: menu.replacedText });
      if (r instanceof Promise) {
        this.setBusy(menu, i);
        outcome = await r;
      } else {
        outcome = r;
      }
    } catch (e) {
      // Escape or typing while the fetch was in flight already closed the
      // menu; the stale result (and its error) is simply dropped.
      if (this.menu !== menu) return;
      this.clearBusy(menu);
      menu.errorEl.textContent = e instanceof Error ? e.message : String(e);
      menu.errorEl.hidden = false;
      this.position();
      return;
    }

    if (this.menu !== menu) return;
    this.close();
    if (outcome === null) {
      this.view.focus();
      return;
    }
    const sel = outcome.selection;
    this.view.dispatch({
      changes: { from: menu.from, to: menu.to, insert: outcome.text },
      selection:
        sel === undefined
          ? { anchor: menu.from + outcome.text.length }
          : { anchor: menu.from + sel.anchor, head: menu.from + sel.head },
      scrollIntoView: true,
    });
    this.view.focus();
  }

  private setBusy(menu: OpenMenu, i: number) {
    menu.busy = true;
    menu.items.forEach((b, j) => {
      b.disabled = true;
      if (j === i && this.actions[j]!.busyLabel !== undefined) {
        b.replaceChildren(this.actions[j]!.busyLabel!);
      }
    });
    this.position();
  }

  private clearBusy(menu: OpenMenu) {
    menu.busy = false;
    menu.items.forEach((b, j) => {
      b.disabled = false;
      renderItem(b, this.actions[j]!);
    });
    this.position();
  }
}
