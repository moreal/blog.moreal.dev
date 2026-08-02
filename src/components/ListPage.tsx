import type { Post, PostView } from "../lib/posts";
import { kstDate, viewFilename } from "../lib/posts";
import { SITE } from "../lib/site";

export type ListTab = "all" | "daily" | "reading";

interface Props {
  posts: Post[];
  tab?: ListTab;
}

const TABS: { tab: ListTab; href: string; label: string }[] = [
  { tab: "all", href: "/", label: "전체" },
  { tab: "daily", href: "/daily/", label: "일상" },
  { tab: "reading", href: "/reading/", label: "독후감" },
];

interface ListItem {
  href: string;
  view: PostView;
}

// The list shows the ko-Hang view of each post, excluding drafts.  Multiview
// posts link straight to their ko-Hang view file instead of the language
// negotiation page, matching the jikji build.
function collectItems(posts: Post[], tab: ListTab): ListItem[] {
  const items: ListItem[] = [];
  for (const post of posts) {
    const view = post.views.find((v) => v.lang === "ko-Hang");
    if (view === undefined || view.draft) continue;
    // The main list carries regular posts and reading notes; daily notes appear
    // only under their own tab so they don't crowd it out.
    const matches = tab === "all" ? view.type !== "daily" : view.type === tab;
    if (!matches) continue;
    items.push({
      href: post.multiview
        ? `/${post.path}/${viewFilename(view.lang)}`
        : `/${post.path}/`,
      view,
    });
  }
  return items;
}

function groupByYear(items: ListItem[]): [number, ListItem[]][] {
  const byYear = new Map<number, ListItem[]>();
  for (const item of items) {
    const { year } = kstDate(item.view.published);
    byYear.set(year, [...(byYear.get(year) ?? []), item]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  return years.map((year) => {
    const group = byYear.get(year)!;
    group.sort((a, b) => {
      const dateCompare = b.view.published.getTime() -
        a.view.published.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.view.title.localeCompare(b.view.title);
    });
    return [year, group];
  });
}

export default function ListPage(props: Props) {
  const tab = props.tab ?? "all";
  const label = TABS.find((t) => t.tab === tab)!.label;
  const groups = groupByYear(collectItems(props.posts, tab));
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{tab === "all" ? SITE.title : `${label} — ${SITE.title}`}</title>
        <link rel="shortcut icon" href="/static/logo.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/static/style.css" />
        <meta name="description" content={SITE.description} />
        <meta name="author" content={SITE.author} />
        <meta name="fediverse:creator" content={SITE.fediverseCreator} />
        {SITE.relMe.map((url) => <link rel="me" href={url} />)}
      </head>
      <body class="list">
        <header>
          <h1>{SITE.title}</h1>
          <nav class="tab-nav">
            {TABS.map((t) =>
              t.tab === tab
                ? (
                  <span class="tab-current" aria-current="page">
                    {t.label}
                  </span>
                )
                : <a href={t.href}>{t.label}</a>
            )}
          </nav>
        </header>
        <main>
          {groups.length === 0 && <p class="empty">아직 글이 없습니다.</p>}
          {groups.map(([year, items]) => (
            <section class="year-section">
              <h2>
                <time datetime={String(year)}>{year}</time>
              </h2>
              <ul>
                {items.map(({ href, view }) => {
                  const { month, day } = kstDate(view.published);
                  return (
                    <li>
                      <a href={href}>{view.title}</a>
                      <time datetime={view.published.toISOString()}>
                        {month}월 {day}일
                      </time>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </main>
        <footer>
          <p>&copy; 2025 moreal</p>
        </footer>
      </body>
    </html>
  );
}
