import { NIGHT_INIT, NIGHT_TOGGLE } from "../lib/night";
import {
  darkPostCount,
  koreanPostCount,
  listItems,
  yearSections,
  type ListTab,
} from "../lib/post-list";
import type { Post } from "../lib/posts";
import { kstDate } from "../lib/posts";
import { SITE } from "../lib/site";
import AuthorMeta from "./AuthorMeta";

interface Props {
  posts: Post[];
  tab?: ListTab;
}

const TABS: { tab: ListTab; href: string; label: string }[] = [
  { tab: "all", href: "/", label: "전체" },
  { tab: "daily", href: "/daily/", label: "일상" },
  { tab: "reading", href: "/reading/", label: "독후감" },
];

export default function ListPage(props: Props) {
  const tab = props.tab ?? "all";
  const label = TABS.find((tabLink) => tabLink.tab === tab)!.label;
  const items = listItems(props.posts, tab);
  const sections = yearSections(items);
  const darkCount = darkPostCount(items);
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
        <AuthorMeta />
      </head>
      <body class="list">
        <header>
          <h1>{SITE.title}</h1>
          <nav class="tab-nav">
            {TABS.map((tabLink) =>
              tabLink.tab === tab
                ? (
                  <span class="tab-current" aria-current="page">
                    {tabLink.label}
                  </span>
                )
                : <a href={tabLink.href}>{tabLink.label}</a>
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
              어둠 속에서 글 {koreanPostCount(darkCount)}이 눈을 떴습니다.
            </p>
          )}
        </header>
        <main>
          {sections.length === 0 && <p class="empty">아직 글이 없습니다.</p>}
          {sections.map(({ year, nightOnly, entries }) => (
            <section class={nightOnly ? "year-section night-only" : "year-section"}>
              <h2>
                <time datetime={String(year)}>{year}</time>
              </h2>
              <ul>
                {entries.map(({ href, view, bloomStep }) => {
                  const { month, day } = kstDate(view.published);
                  return (
                    <li
                      class={view.dark ? "dark-post" : undefined}
                      style={bloomStep !== undefined
                        ? { "--i": String(bloomStep) }
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
