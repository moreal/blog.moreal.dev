import type { AdminConfig } from "../config.ts";
import type { ClientConfig } from "./types.ts";

export function clientConfig(config: AdminConfig): ClientConfig {
  return {
    editorEngine: config.editorEngine,
  };
}
