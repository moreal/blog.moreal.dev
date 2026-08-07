import { Show, createResource, createSignal, onCleanup, onMount } from "solid-js";
import type {
  FrontMatterForm as Form,
  RenderedView,
  SaveResponse,
} from "../lib/types.ts";
import EditorCodeMirror from "./EditorCodeMirror.tsx";
import EditorTextarea from "./EditorTextarea.tsx";
import FrontMatterForm from "./FrontMatterForm.tsx";
import ImageNameDialog, {
  type ImageNameRequest,
  type ImageNameResult,
} from "./ImageNameDialog.tsx";
import Preview from "./Preview.tsx";
import { LANG_LABEL, api } from "./api.ts";
import type { EditorHandle } from "./engine.ts";

const DRAFT_PREFIX = "cms-draft:";

export default function Editor() {
  const file = new URLSearchParams(location.search).get("file") ?? "";
  const [loaded] = createResource(() => (file === "" ? null : api.source(file)));
  const [cfg] = createResource(() => api.config());

  const [body, setBody] = createSignal("");
  const [fm, setFm] = createSignal<Form>({ published: "" });
  const [fenceRaw, setFenceRaw] = createSignal("");
  const [mtimeMs, setMtimeMs] = createSignal(0);
  const [dirty, setDirty] = createSignal(false);
  const [status, setStatus] = createSignal("");
  const [warning, setWarning] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [recovered, setRecovered] = createSignal<string | null>(null);

  const [showPreview, setShowPreview] = createSignal(false);
  const [views, setViews] = createSignal<RenderedView[]>([]);
  const [previewMs, setPreviewMs] = createSignal(0);
  const [previewErr, setPreviewErr] = createSignal("");
  const [previewing, setPreviewing] = createSignal(false);
  const [scroll, setScroll] = createSignal(0);

  let handle: EditorHandle | undefined;

  const [dialog, setDialog] = createSignal<ImageNameRequest | null>(null);
  let resolveDialog: ((r: ImageNameResult | null) => void) | undefined;

  /**
   * Ask the server for a name, let the user adjust it, then write the file.
   * The Blob was already grabbed synchronously by the engine -- the
   * DataTransfer is dead by now.
   */
  async function onImagePaste(files: File[]): Promise<string | null> {
    const src = loaded();
    if (src === undefined || src === null) return null;
    const inserted: string[] = [];
    for (const file of files) {
      const params = new URLSearchParams({
        mdFile: src.file,
        mime: file.type,
        ...(file.name !== "" ? { originalName: file.name } : {}),
      });
      const res = await fetch(`/admin/api/image-name?${params}`);
      const info = (await res.json()) as
        | { ok: true; suggestion: string; ext: string; existing: string[]; dir: string }
        | { ok: false; message: string };
      if (!info.ok) {
        setWarning(info.message);
        continue;
      }

      const objectUrl = URL.createObjectURL(file);
      const choice = await new Promise<ImageNameResult | null>((resolve) => {
        resolveDialog = resolve;
        setDialog({
          suggestion: info.suggestion,
          ext: info.ext,
          dir: info.dir,
          existing: info.existing,
          preview: objectUrl,
        });
      });
      setDialog(null);
      URL.revokeObjectURL(objectUrl);
      if (choice === null) continue;

      const body = new FormData();
      body.set("file", file);
      body.set("mdFile", src.file);
      body.set("name", choice.name);
      body.set("overwrite", String(choice.overwrite));
      const up = await fetch("/admin/api/image", { method: "POST", body });
      const saved = (await up.json()) as
        | { ok: true; markdown: string }
        | { ok: false; message: string };
      if (!saved.ok) {
        setWarning(saved.message);
        continue;
      }
      inserted.push(saved.markdown);
    }
    return inserted.length === 0 ? null : inserted.join("\n\n");
  }

  // The post's own published URL directory, which is what `./foo.png` in the
  // markdown is relative to.  The admin page lives elsewhere, so the preview
  // needs it spelled out absolutely.
  const assetBase = () => {
    const src = loaded();
    return src ? `/${src.postPath}/` : "";
  };

  // Mirrors what PostView.tsx puts around the article.
  const publishedLabel = () => {
    const iso = fm().published;
    if (iso === "") return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(d);
    // Number() drops the zero padding, matching kstDate() in posts.ts.
    const at = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    return `${at("year")}년 ${at("month")}월 ${at("day")}일`;
  };

  const bookLine = () => {
    const b = fm().book;
    if (fm().type !== "reading" || b === undefined) return "";
    return [
      b.author,
      b.translator !== undefined ? `${b.translator} 옮김` : undefined,
      b.publisher,
      b.year !== undefined ? String(b.year) : undefined,
    ]
      .filter((x): x is string => typeof x === "string")
      .join(" · ");
  };

  // Seed from the server once, then never re-render the surface from a signal:
  // the engine owns its own state.
  let seeded = false;
  const seed = () => {
    const src = loaded();
    if (src === undefined || src === null || seeded) return;
    seeded = true;
    setBody(src.body);
    setFm(src.frontmatter);
    setFenceRaw(src.fenceRaw);
    setMtimeMs(src.mtimeMs);
    const stash = localStorage.getItem(DRAFT_PREFIX + src.file);
    if (stash !== null && stash !== src.body) setRecovered(stash);
  };

  onMount(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty()) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    // The engine binds Cmd-S too, but only fires while it has focus; after a
    // dialog closes or the front matter form is in use it does not.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", onKey);
    });
  });

  function onChange(next: string) {
    setBody(next);
    setDirty(true);
    setStatus("");
    // Survives a dev-server restart, which happens often enough while the CMS
    // itself is being worked on.
    if (file !== "") localStorage.setItem(DRAFT_PREFIX + file, next);
  }

  async function save(force = false) {
    if (saving()) return;
    setSaving(true);
    setStatus("저장 중…");
    setWarning("");
    try {
      const res = await fetch("/admin/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          file,
          frontmatter: fm(),
          body: body(),
          fenceRaw: fenceRaw(),
          expectedMtimeMs: force ? -1 : mtimeMs(),
        }),
      });
      const data = (await res.json()) as SaveResponse;
      if (!data.ok) {
        if (data.error === "stale") {
          setStatus("");
          if (
            confirm(
              "파일이 편집기 밖에서 바뀌었습니다.\n확인을 누르면 내 내용으로 덮어씁니다.",
            )
          ) {
            setSaving(false);
            return save(true);
          }
          location.reload();
          return;
        }
        setStatus("");
        setWarning(`저장 실패: ${data.message}`);
        return;
      }
      setFenceRaw(data.fenceRaw);
      setMtimeMs(data.mtimeMs);
      // hongdown reflows paragraphs and can move footnote definitions, so the
      // document is replaced wholesale from disk; the caret is re-found by
      // matching the line it was on.
      handle?.replaceAll(data.body);
      setBody(data.body);
      setDirty(false);
      localStorage.removeItem(DRAFT_PREFIX + file);
      setStatus(data.formatted ? "저장됨 · hongdown 적용" : "저장됨");
      if (data.formatterWarning !== undefined) setWarning(data.formatterWarning);
      else if (data.formatterNotices !== undefined) {
        setWarning(`hongdown: ${data.formatterNotices}`);
      }
      if (showPreview()) void refreshPreview();
    } catch (e) {
      setStatus("");
      setWarning(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function refreshPreview() {
    const src = loaded();
    if (src === undefined || src === null) return;
    setPreviewing(true);
    setPreviewErr("");
    try {
      const res = await api.preview({
        frontmatter: fm(),
        body: body(),
        lang: src.lang,
      });
      setViews(res.views);
      setPreviewMs(res.ms);
    } catch (e) {
      setPreviewErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewing(false);
    }
  }

  function togglePreview() {
    const next = !showPreview();
    setShowPreview(next);
    if (next) void refreshPreview();
  }

  const Engine = () =>
    cfg()?.editorEngine === "textarea" ? EditorTextarea : EditorCodeMirror;

  return (
    <div class="editor">
      <Show when={file === ""}>
        <div class="card bad-box">?file= 이 없습니다.</div>
      </Show>

      <Show when={loaded.error}>
        <div class="card bad-box">불러오지 못했습니다: {String(loaded.error)}</div>
      </Show>

      <Show when={loaded()} keyed>
        {(src) => {
          seed();
          const Surface = Engine();
          return (
            <>
              <div class="editor-head">
                <div>
                  <a class="back" href="/admin">
                    ← 목록
                  </a>
                  <code>{src.file}</code>
                  <span class="chip">{LANG_LABEL[src.lang] ?? src.lang}</span>
                  <Show when={src.lang === "ko-Kore"}>
                    <span class="chip derived">→ 한국어 (파생)</span>
                  </Show>
                  <Show when={dirty()}>
                    <span class="chip warn">저장 안 됨</span>
                  </Show>
                </div>
                <div class="toolbar" style={{ margin: 0 }}>
                  <span class="when">{status()}</span>
                  <button class={showPreview() ? "primary" : ""} onClick={togglePreview}>
                    발행 미리보기
                  </button>
                  <button class="primary" onClick={() => save()} disabled={saving()}>
                    저장 <kbd>⌘S</kbd>
                  </button>
                </div>
              </div>

              <Show when={warning()}>
                <div class="banner warn">{warning()}</div>
              </Show>

              <Show when={recovered()}>
                {(text) => (
                  <div class="banner">
                    저장하지 않은 내용이 남아 있습니다.
                    <button
                      class="small"
                      onClick={() => {
                        handle?.replaceAll(text());
                        setBody(text());
                        setDirty(true);
                        setRecovered(null);
                      }}
                    >
                      복구
                    </button>
                    <button
                      class="small"
                      onClick={() => {
                        localStorage.removeItem(DRAFT_PREFIX + file);
                        setRecovered(null);
                      }}
                    >
                      버리기
                    </button>
                  </div>
                )}
              </Show>

              <FrontMatterForm
                value={fm()}
                onChange={(next) => {
                  setFm(next);
                  setDirty(true);
                }}
                nowIso={() => new Date().toISOString().slice(0, 19) + "+09:00"}
              />

              <div class="editor-main" classList={{ split: showPreview() }}>
                <Surface
                  value={src.body}
                  onChange={onChange}
                  onSaveRequest={() => void save()}
                  onImagePaste={onImagePaste}
                  assetBase={assetBase}
                  onScroll={setScroll}
                  ref={(h) => (handle = h)}
                />
                <Show when={showPreview()}>
                  <Preview
                    views={views()}
                    ms={previewMs()}
                    loading={previewing()}
                    error={previewErr()}
                    assetBase={assetBase()}
                    publishedLabel={publishedLabel()}
                    {...(bookLine() !== "" ? { bookLine: bookLine() } : {})}
                    realUrl={`/${src.postPath}/`}
                    scroll={scroll()}
                    onClose={() => setShowPreview(false)}
                    onRefresh={() => void refreshPreview()}
                  />
                </Show>
              </div>
            </>
          );
        }}
      </Show>

      <Show when={dialog()}>
        {(req) => (
          <ImageNameDialog
            request={req()}
            onConfirm={(r) => resolveDialog?.(r)}
            onCancel={() => resolveDialog?.(null)}
          />
        )}
      </Show>
    </div>
  );
}
