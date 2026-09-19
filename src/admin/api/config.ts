import type { APIRoute } from "astro";
import { ADMIN_CONFIG } from "../config.ts";
import { clientConfig } from "../lib/client-config.ts";
import { checkRequest, json } from "../lib/guard.ts";
import type { ConfigResponse } from "../lib/types.ts";

export const prerender = false;

export const GET: APIRoute = ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;
  return json({ ok: true, ...clientConfig(ADMIN_CONFIG) } satisfies ConfigResponse);
};
