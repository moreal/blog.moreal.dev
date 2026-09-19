import { Show, createResource, createSignal, onCleanup, onMount } from "solid-js";
import type {
  FrontMatterForm as Form,
  SaveResponse,
} from "../lib/types.ts";
import EditorCodeMirror from "./EditorCodeMirror.tsx";
import EditorTextarea from "./EditorTextarea.tsx";
import FrontMatterForm from "./FrontMatterForm.tsx";
import ImageNameDialog from "./ImageNameDialog.tsx";
import { createImagePaste } from "./imagePaste.ts";
import { createPublishedPreview } from "./publishedPreview.ts";
import Preview from "./Preview.tsx";
import { LANG_LABEL, api } from "./api.ts";
import { nowKstIso } from "../shared/dates.ts";
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

  const [scroll, setScroll] = createSignal(0);

  let handle: EditorHandle | undefined;

  const images = createImagePaste(loaded, setWarning);
  const publishedPreview = createPublishedPreview(loaded, fm, body);

  const publishedAssetBase = () => {
    const src = loaded();
    return src ? `/${src.postPath}/` : "";
  };

  let sourceSeeded = false;
  const seedEditorStateOnce = () => {
    const src = loaded();
    if (src === undefined || src === null || sourceSeeded) return;
    sourceSeeded = true;
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
    const saveFromAnyFocusedControl = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", saveFromAnyFocusedControl);
    onCleanup(() => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", saveFromAnyFocusedControl);
    });
  });

  function onChange(next: string) {
    setBody(next);
    setDirty(true);
    setStatus("");
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
      handle?.replaceAll(data.body);
      setBody(data.body);
      setDirty(false);
      localStorage.removeItem(DRAFT_PREFIX + file);
      setStatus(data.formatted ? "저장됨 · hongdown 적용" : "저장됨");
      if (data.formatterWarning !== undefined) setWarning(data.formatterWarning);
      else if (data.formatterNotices !== undefined) {
        setWarning(`hongdown: ${data.formatterNotices}`);
      }
      if (publishedPreview.visible()) void publishedPreview.refresh();
    } catch (e) {
      setStatus("");
      setWarning(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
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
          seedEditorStateOnce();
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
                  <button class={publishedPreview.visible() ? "primary" : ""} onClick={publishedPreview.toggle}>
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
                nowIso={() => nowKstIso()}
              />

              <div class="editor-main" classList={{ split: publishedPreview.visible() }}>
                <Surface
                  value={src.body}
                  onChange={onChange}
                  onSaveRequest={() => void save()}
                  onImagePaste={images.paste}
                  assetBase={publishedAssetBase}
                  onScroll={setScroll}
                  ref={(h) => (handle = h)}
                />
                <Show when={publishedPreview.visible()}>
                  <Preview
                    views={publishedPreview.views()}
                    ms={publishedPreview.elapsedMs()}
                    loading={publishedPreview.loading()}
                    error={publishedPreview.error()}
                    realUrl={`/${src.postPath}/`}
                    scroll={scroll()}
                    onClose={publishedPreview.close}
                    onRefresh={() => void publishedPreview.refresh()}
                  />
                </Show>
              </div>
            </>
          );
        }}
      </Show>

      <Show when={images.dialog()}>
        {(req) => (
          <ImageNameDialog
            request={req()}
            onConfirm={images.confirmName}
            onCancel={images.cancelName}
          />
        )}
      </Show>
    </div>
  );
}
