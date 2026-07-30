import { format, formatDistanceToNow, isValid } from "date-fns";

const TZ = "Asia/Colombo";

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
}

/** e.g. "12 Mar 2025" */
export function formatDate(value: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(value);
  return d ? format(d, "d MMM yyyy") : fallback;
}

/** e.g. "12 Mar 2025, 4:30 PM" */
export function formatDateTime(value: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(value);
  return d ? format(d, "d MMM yyyy, h:mm a") : fallback;
}

/** e.g. "3 days ago" */
export function formatRelative(value: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : fallback;
}

/** Locale-stable deadline label in Sri Lanka time. */
export function formatInColombo(value: string | number | Date | null | undefined, fallback = "—") {
  const d = toDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** e.g. "1.4 MB" */
export function formatBytes(bytes: number | null | undefined, fallback = "—") {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return fallback;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** Truncates the middle of a long filename so the extension stays visible. */
export function truncateFileName(name: string, max = 38) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const base = dot > 0 ? name.slice(0, dot) : name;
  const keep = Math.max(6, max - ext.length - 1);
  return `${base.slice(0, keep)}…${ext}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
