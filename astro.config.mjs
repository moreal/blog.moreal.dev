import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://blog.moreal.dev",
  outDir: "public_html",
  integrations: [solid()],
  vite: {
    // @seonbi/node is a napi native addon; it must be require()d at runtime,
    // never bundled (rolldown would try to parse the .node binary as JS).
    optimizeDeps: { exclude: ["@seonbi/node"] },
    ssr: { external: ["@seonbi/node"] },
  },
});
