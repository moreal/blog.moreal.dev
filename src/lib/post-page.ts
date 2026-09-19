import solidRenderer from "@astrojs/solid-js/server.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import PostViewPage from "../components/PostViewPage.astro";
import type { Post, PostView } from "./posts.ts";

export type PostPageRenderer = (post: Post, view: PostView) => Promise<string>;

export async function createPostPageRenderer(): Promise<PostPageRenderer> {
  const container = await AstroContainer.create();
  container.addServerRenderer({
    name: "@astrojs/solid-js",
    renderer: solidRenderer,
  });
  return (post, view) =>
    container.renderToString(PostViewPage, {
      props: { post, view },
      partial: false,
    });
}
