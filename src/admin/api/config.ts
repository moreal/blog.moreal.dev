import type { APIRoute } from "astro";
import { ADMIN_CONFIG } from "../config.ts";
import { checkRequest, json } from "../lib/guard.ts";
import { LANGS } from "../lib/paths.ts";
import type { ConfigResponse } from "../lib/types.ts";

export const prerender = false;

export const GET: APIRoute = ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;
  // suggestImageName is a function and deliberately not serialised; the UI only
  // needs to describe the rule, not evaluate it.
  return json({
    ok: true,
    imageNamePattern: ADMIN_CONFIG.imageNamePattern,
    imageTypes: ADMIN_CONFIG.imageTypes,
    maxImageBytes: ADMIN_CONFIG.maxImageBytes,
    formatOnSave: ADMIN_CONFIG.formatOnSave,
    editorEngine: ADMIN_CONFIG.editorEngine,
    langs: LANGS,
  } satisfies ConfigResponse);
};
