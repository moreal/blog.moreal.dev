import assert from "node:assert/strict";
import test from "node:test";
import { darkPostCount, koreanPostCount, listItems, yearSections, type ListItem } from "./post-list.ts";
import type { Post, PostView } from "./posts.ts";

function view(overrides: Partial<PostView> = {}): PostView {
  return {
    lang: "ko-Hang", html: "", title: "제목",
    published: new Date("2026-03-01T01:00:00Z"), draft: false, dark: false,
    ...overrides,
  };
}

function post(path: string, views: PostView[]): Post {
  const [year = "", month = "", slug = ""] = path.split("/");
  return { path, year, month, slug, views, multiview: views.length > 1 };
}

function item(overrides: Partial<PostView> = {}): ListItem {
  return { href: "/", view: view(overrides) };
}

test("the list shows each post's Korean view and skips drafts and posts without one", () => {
  const listed = view({ title: "listed" });
  const items = listItems([
    post("2026/01/a", [listed]),
    post("2026/01/b", [view({ draft: true })]),
    post("2026/01/c", [view({ lang: "en" })]),
  ], "all");
  assert.deepEqual(items, [{ href: "/2026/01/a/", view: listed }]);
});

test("a multiview post links straight to its Korean view instead of the language redirector", () => {
  const items = listItems([post("2026/03/botkit", [view({ lang: "ko-Kore" }), view()])], "all");
  assert.equal(items[0]?.href, "/2026/03/botkit/index.ko-hang.html");
});

test("daily notes appear only under their own tab, so they do not crowd the main list", () => {
  const posts = [
    post("2026/01/regular", [view()]),
    post("2026/01/daily", [view({ type: "daily" })]),
    post("2026/01/reading", [view({ type: "reading" })]),
  ];
  const hrefs = (tab: "all" | "daily" | "reading") => listItems(posts, tab).map((listed) => listed.href);
  assert.deepEqual(hrefs("all"), ["/2026/01/regular/", "/2026/01/reading/"]);
  assert.deepEqual(hrefs("daily"), ["/2026/01/daily/"]);
  assert.deepEqual(hrefs("reading"), ["/2026/01/reading/"]);
});

test("posts are grouped by their Seoul year, newest year and newest post first, then by title", () => {
  const newYearsEve = item({ title: "b", published: new Date("2025-12-31T15:00:00Z") });
  const sameTimeEarlierTitle = item({ title: "a", published: new Date("2025-12-31T15:00:00Z") });
  const later = item({ title: "c", published: new Date("2026-02-01T00:00:00Z") });
  const lastYear = item({ title: "d", published: new Date("2025-12-31T14:59:00Z") });
  const sections = yearSections([newYearsEve, lastYear, later, sameTimeEarlierTitle]);
  assert.deepEqual(
    sections.map(({ year, entries }) => [year, entries.map((entry) => entry.view.title)]),
    [[2026, ["c", "a", "b"]], [2025, ["d"]]],
  );
});

test("a year whose posts are all dark only surfaces at night, so its bare heading does not linger by day", () => {
  const sections = yearSections([
    item({ dark: true, published: new Date("2026-01-01T00:00:00Z") }),
    item({ dark: true, published: new Date("2024-06-01T00:00:00Z") }),
    item({ published: new Date("2024-01-01T00:00:00Z") }),
  ]);
  assert.deepEqual(sections.map(({ year, nightOnly }) => [year, nightOnly]), [[2026, true], [2024, false]]);
});

test("dark posts bloom in list order, and the long tail arrives together at the last step", () => {
  const items = Array.from({ length: 12 }, (_, index) =>
    item({ dark: index !== 1, published: new Date(Date.UTC(2026, 0, 31 - index)) }),
  );
  const steps = yearSections(items).flatMap((section) => section.entries.map((entry) => entry.bloomStep));
  assert.deepEqual(steps, [0, undefined, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8]);
});

test("the night note counts dark posts", () => {
  assert.equal(darkPostCount([item({ dark: true }), item(), item({ dark: true })]), 2);
});

test("a handful of dark posts is counted in native Korean numerals, and more in digits", () => {
  assert.equal(koreanPostCount(1), "한 편");
  assert.equal(koreanPostCount(9), "아홉 편");
  assert.equal(koreanPostCount(10), "10편");
});
