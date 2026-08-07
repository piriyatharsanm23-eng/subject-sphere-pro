/**
 * Search term hardening for PostgREST queries.
 *
 * PostgREST filter strings (used by `.or(...)`) are a mini query language:
 * commas separate conditions, dots separate column/operator/value, and
 * parentheses group logic. Interpolating raw user input there lets a crafted
 * term rewrite the query (a filter-injection). `%`, `_` and `*` are LIKE
 * wildcards and are stripped so a term cannot turn into a broad match.
 *
 * Keep every search input flowing through `sanitizeSearchTerm` /
 * `buildSearchFilters`; see src/lib/__tests__/search-query.test.ts.
 */

/**
 * Allowlist, not blocklist: only letters (any script), digits, spaces and
 * hyphens survive. Everything else — quotes, commas, dots, parentheses,
 * wildcards, `&`, `=`, `;` — is replaced with a space.
 */
const UNSAFE = /[^\p{L}\p{N} -]/gu;

export const MAX_SEARCH_LENGTH = 80;

/** Strips every character that could alter a PostgREST filter string. */
export function sanitizeSearchTerm(input: string): string {
  return (input ?? "")
    .replace(UNSAFE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .trim();
}

/** Builds the LIKE pattern and `.or(...)` filter strings used by global search. */
export function buildSearchFilters(input: string) {
  const term = sanitizeSearchTerm(input);
  const like = term ? `%${term}%` : "%";
  return {
    term,
    like,
    subjectsOr: `name.ilike.${like},code.ilike.${like}`,
    materialsOr: `title.ilike.${like},year.ilike.${like}`,
  };
}
