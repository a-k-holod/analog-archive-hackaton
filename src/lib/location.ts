/**
 * Lightweight, deterministic location normalization.
 * Preserves locality names; only normalizes whitespace and known country codes.
 * The original photographer-entered string should remain stored separately.
 */

const COUNTRY_CODES: Record<string, string> = {
  pl: "Poland",
  de: "Germany",
  fr: "France",
  es: "Spain",
  it: "Italy",
  pt: "Portugal",
  nl: "Netherlands",
  be: "Belgium",
  at: "Austria",
  ch: "Switzerland",
  cz: "Czechia",
  sk: "Slovakia",
  ua: "Ukraine",
  lt: "Lithuania",
  lv: "Latvia",
  ee: "Estonia",
  se: "Sweden",
  no: "Norway",
  dk: "Denmark",
  fi: "Finland",
  ie: "Ireland",
  gb: "United Kingdom",
  uk: "United Kingdom",
  us: "United States",
  ca: "Canada",
  jp: "Japan",
  kr: "South Korea",
  au: "Australia",
  nz: "New Zealand",
};

/** Canonical country names we may encounter already expanded (for spacing/consistency only). */
const COUNTRY_NAMES = new Set(Object.values(COUNTRY_CODES).map((name) => name.toLowerCase()));

/**
 * Normalize a free-text location for grouping/comparison.
 * Returns "" for empty/undefined input.
 */
export function normalizeLocation(input: string | null | undefined): string {
  if (input == null) {
    return "";
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const parts = trimmed
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "";
  }

  const lastIndex = parts.length - 1;
  const last = parts[lastIndex];
  const lastKey = last.toLowerCase();

  if (COUNTRY_CODES[lastKey]) {
    parts[lastIndex] = COUNTRY_CODES[lastKey];
  } else if (COUNTRY_NAMES.has(lastKey)) {
    // Keep the canonical casing from our map when the full name was typed with odd case.
    const canonical = [...COUNTRY_NAMES].find((name) => name === lastKey);
    if (canonical) {
      const entry = Object.values(COUNTRY_CODES).find((name) => name.toLowerCase() === canonical);
      if (entry) {
        parts[lastIndex] = entry;
      }
    }
  }

  return parts.join(", ");
}

/** True when two location strings refer to the same normalized place string. */
export function locationsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeLocation(a);
  const right = normalizeLocation(b);
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  return left === right;
}
