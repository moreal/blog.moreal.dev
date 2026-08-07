import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import adminCms from "./src/admin/integration.ts";

export default defineConfig({
  site: "https://blog.moreal.dev",
  outDir: "public_html",
  // adminCms() injects nothing outside `astro dev`; see src/admin/integration.ts.
  integrations: [solid(), adminCms()],
  vite: {
    // @seonbi/node is a napi native addon; it must be require()d at runtime,
    // never bundled (rolldown would try to parse the .node binary as JS).
    optimizeDeps: { exclude: ["@seonbi/node"] },
    ssr: { external: ["@seonbi/node"] },
  },
});
