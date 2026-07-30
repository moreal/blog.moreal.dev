import type { APIContext } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { promises as fs } from "node:fs";
import PostView from "../../../../components/PostView.astro";
import { getAssets, getPost, getPosts, viewFilename } from "../../../../lib/posts";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

type Props =
  | { kind: "view"; path: string; lang: string }
  | { kind: "asset"; sourcePath: string };

export async function getStaticPaths() {
  const paths = [];
  // Language-specific view files of multiview posts, e.g.
  // /2026/03/botkit/index.ko-hang.html.  The bare /2026/03/botkit/ URL is
  // handled by ../[slug].astro (a post page or a language redirector).
  for (const post of await getPosts()) {
    if (!post.multiview) continue;
    for (const view of post.views) {
      paths.push({
        params: {
          year: post.year,
          month: post.month,
          slug: post.slug,
          file: viewFilename(view.lang),
        },
        props: { kind: "view", path: post.path, lang: view.lang } as Props,
      });
    }
  }
  // Files sitting next to the posts (images etc.), copied to the same URL.
  for (const asset of await getAssets()) {
    paths.push({
      params: {
        year: asset.year,
        month: asset.month,
        slug: asset.slug,
        file: asset.file,
      },
      props: { kind: "asset", sourcePath: asset.sourcePath } as Props,
    });
  }
  return paths;
}

export async function GET({ props }: APIContext<Props>) {
  if (props.kind === "asset") {
    const body = await fs.readFile(props.sourcePath);
    const ext = props.sourcePath.slice(props.sourcePath.lastIndexOf("."));
    const type = CONTENT_TYPES[ext.toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": type },
    });
  }

  const post = await getPost(props.path);
  const view = post.views.find((v) => v.lang === props.lang);
  if (view === undefined) {
    throw new Error(`No ${props.lang} view for ${props.path}`);
  }
  const container = await AstroContainer.create();
  const html = await container.renderToString(PostView, {
    props: { post, view },
    partial: false,
  });
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
