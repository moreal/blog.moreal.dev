import { NIGHT_INIT, NIGHT_VEIL } from "../lib/night";
import type { BookInfo, Post, PostView as PostViewData } from "../lib/posts";
import { kstDate, viewFilename } from "../lib/posts";
import { LANG_LABELS, SITE } from "../lib/site";

interface Props {
  post: Post;
  view: PostViewData;
}

function bookLine(book: BookInfo): string {
  return [
    book.author,
    book.translator && `${book.translator} 옮김`,
    book.publisher,
    book.year !== undefined ? String(book.year) : undefined,
  ].filter((part): part is string => typeof part === "string").join(" · ");
}

export default function PostView(props: Props) {
  const { post, view } = props;
  const published = kstDate(view.published);
  const fullTitle = `${view.title} — ${SITE.title}`;
  return (
    <html lang={view.lang.split("-")[0]}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script innerHTML={NIGHT_INIT} />
        <title>{fullTitle}</title>
        <link rel="stylesheet" href="/static/style.css" />
        <link rel="shortcut icon" href="/static/logo.svg" type="image/svg+xml" />
        <meta name="description" content={view.description || "블로그 포스트"} />
        <meta name="og:title" content={fullTitle} />
        <meta name="author" content={SITE.author} />
        <meta name="fediverse:creator" content={SITE.fediverseCreator} />
        {SITE.relMe.map((url) => <link rel="me" href={url} />)}
      </head>
      <body class={view.dark ? "post dark-story" : "post"}>
        <header class="post-header">
          {/* Daily notes are absent from the main list, so send readers
              back to their own tab instead. */}
          <a
            href={view.type === "daily" ? "/daily/" : "/"}
            class="back-link"
          >
            다른 글 보기
          </a>
          {post.multiview && (
            <nav class="lang-nav">
              {post.views.map((v) =>
                v.lang === view.lang
                  ? (
                    <span class="lang-current">
                      {LANG_LABELS[v.lang] ?? v.lang}
                    </span>
                  )
                  : (
                    <a href={`/${post.path}/${viewFilename(v.lang)}`}>
                      {LANG_LABELS[v.lang] ?? v.lang}
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
