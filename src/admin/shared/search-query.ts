const MIN_QUERY_LENGTH = 2;

export function isSearchableQuery(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}
