import { NIGHT_INIT, NIGHT_VEIL } from "../lib/night";
import { backLinkHref, bookLine, descriptionOf, primaryLanguage } from "../lib/post-view";
import type { Post, PostView as PostViewData } from "../lib/posts";
import { kstDate, viewUrl } from "../lib/posts";
import { SITE, languageLabel } from "../lib/site";
import AuthorMeta from "./AuthorMeta";

interface Props {
  post: Post;
  view: PostViewData;
}

export default function PostView(props: Props) {
  const { post, view } = props;
  const published = kstDate(view.published);
  const fullTitle = `${view.title} — ${SITE.title}`;
  return (
    <html lang={primaryLanguage(view.lang)}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script innerHTML={NIGHT_INIT} />
        <title>{fullTitle}</title>
        <link rel="stylesheet" href="/static/style.css" />
        <link rel="shortcut icon" href="/static/logo.svg" type="image/svg+xml" />
        <meta name="description" content={descriptionOf(view)} />
        <meta name="og:title" content={fullTitle} />
        <AuthorMeta />
      </head>
      <body class={view.dark ? "post dark-story" : "post"}>
        <header class="post-header">
          <a href={backLinkHref(view)} class="back-link">
            다른 글 보기
          </a>
          {post.multiview && (
            <nav class="lang-nav">
              {post.views.map((otherView) =>
                otherView.lang === view.lang
                  ? (
                    <span class="lang-current">
                      {languageLabel(otherView.lang)}
                    </span>
                  )
                  : (
                    <a href={viewUrl(post.path, otherView.lang)}>
                      {languageLabel(otherView.lang)}
                    </a>
                  )
              )}
            </nav>
          )}
          <time datetime={view.published.toISOString()} class="publish-date">
            {published.year}년 {published.month}월 {published.day}일
          </time>
        </header>
        <main>
          {view.type === "reading" && view.book && (
            <p class="book-info">
              {view.book.title && <cite>{view.book.title}</cite>}
              {bookLine(view.book)}
            </p>
          )}
          <article innerHTML={view.html} />
        </main>
        {view.dark && (
          <div class="night-veil">
            <div class="veil-card">
              <p>이 글에는 조금 어두운 이야기가 담겨 있습니다.</p>
              <button type="button">불 끄고 읽기</button>
            </div>
          </div>
        )}
        {view.dark && <script innerHTML={NIGHT_VEIL} />}
      </body>
    </html>
  );
}
