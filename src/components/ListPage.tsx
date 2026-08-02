import { NIGHT_INIT, NIGHT_TOGGLE } from "../lib/night";
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

// Native Korean numerals read better than digits for the handful of dark
// posts the night note counts.
const KO_NUMERALS = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];

function koCount(n: number): string {
  return n < KO_NUMERALS.length ? `${KO_NUMERALS[n]} 편` : `${n}편`;
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
  const items = collectItems(props.posts, tab);
  const groups = groupByYear(items);
  const darkCount = items.filter((item) => item.view.dark).length;
  // Render-order index of each dark post, driving the staggered bloom when
  // the lights go off; capped so a long tail still arrives together.
  let darkIndex = 0;
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script innerHTML={NIGHT_INIT} />
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
            {darkCount > 0 && (
              <button type="button" class="night-toggle">
                <span class="day-label">불 끄기</span>
                <span class="night-label">불 켜기</span>
              </button>
            )}
          </nav>
          {darkCount > 0 && (
            <p class="night-note">
              어둠 속에서 글 {koCount(darkCount)}이 눈을 떴습니다.
            </p>
          )}
        </header>
        <main>
          {groups.length === 0 && <p class="empty">아직 글이 없습니다.</p>}
          {groups.map(([year, items]) => (
            <section
              class={items.every(({ view }) => view.dark)
                // A year whose posts are all dark surfaces only at night;
                // otherwise its bare heading would linger in the daylight.
                ? "year-section night-only"
                : "year-section"}
            >
              <h2>
                <time datetime={String(year)}>{year}</time>
              </h2>
              <ul>
                {items.map(({ href, view }) => {
                  const { month, day } = kstDate(view.published);
                  return (
                    <li
                      class={view.dark ? "dark-post" : undefined}
                      style={view.dark
                        ? { "--i": String(Math.min(darkIndex++, 8)) }
                        : undefined}
                    >
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
        {darkCount > 0 && <script innerHTML={NIGHT_TOGGLE} />}
      </body>
    </html>
  );
}
