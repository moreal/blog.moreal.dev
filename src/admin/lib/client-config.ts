import type { AdminConfig } from "../config.ts";
import { LANGS } from "../shared/post-files.ts";
import type { ClientConfig } from "./types.ts";

export function clientConfig(config: AdminConfig): ClientConfig {
  return {
    imageNamePattern: config.imageNamePattern,
    imageTypes: config.imageTypes,
    maxImageBytes: config.maxImageBytes,
    formatOnSave: config.formatOnSave,
    editorEngine: config.editorEngine,
    langs: LANGS,
  };
}
