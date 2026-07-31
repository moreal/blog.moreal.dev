import type { Post } from "../lib/posts";
import { viewFilename } from "../lib/posts";
import { LANG_LABELS } from "../lib/site";

interface Props {
  post: Post;
}

function negotiationScript(multiViews: Record<string, string>): string {
  return `
    const multiViews = ${JSON.stringify(multiViews)};
    (function () {
      function parseTag(tag) {
        const [language, ...rest] = tag.toLowerCase().split(/[-_]/);
        const script = rest.length > 0 && rest[0].length === 4
          ? rest[0]
          : undefined;
        const region = rest.length > 0 && rest[0].length === 2
          ? rest[0]
          : rest.length > 1
          ? rest[1]
          : undefined;
        return { language, script, region };
      }
      function preferability(accept, view) {
        return (accept.language === view.language ? 16 : 0) +
          (accept.script === view.script ? 8 : 0) +
          (accept.script == null ? 4 : 0) +
          (accept.region === view.region ? 2 : 0) +
          (accept.region == null ? 1 : 0);
      }
      const cookie = document.cookie
        .match(/(?:^|;)\\s*accept-language=([A-Za-z0-9_-]+)\\s*(?:;|$)/)?.[1];
      if (cookie != null) {
        for (const lang in multiViews) {
          if (lang.toLowerCase() === cookie.toLowerCase()) {
            location.href = multiViews[lang];
            return;
          }
        }
      }
      const acceptLanguages = navigator.languages ??
        (navigator.language != null ? [navigator.language] : []);
      const views = Object.entries(multiViews)
        .map(([tag, url]) => [parseTag(tag), url]);
      for (const acceptLanguage of acceptLanguages) {
        const accept = parseTag(acceptLanguage);
        let maxPreferability = 0;
        let mostPreferredUrl;
        for (const [view, url] of views) {
          const p = preferability(accept, view);
          if (p > maxPreferability) {
            maxPreferability = p;
            mostPreferredUrl = url;
          }
        }
        if (maxPreferability >= 16 && mostPreferredUrl != null) {
          location.href = mostPreferredUrl;
          return;
        }
      }
    })();
  `;
}

export default function Redirector(props: Props) {
  const { post } = props;
  const multiViews = Object.fromEntries(
    post.views.map((v) => [v.lang, `/${post.path}/${viewFilename(v.lang)}`]),
  );
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Redirecting...</title>
        {post.views.map((v) => (
          <link rel="alternate" href={multiViews[v.lang]} hreflang={v.lang} />
        ))}
        <script innerHTML={negotiationScript(multiViews)} />
      </head>
      <body>
        <p>There are the following languages available:</p>
        <ul>
          {post.views.map((v) => (
            <li>
              <a rel="alternate" href={multiViews[v.lang]} hreflang={v.lang}>
                {LANG_LABELS[v.lang] ?? v.lang}
              </a>
            </li>
          ))}
        </ul>
      </body>
    </html>
  );
}
