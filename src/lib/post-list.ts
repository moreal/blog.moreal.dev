import { kstDate, viewUrl, type Post, type PostView } from "./posts.ts";

export type ListTab = "all" | "daily" | "reading";

export interface ListItem {
  href: string;
  view: PostView;
}

export interface ListEntry extends ListItem {
  /** Order in which a dark post blooms when the lights go off. */
  bloomStep: number | undefined;
}

export interface YearSection {
  year: number;
  nightOnly: boolean;
  entries: ListEntry[];
}

const LISTED_LANG = "ko-Hang";

const LAST_BLOOM_STEP = 8;

const NATIVE_KOREAN_COUNTS = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];

function listedView(post: Post): PostView | undefined {
  const view = post.views.find((candidate) => candidate.lang === LISTED_LANG);
  return view === undefined || view.draft ? undefined : view;
}

function belongsToTab(view: PostView, tab: ListTab): boolean {
  return tab === "all" ? view.type !== "daily" : view.type === tab;
}

function listHref(post: Post, view: PostView): string {
  return post.multiview ? viewUrl(post.path, view.lang) : `/${post.path}/`;
}

export function listItems(posts: Post[], tab: ListTab): ListItem[] {
  const items: ListItem[] = [];
  for (const post of posts) {
    const view = listedView(post);
    if (view === undefined || !belongsToTab(view, tab)) continue;
    items.push({ href: listHref(post, view), view });
  }
  return items;
}

function newestFirstThenByTitle(a: ListItem, b: ListItem): number {
  const dateCompare = b.view.published.getTime() - a.view.published.getTime();
  if (dateCompare !== 0) return dateCompare;
  return a.view.title.localeCompare(b.view.title);
}

function itemsByYear(items: ListItem[]): [number, ListItem[]][] {
  const byYear = new Map<number, ListItem[]>();
  for (const item of items) {
    const { year } = kstDate(item.view.published);
    byYear.set(year, [...(byYear.get(year) ?? []), item]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  return years.map((year) => [year, byYear.get(year)!.sort(newestFirstThenByTitle)]);
}

export function yearSections(items: ListItem[]): YearSection[] {
  let darkPostsBefore = 0;
  const bloomStepOf = (item: ListItem): number | undefined =>
    item.view.dark ? Math.min(darkPostsBefore++, LAST_BLOOM_STEP) : undefined;
  return itemsByYear(items).map(([year, yearItems]) => ({
    year,
    nightOnly: yearItems.every(({ view }) => view.dark),
    entries: yearItems.map((item) => ({ ...item, bloomStep: bloomStepOf(item) })),
  }));
}

export function darkPostCount(items: ListItem[]): number {
  return items.filter((item) => item.view.dark).length;
}

export function koreanPostCount(count: number): string {
  return count < NATIVE_KOREAN_COUNTS.length ? `${NATIVE_KOREAN_COUNTS[count]} 편` : `${count}편`;
}
