import { For, Show, createEffect, createSignal } from "solid-js";
import type { RenderedView } from "../lib/types.ts";
import { LANG_LABEL } from "./api.ts";

/**
 * The published page itself, not a lookalike: the server renders PostView.tsx
 * through the Container API and this drops the resulting document into an
 * iframe, so the real stylesheet, header, language nav and night veil all apply.
 * That is what the inline live preview cannot show, which is why this exists as
 * a toggle rather than a permanent split.
 */
export default function Preview(props: {
  views: RenderedView[];
  ms: number;
  loading: boolean;
  error?: string;
  realUrl?: string;
  /** 0..1 of the editor's scroll, mirrored here. */
  scroll?: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [active, setActive] = createSignal(0);
  const current = () => props.views[Math.min(active(), props.views.length - 1)];

  // A signal rather than a bare `let`, so the effects below re-run when the
  // frame is mounted or replaced, not only when the document changes.
  const [frame, setFrame] = createSignal<HTMLIFrameElement>();

  // Proportional rather than element-anchored: the rendered HTML has no stable
  // mapping back to source lines once seonbi has run over it.
  const applyScroll = () => {
    const ratio = props.scroll;
    const root = frame()?.contentDocument?.scrollingElement;
    if (ratio === undefined || root == null) return;
    const max = root.scrollHeight - root.clientHeight;
    if (max <= 0) return;
    const target = ratio * max;
    if (Math.abs(root.scrollTop - target) > 4) root.scrollTop = target;
  };
  createEffect(applyScroll);

  // Assigned imperatively so an unchanged document is never rewritten: setting
  // srcdoc reloads the frame, which resets the scroll and refetches the
  // stylesheet, and a save re-runs the preview with identical output often.
  createEffect(() => {
    const el = frame();
    const doc = current()?.document;
    if (el === undefined || doc === undefined) return;
    if (el.srcdoc !== doc) el.srcdoc = doc;
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

      <Show when={current()} fallback={<div class="empty">미리보기 없음</div>}>
        {/* Not sandboxed: the scroll mirroring above needs same-origin access,
            and allow-same-origin plus allow-scripts would lift the sandbox
            anyway.  This is a localhost-only tool showing the author's own
            drafts. */}
        <iframe
          class="preview-frame"
          title="발행 미리보기"
          ref={setFrame}
          onLoad={applyScroll}
        />
      </Show>
    </aside>
  );
}
