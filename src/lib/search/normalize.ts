/** Lowercase, collapse whitespace, strip most punctuation for matching. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a query into searchable tokens; empty query → []. */
export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [];
  }

  return normalized.split(" ").filter((token) => token.length > 0);
}

/** True when haystack contains needle as a substring after normalization. */
export function textIncludes(haystack: string, needle: string): boolean {
  if (!needle) {
    return false;
  }
  return normalizeSearchText(haystack).includes(normalizeSearchText(needle));
}
