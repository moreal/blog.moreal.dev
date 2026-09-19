import { createSignal, type Accessor } from "solid-js";
import type { LoadedSource } from "./api.ts";
import type { ImageNameRequest, ImageNameResult } from "./ImageNameDialog.tsx";

type ImageNameSuggestion = Omit<ImageNameRequest, "preview">;
type ImageFailure = { ok: false; message: string };
type ImageNameResponse = ({ ok: true } & ImageNameSuggestion) | ImageFailure;
type ImageUploadResponse = { ok: true; markdown: string } | ImageFailure;

async function requestImageName(mdFile: string, file: File): Promise<ImageNameResponse> {
  const params = new URLSearchParams({
    mdFile,
    mime: file.type,
    ...(file.name !== "" ? { originalName: file.name } : {}),
  });
  const response = await fetch(`/admin/api/image-name?${params}`);
  return response.json();
}

async function uploadImage(
  mdFile: string,
  file: File,
  choice: ImageNameResult,
): Promise<ImageUploadResponse> {
  const body = new FormData();
  body.set("file", file);
  body.set("mdFile", mdFile);
  body.set("name", choice.name);
  body.set("overwrite", String(choice.overwrite));
  const response = await fetch("/admin/api/image", { method: "POST", body });
  return response.json();
}

export function createImagePaste(
  source: Accessor<LoadedSource | null | undefined>,
  warn: (message: string) => void,
) {
  const [dialog, setDialog] = createSignal<ImageNameRequest | null>(null);
  let resolveDialog: ((r: ImageNameResult | null) => void) | undefined;

  async function chooseImageName(
    file: File,
    suggestion: ImageNameSuggestion,
  ): Promise<ImageNameResult | null> {
    const objectUrl = URL.createObjectURL(file);
    const choice = await new Promise<ImageNameResult | null>((resolve) => {
      resolveDialog = resolve;
      setDialog({
        suggestion: suggestion.suggestion,
        ext: suggestion.ext,
        dir: suggestion.dir,
        existing: suggestion.existing,
        preview: objectUrl,
      });
    });
    setDialog(null);
    URL.revokeObjectURL(objectUrl);
    return choice;
  }

  async function paste(files: File[]): Promise<string | null> {
    const src = source();
    if (src === undefined || src === null) return null;
    const inserted: string[] = [];
    for (const file of files) {
      const suggestion = await requestImageName(src.file, file);
      if (!suggestion.ok) {
        warn(suggestion.message);
        continue;
      }
      const choice = await chooseImageName(file, suggestion);
      if (choice === null) continue;
      const saved = await uploadImage(src.file, file, choice);
      if (!saved.ok) {
        warn(saved.message);
        continue;
      }
      inserted.push(saved.markdown);
    }
    return inserted.length === 0 ? null : inserted.join("\n\n");
  }

  return {
    dialog,
    paste,
    confirmName: (result: ImageNameResult) => resolveDialog?.(result),
    cancelName: () => resolveDialog?.(null),
  };
}
