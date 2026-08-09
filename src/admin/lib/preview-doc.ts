import solidRenderer from "@astrojs/solid-js/server.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { promises as fs } from "node:fs";
import path from "node:path";
import PostViewPage from "../../components/PostViewPage.astro";
import type { Post, PostView } from "../../lib/posts.ts";
import { sortPostViews } from "../../lib/posts.ts";
import { CONTENT_ROOT, LANGS, type PostFileRef } from "./paths.ts";
import { renderBuffer } from "./render.ts";
import type { Lang, RenderedView } from "./types.ts";

/**
 * Renders an unsaved buffer into the same complete HTML documents the published
 * pages are.  Not a lookalike and not a subset: this runs PostView.tsx through
 * the Container API exactly as src/pages/[year]/[month]/[slug]/[file].ts does,
 * so the preview carries the real stylesheet, header, language nav and night
 * veil rather than an admin-side reimplementation of them.
 */

// Creating a container spins up a renderer registry; nothing about it depends
// on the request, so one is enough for the lifetime of the dev server.
let container: Promise<AstroContainer> | undefined;

function getContainer(): Promise<AstroContainer> {
  container ??= (async () => {
    const created = await AstroContainer.create();
    created.addServerRenderer({
      name: "@astrojs/solid-js",
      renderer: solidRenderer,
    });
    return created;
  })();
  return container;
}

const POST_FILE_NAME = /^(.+)\.(ko-Hang|ko-Kore|en)\.md$/;

/**
 * Languages the post has *other* source files for.  A ko-Hang buffer whose post
 * also has an .en.md ships with a language nav, and the preview should show it;
 * only the sibling's language matters here, never its text.
 */
async function siblingLangs(ref: PostFileRef): Promise<Lang[]> {
  const dir = path.join(CONTENT_ROOT, ref.year, ref.month);
  const self = path.basename(ref.rel);
  const langs: Lang[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    // A buffer for a month directory that does not exist yet has no siblings.
    return langs;
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.name === self) continue;
    const m = POST_FILE_NAME.exec(entry.name);
    if (m === null || m[1] !== ref.slug) continue;
    const lang = m[2] as Lang;
    langs.push(lang);
    // A ko-Kore source contributes its derived ko-Hang view too.
    if (lang === "ko-Kore") langs.push("ko-Hang");
  }
  return langs.filter((l) => LANGS.includes(l));
}

/**
 * Inserted into the iframe document rather than applied by rewriting each
 * <img src>: the preview is its own document now, so `./image.png` can resolve
 * against the post's real URL the way it will once published.  Absolute URLs
 * (/static/style.css, the back link, the language nav) are unaffected.
 */
function withBase(html: string, postPath: string): string {
  const base = `<base href="/${postPath}/">`;
  const injected = html.replace(/<head(\s[^>]*)?>/i, (head) => head + base);
  if (injected === html) {
    console.warn("preview: no <head> to anchor relative asset paths to.");
  }
  return injected;
}

export async function renderPreviewDocument(
  ref: PostFileRef,
  source: string,
): Promise<RenderedView[]> {
  const views = renderBuffer(source, ref.lang);
  const primary = views[0];
  if (primary === undefined) throw new Error("the buffer rendered no views.");

  // Stubs, because only `lang` is read when PostView builds the language nav;
  // their text lives in sibling files this buffer says nothing about.
  const stubs: PostView[] = (await siblingLangs(ref)).map((lang) => ({
    ...primary,
    lang,
    html: "",
  }));
  const all = [...views, ...stubs];
  sortPostViews(all);

  const post: Post = {
    path: ref.postPath,
    year: ref.year,
    month: ref.month,
    slug: ref.slug,
    views: all,
    multiview: all.length > 1,
  };

  const astro = await getContainer();
  const rendered: RenderedView[] = [];
  for (const view of views) {
    const html = await astro.renderToString(PostViewPage, {
      props: { post, view },
      partial: false,
    });
    rendered.push({
      lang: view.lang,
      title: view.title,
      document: withBase(html, ref.postPath),
    });
  }
  return rendered;
}
