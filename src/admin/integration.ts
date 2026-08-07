import type { AstroIntegration } from "astro";

const API_ROUTES = [
  "posts",
  "source",
  "save",
  "create",
  "image",
  "image-name",
  "preview",
  "search",
  "config",
] as const;

/**
 * A CMS for editing this blog's posts, served only by `astro dev`.
 *
 * Nothing here reaches production.  `astro build` never injects a route, so
 * `settings.buildOutput` is never flipped to "server" and the adapterless
 * build keeps working; the admin files live outside `src/pages/` so Astro's
 * file-based router cannot pick them up either.  Note that gating a route with
 * `export const prerender = import.meta.env.DEV` would NOT work: Astro detects
 * that export by matching a regular expression against the source text, so the
 * expression is never evaluated and the route silently stays prerendered.
 *
 * Set ASTRO_ADMIN=0 to run `astro dev` without it.
 */
export default function adminCms(): AstroIntegration {
  return {
    name: "blog-admin-cms",
    hooks: {
      "astro:config:setup"({ command, config, injectRoute, logger }) {
        if (command !== "dev") return;
        if (process.env["ASTRO_ADMIN"] === "0") return;

        // Resolved against config.root rather than import.meta.url, which is
        // stable whether astro.config.mjs was loaded natively or through
        // Vite's module runner.
        const admin = new URL("src/admin/", config.root);

        injectRoute({
          pattern: "/admin",
          entrypoint: new URL("pages/index.astro", admin),
        });
        injectRoute({
          pattern: "/admin/edit",
          entrypoint: new URL("pages/edit.astro", admin),
        });
        injectRoute({
          pattern: "/admin/new",
          entrypoint: new URL("pages/new.astro", admin),
        });
        injectRoute({
          pattern: "/admin/ime-test",
          entrypoint: new URL("pages/ime-test.astro", admin),
        });

        for (const name of API_ROUTES) {
          injectRoute({
            // Static patterns only: a dynamic injected route would be run
            // through getStaticPaths validation and throw.
            pattern: `/admin/api/${name}`,
            entrypoint: new URL(`api/${name}.ts`, admin),
            prerender: false,
          });
        }

        if (config.server.host !== false) {
          logger.warn(
            "server.host is set: the CMS is reachable from the local network.",
          );
        }
        logger.info("CMS: http://localhost:4321/admin");
      },

      // Nothing above runs during a build, so nothing here should ever fire.
      // It exists because "verified once" is not the same as "cannot regress":
      // a stray import from a site page would otherwise ship the CMS silently.
      async "astro:build:done"({ dir, pages, logger }) {
        const leaked = pages
          .map((p) => p.pathname)
          .filter((p) => p.startsWith("admin") || p.startsWith("__admin"));
        if (leaked.length > 0) {
          throw new Error(
            `admin routes reached the build output: ${leaked.join(", ")}`,
          );
        }

        const { promises: fs } = await import("node:fs");
        const { fileURLToPath } = await import("node:url");
        const root = fileURLToPath(dir);
        const MARKERS = ["/admin/api/", "src/admin/"];
        const hits: string[] = [];
        const walk = async (abs: string): Promise<void> => {
          for (const e of await fs.readdir(abs, { withFileTypes: true })) {
            const child = `${abs}/${e.name}`;
            if (e.isDirectory()) {
              await walk(child);
            } else if (/\.(html|js|css|json|xml)$/.test(e.name)) {
              const text = await fs.readFile(child, "utf-8");
              if (MARKERS.some((m) => text.includes(m))) {
                hits.push(child.slice(root.length));
              }
            }
          }
        };
        await walk(root);
        if (hits.length > 0) {
          throw new Error(
            `admin code reached the build output: ${hits.join(", ")}`,
          );
        }
        logger.info("no admin code in the build output");
      },

      // No asset middleware: `astro dev` already serves a post's sibling
      // directory at its real URL through src/pages/[year]/[month]/[slug]/[file].ts,
      // and it picks up newly written files immediately -- measured, including
      // a fetch issued in the same millisecond as the write, and overwrites.
      // So the preview loads images from exactly the URL the published page
      // will use.
    },
  };
}
