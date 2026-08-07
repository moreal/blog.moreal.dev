import { For, Show, createEffect, createSignal } from "solid-js";
import type { RenderedView } from "../lib/types.ts";
import { LANG_LABEL } from "./api.ts";

/**
 * The published rendering, not a lookalike: this HTML comes from posts.ts, so a
 * ko-Kore source shows its Hanja ruby and its derived Hangul view exactly as
 * they will ship.  That is the one thing the inline live preview cannot show,
 * which is why this exists as a toggle rather than a permanent split.
 */
export default function Preview(props: {
  views: RenderedView[];
  ms: number;
  loading: boolean;
  error?: string;
  assetBase: string;
  publishedLabel?: string;
  bookLine?: string;
  realUrl?: string;
  /** 0..1 of the editor's scroll, mirrored here. */
  scroll?: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [active, setActive] = createSignal(0);
  const current = () => props.views[Math.min(active(), props.views.length - 1)];

  let bodyEl: HTMLDivElement | undefined;
  // Proportional rather than element-anchored: the rendered HTML has no stable
  // mapping back to source lines once seonbi has run over it.
  createEffect(() => {
    const ratio = props.scroll;
    if (ratio === undefined || bodyEl === undefined) return;
    const max = bodyEl.scrollHeight - bodyEl.clientHeight;
    if (max <= 0) return;
    const target = ratio * max;
    if (Math.abs(bodyEl.scrollTop - target) > 4) bodyEl.scrollTop = target;
  });

  return (
    <aside class="preview">
      <div class="preview-head">
        <For each={props.views}>
          {(v, i) => (
            <button
              class={i() === active() ? "primary small" : "small"}
              onClick={() => setActive(i())}
            >
              {LANG_LABEL[v.lang] ?? v.lang}
            </button>
          )}
        </For>
        <span class="grow" />
        <Show when={props.ms > 0}>
          <span class="when">{props.ms}ms</span>
        </Show>
        <Show when={props.realUrl}>
          {(href) => (
            <a class="btn small" href={href()} target="_blank">
              실제 페이지
            </a>
          )}
        </Show>
        <button class="small" onClick={props.onRefresh} disabled={props.loading}>
          {props.loading ? "…" : "새로고침"}
        </button>
        <button class="small" onClick={props.onClose}>
          닫기
        </button>
      </div>

      <Show when={props.error}>
        <div class="preview-error">{props.error}</div>
      </Show>

      <div class="preview-body" ref={bodyEl}>
        <Show when={current()} fallback={<div class="empty">미리보기 없음</div>}>
          {(v) => (
            // Mirrors PostView.tsx: the title lives inside the rendered HTML
            // (markdown-it-title only reads it), so nothing is added here.
            <div class="post">
              <Show when={props.publishedLabel}>
                <div class="publish-date">{props.publishedLabel}</div>
              </Show>
              <Show when={props.bookLine}>
                <p class="book-info">{props.bookLine}</p>
              </Show>
              <article innerHTML={rebase(v().html, props.assetBase)} />
            </div>
          )}
        </Show>
      </div>
    </aside>
  );
}

/**
 * Rewrite relative image sources to the dev asset route.  A <base> element
 * would apply to the whole admin document, so the rewrite is done here instead.
 */
function rebase(html: string, base: string): string {
  return html.replace(
    /(<img\b[^>]*\bsrc=")(\.\/)?([^"/][^"]*)"/g,
    (all, head: string, _dot: string, rest: string) =>
      /^(https?:|data:)/.test(rest) ? all : `${head}${base}${rest}"`,
  );
}
