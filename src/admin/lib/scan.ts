import { promises as fs } from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import title from "markdown-it-title";
import { readForm } from "./frontmatter.ts";
import { CONTENT_ROOT, LANGS } from "./paths.ts";
import type { Lang, PostAssetInfo, PostGroup, PostSourceSummary } from "./types.ts";

/**
 * Walks the content tree the way src/lib/posts.ts does, but stops at the source
 * text.  getPosts() is deliberately not reused here: it runs seonbi twice per
 * ko-Kore file just to build a list, and it throws on a malformed file, which
 * would blank the whole listing instead of flagging one row.
 */

const NAME = /^(.+)\.(ko-Hang|ko-Kore|en)\.md$/;

/** Titles only; no seonbi, so a ko-Kore row shows its Hanja as written. */
const md = MarkdownIt("commonmark").use(title);

function headingOf(body: string): string {
  const env: { title?: string } = {};
  md.render(body, env);
  return env.title ?? "";
}

async function summarize(
  rel: string,
  abs: string,
  year: string,
  month: string,
  slug: string,
  lang: Lang,
): Promise<PostSourceSummary> {
  const st = await fs.stat(abs);
  const base: PostSourceSummary = {
    file: rel,
    postPath: `${year}/${month}/${slug}`,
    year,
    month,
    slug,
    lang,
    title: "",
    published: "",
    publishedMs: 0,
    draft: false,
    dark: false,
    derivedLangs: lang === "ko-Kore" ? ["ko-Hang"] : [],
    bytes: st.size,
    mtimeMs: st.mtimeMs,
  };
  const source = await fs.readFile(abs, "utf-8");
  try {
    const form = readForm(source, rel);
    const body = source.slice(source.indexOf("\n---", 3) + 4);
    return {
      ...base,
      title: headingOf(body),
      published: form.published,
      publishedMs: new Date(form.published).getTime(),
      ...(form.description !== undefined
        ? { description: form.description }
        : {}),
      draft: form.draft === true,
      dark: form.dark === true,
      ...(form.type !== undefined ? { type: form.type } : {}),
      ...(form.book !== undefined ? { book: form.book } : {}),
    };
  } catch (e) {
    return { ...base, parseError: e instanceof Error ? e.message : String(e) };
  }
}

export async function scanPosts(): Promise<PostGroup[]> {
  const groups = new Map<string, PostGroup>();
  const assets = new Map<string, PostAssetInfo[]>();

  for (const yearEntry of await fs.readdir(CONTENT_ROOT, {
    withFileTypes: true,
  })) {
    if (!yearEntry.isDirectory() || !/^20\d\d$/.test(yearEntry.name)) continue;
    const year = yearEntry.name;
    const yearDir = path.join(CONTENT_ROOT, year);
    for (const monthEntry of await fs.readdir(yearDir, {
      withFileTypes: true,
    })) {
      if (!monthEntry.isDirectory() || monthEntry.name.startsWith(".")) continue;
      const month = monthEntry.name;
      const monthDir = path.join(yearDir, month);
      for (const entry of await fs.readdir(monthDir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;

        if (entry.isDirectory()) {
          // Sibling directory named after the bare slug; one bundle serves
          // every language variant of the post.
          const files: PostAssetInfo[] = [];
          for (const f of await fs.readdir(path.join(monthDir, entry.name), {
            withFileTypes: true,
          })) {
            if (!f.isFile() || f.name.startsWith(".")) continue;
            const st = await fs.stat(path.join(monthDir, entry.name, f.name));
            files.push({ file: f.name, bytes: st.size });
          }
          assets.set(`${year}/${month}/${entry.name}`, files);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

        const m = NAME.exec(entry.name);
        if (m === null) continue;
        const [, slug, lang] = m as unknown as [string, string, Lang];
        const rel = `${year}/${month}/${entry.name}`;
        const summary = await summarize(
          rel,
          path.join(monthDir, entry.name),
          year,
          month,
          slug,
          lang,
        );
        const postPath = `${year}/${month}/${slug}`;
        let group = groups.get(postPath);
        if (group === undefined) {
          group = {
            postPath,
            year,
            month,
            slug,
            sources: [],
            missingLangs: [],
            assetDir: null,
            assetCount: 0,
          };
          groups.set(postPath, group);
        }
        group.sources.push(summary);
      }
    }
  }

  const out = [...groups.values()];
  for (const g of out) {
    g.sources.sort((a, b) => a.lang.localeCompare(b.lang, "en"));
    const have = new Set(g.sources.map((s) => s.lang));
    g.missingLangs = LANGS.filter((l) => !have.has(l));
    const bundle = assets.get(g.postPath);
    if (bundle !== undefined) {
      g.assetDir = g.postPath;
      g.assetCount = bundle.length;
    }
  }
  out.sort(
    (a, b) =>
      (b.sources[0]?.publishedMs ?? 0) - (a.sources[0]?.publishedMs ?? 0),
  );
  return out;
}

export async function listAssets(postPath: string): Promise<PostAssetInfo[]> {
  const dir = path.join(CONTENT_ROOT, ...postPath.split("/"));
  try {
    const out: PostAssetInfo[] = [];
    for (const f of await fs.readdir(dir, { withFileTypes: true })) {
      if (!f.isFile() || f.name.startsWith(".")) continue;
      const st = await fs.stat(path.join(dir, f.name));
      out.push({ file: f.name, bytes: st.size });
    }
    return out;
  } catch {
    return [];
  }
}
