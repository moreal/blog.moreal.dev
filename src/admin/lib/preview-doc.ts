import { createPostPageRenderer, type PostPageRenderer } from "../../lib/post-page.ts";
import type { PostFileRef } from "./paths.ts";
import { previewPost, siblingViewLangs, withBaseHref } from "./preview-post.ts";
import { renderBuffer } from "./render.ts";
import type { RenderedView } from "./types.ts";

let postPageRendererOfDevServer: Promise<PostPageRenderer> | undefined;

export async function renderPreviewDocument(
  ref: PostFileRef,
  source: string,
): Promise<RenderedView[]> {
  const bufferViews = renderBuffer(source, ref.lang);
  const post = previewPost(ref, bufferViews, await siblingViewLangs(ref));

  postPageRendererOfDevServer ??= createPostPageRenderer();
  const renderPostPage = await postPageRendererOfDevServer;
  const rendered: RenderedView[] = [];
  for (const view of bufferViews) {
    rendered.push({
      lang: view.lang,
      title: view.title,
      document: withBaseHref(await renderPostPage(post, view), ref.postPath),
    });
  }
  return rendered;
}
