const EXCERPT_CONTEXT = 48;

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
