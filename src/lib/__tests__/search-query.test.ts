import { describe, expect, it } from "vitest";
import { buildSearchFilters, MAX_SEARCH_LENGTH, sanitizeSearchTerm } from "../search-query";

/**
 * Regression suite for the global-search filter-injection fix.
 * Each payload below previously could have escaped the intended filter.
 */
const PAYLOADS = [
  // Classic SQL injection
  "' OR 1=1 --",
  '" OR "1"="1',
  "'; DROP TABLE materials; --",
  "1; DELETE FROM profiles",
  "admin'--",
  "' UNION SELECT id, email FROM profiles --",
  "1' AND (SELECT 1 FROM pg_sleep(5))--",
  "/* comment */ OR 1=1",
  "0x27 OR 1=1",
  "%' OR full_name IS NOT NULL --",
  // PostgREST-specific filter injection
  "a,id.gt.0",
  "x,or(id.gt.0)",
  "y),id.neq.null,(",
  "*",
  "name.ilike.*,email.ilike.*",
  "a,not.and(id.gt.0)",
  "id.gte.0&select=*",
  "a&apikey=leaked",
  "id=eq.1",
  // Wildcard abuse / enumeration
  "%",
  "_",
  "%%%",
  "____",
];

describe("sanitizeSearchTerm", () => {
  it.each(PAYLOADS)("neutralises payload: %s", (payload) => {
    const safe = sanitizeSearchTerm(payload);
    // Only letters, digits, spaces and hyphens may survive.
    expect(safe).toMatch(/^[\p{L}\p{N} -]*$/u);
    expect(safe).not.toContain("--");
    expect(safe.length).toBeLessThanOrEqual(MAX_SEARCH_LENGTH);
  });

  it("keeps legitimate search text usable", () => {
    expect(sanitizeSearchTerm("fault analysis")).toBe("fault analysis");
    expect(sanitizeSearchTerm("  EE2201  ")).toBe("EE2201");
    expect(sanitizeSearchTerm("past paper 2023")).toBe("past paper 2023");
    expect(sanitizeSearchTerm("தமிழ் குறிப்பு")).toBe("தமிழ் குறிப்பு");
  });

  it("collapses whitespace left behind by stripped characters", () => {
    expect(sanitizeSearchTerm("a,,,b")).toBe("a b");
    expect(sanitizeSearchTerm("   ")).toBe("");
  });

  it("caps absurdly long input", () => {
    expect(sanitizeSearchTerm("a".repeat(5000))).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("handles empty and nullish input safely", () => {
    expect(sanitizeSearchTerm("")).toBe("");
    expect(sanitizeSearchTerm(undefined as unknown as string)).toBe("");
  });
});

describe("buildSearchFilters", () => {
  it.each(PAYLOADS)("emits exactly two conditions per or-filter for: %s", (payload) => {
    const { subjectsOr, materialsOr } = buildSearchFilters(payload);

    for (const filter of [subjectsOr, materialsOr]) {
      const parts = filter.split(",");
      expect(parts).toHaveLength(2);
      // Every condition must still be a plain ilike on the expected column.
      for (const part of parts) {
        // Either the empty-term fallback ("%") or a plain wrapped term.
        expect(part).toMatch(/^(name|code|title|year)\.ilike\.(%|%[\p{L}\p{N} -]+%)$/u);
      }
    }
  });

  it("never lets a payload widen the match to everything", () => {
    // A raw "%" or "*" term would match every row; sanitising leaves an empty
    // term, which intentionally falls back to the same "%" the empty query uses.
    expect(buildSearchFilters("%").like).toBe("%");
    expect(buildSearchFilters("fault").like).toBe("%fault%");
  });

  it("does not inject extra query parameters", () => {
    const { subjectsOr } = buildSearchFilters("a&apikey=leaked&select=*");
    expect(subjectsOr).not.toContain("&");
    expect(subjectsOr).not.toContain("=");
  });
});
