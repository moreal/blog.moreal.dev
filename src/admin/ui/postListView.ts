import type { PostGroup } from "../lib/types.ts";
import { kstYear } from "../shared/dates.ts";

export type PostFilter = "all" | "daily" | "reading" | "draft" | "asset";

export function matchesFilter(group: PostGroup, filter: PostFilter): boolean {
  if (filter === "all") return true;
  if (filter === "asset") return group.assetDir !== null;
  if (filter === "draft") return group.sources.some((source) => source.draft);
  return group.sources.some((source) => source.type === filter);
}

function searchableText(group: PostGroup): string {
  return (
    group.postPath +
    " " +
    group.sources.map((source) => `${source.title} ${source.description ?? ""} ${source.lang}`).join(" ")
  ).toLowerCase();
}

export function matchesQuery(group: PostGroup, lowercaseQuery: string): boolean {
  return lowercaseQuery === "" || searchableText(group).includes(lowercaseQuery);
}

export function firstListedPublished(group: PostGroup): string {
  return group.sources[0]?.published ?? "";
}

export function groupsByPublishedYear(groups: PostGroup[]): [year: string, groups: PostGroup[]][] {
  const years = new Map<string, PostGroup[]>();
  for (const group of groups) {
    const year = kstYear(firstListedPublished(group));
    const list = years.get(year);
    if (list === undefined) years.set(year, [group]);
    else list.push(group);
  }
  return [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export function sourceCount(groups: PostGroup[]): number {
  return groups.reduce((count, group) => count + group.sources.length, 0);
}
