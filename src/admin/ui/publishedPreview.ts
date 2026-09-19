import { createSignal, type Accessor } from "solid-js";
import type { FrontMatterForm, RenderedView } from "../lib/types.ts";
import { errorMessage } from "../shared/errors.ts";
import { api, type LoadedSource } from "./api.ts";

export function createPublishedPreview(
  source: Accessor<LoadedSource | null | undefined>,
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
      setError(errorMessage(e));
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
