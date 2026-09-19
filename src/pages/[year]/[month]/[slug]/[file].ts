import type { APIContext } from "astro";
import { promises as fs } from "node:fs";
import { assetContentType } from "../../../../lib/asset-content-type";
import { createPostPageRenderer } from "../../../../lib/post-page";
import {
  getAssets,
  getPost,
  getPosts,
  viewFilename,
  type Post,
  type PostAsset,
} from "../../../../lib/posts";

type ViewProps = { kind: "view"; path: string; lang: string };
type AssetProps = { kind: "asset"; sourcePath: string };
type Props = ViewProps | AssetProps;

// The bare post URL, e.g. /2026/03/botkit/, is served by ../[slug].astro.
function languageViewRoutes(posts: Post[]) {
  return posts
    .filter((post) => post.multiview)
    .flatMap((post) =>
      post.views.map((view) => ({
        params: {
          year: post.year,
          month: post.month,
          slug: post.slug,
          file: viewFilename(view.lang),
        },
        props: { kind: "view", path: post.path, lang: view.lang } as Props,
      })),
    );
}

function assetRoutes(assets: PostAsset[]) {
  return assets.map((asset) => ({
    params: {
      year: asset.year,
      month: asset.month,
      slug: asset.slug,
      file: asset.file,
    },
    props: { kind: "asset", sourcePath: asset.sourcePath } as Props,
  }));
}

export async function getStaticPaths() {
  return [
    ...languageViewRoutes(await getPosts()),
    ...assetRoutes(await getAssets()),
  ];
}

async function assetResponse({ sourcePath }: AssetProps): Promise<Response> {
  const body = await fs.readFile(sourcePath);
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": assetContentType(sourcePath) },
  });
}

async function languageViewResponse({ path, lang }: ViewProps): Promise<Response> {
  const post = await getPost(path);
  const view = post.views.find((candidate) => candidate.lang === lang);
  if (view === undefined) {
    throw new Error(`No ${lang} view for ${path}`);
  }
  const renderPostPage = await createPostPageRenderer();
  const html = await renderPostPage(post, view);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET({ props }: APIContext<Props>) {
  return props.kind === "asset" ? assetResponse(props) : languageViewResponse(props);
}
