import type { PostGroup, SearchHit } from "./types.ts";

const EXCERPT_CONTEXT = 48;

export const MAX_SEARCH_HITS = 60;

function excerptAroundMatch(line: string, matchAt: number, matchLength: number): string {
  const start = Math.max(0, matchAt - EXCERPT_CONTEXT);
  const end = matchAt + matchLength + EXCERPT_CONTEXT;
  return (start > 0 ? "…" : "") + line.slice(start, end).trim() +
    (end < line.length ? "…" : "");
}

export function findSourceMatches(source: string, lowercaseQuery: string): {
  line: number;
  excerpt: string;
  count: number;
} | null {
  let firstMatch: { line: number; excerpt: string } | undefined;
  let matchingLines = 0;
  for (const [index, line] of source.split("\n").entries()) {
    const matchAt = line.toLowerCase().indexOf(lowercaseQuery);
    if (matchAt === -1) continue;
    matchingLines++;
    firstMatch ??= {
      line: index + 1,
      excerpt: excerptAroundMatch(line, matchAt, lowercaseQuery.length),
    };
  }
  return firstMatch ? { ...firstMatch, count: matchingLines } : null;
}

function mostMatchesFirst(hits: SearchHit[]): SearchHit[] {
  return hits.sort((a, b) => b.count - a.count);
}

export async function searchSources(
  groups: PostGroup[],
  lowercaseQuery: string,
  readSource: (file: string) => Promise<string | null>,
  maxHits: number = MAX_SEARCH_HITS,
): Promise<{ hits: SearchHit[]; truncated: boolean }> {
  const hits: SearchHit[] = [];
  for (const source of groups.flatMap((group) => group.sources)) {
    const text = await readSource(source.file);
    if (text === null) continue;
    const matches = findSourceMatches(text, lowercaseQuery);
    if (matches === null) continue;
    if (hits.length >= maxHits) return { hits: mostMatchesFirst(hits), truncated: true };
    hits.push({
      file: source.file,
      postPath: source.postPath,
      lang: source.lang,
      title: source.title || source.slug,
      ...matches,
    });
  }
  return { hits: mostMatchesFirst(hits), truncated: false };
}
