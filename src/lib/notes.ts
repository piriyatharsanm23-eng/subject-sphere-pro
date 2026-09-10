/**
 * Study Notes helpers — web-based markdown notes that live alongside the
 * existing PDF materials (Resources). Notes are plain markdown text in the
 * database; no files are stored for them.
 */

export type StudyNote = {
  id: string;
  semester_id: string;
  subject_id: string;
  material_id: string | null;
  title: string;
  slug: string;
  chapter: string | null;
  description: string | null;
  content: string;
  order_index: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

/** URL-friendly slug: "Complex Analysis" -> "complex-analysis". */
export function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type TocItem = { id: string; text: string; level: number };

/**
 * Builds the "On this page" list from the markdown headings (## and ###).
 * The ids match what the renderer puts on the heading elements.
 */
export function extractToc(markdown: string): TocItem[] {
  const lines = (markdown ?? "").split("\n");
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  let inFence = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[#*`_$]/g, "").trim();
    if (!text) continue;
    let id = slugify(text) || "section";
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count) id = `${id}-${count}`;
    items.push({ id, text, level });
  }
  return items;
}

/** Same id algorithm as extractToc, kept in sync for heading anchors. */
export function createHeadingIdFactory() {
  const seen = new Map<string, number>();
  return (text: string) => {
    let id = slugify(text) || "section";
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    return count ? `${id}-${count}` : id;
  };
}

export function nodeText(children: unknown): string {
  if (children == null || children === false) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(nodeText).join("");
  const props = (children as { props?: { children?: unknown } }).props;
  return props ? nodeText(props.children) : "";
}

export function readingTime(markdown: string): number {
  const words = (markdown ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
