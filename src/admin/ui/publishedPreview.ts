import { createSignal, type Accessor } from "solid-js";
import type { FrontMatterForm, RenderedView, SourceResponse } from "../lib/types.ts";
import { api } from "./api.ts";

type LoadedSource = Extract<SourceResponse, { ok: true }> | null | undefined;

export function createPublishedPreview(
  source: Accessor<LoadedSource>,
  frontmatter: Accessor<FrontMatterForm>,
  body: Accessor<string>,
) {
  const [visible, setVisible] = createSignal(false);
  const [views, setViews] = createSignal<RenderedView[]>([]);
  const [elapsedMs, setElapsedMs] = createSignal(0);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function refresh() {
    const src = source();
    if (src === undefined || src === null) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.preview({
        file: src.file,
        frontmatter: frontmatter(),
        body: body(),
        lang: src.lang,
      });
      setViews(res.views);
      setElapsedMs(res.ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !visible();
    setVisible(next);
    if (next) void refresh();
  }

  return {
    visible,
    views,
    elapsedMs,
    error,
    loading,
    refresh,
    toggle,
    close: () => setVisible(false),
  };
}
