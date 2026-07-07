// Kuppi (peer-recorded revision session) helpers.
export const KUPPI_MEDIUMS = [
  { value: "sinhala", label: "සිංහල / Sinhala", short: "සිං" },
  { value: "tamil", label: "தமிழ் / Tamil", short: "தமி" },
  { value: "english", label: "English", short: "EN" },
] as const;

export type KuppiMedium = typeof KUPPI_MEDIUMS[number]["value"];

export function mediumLabel(m: string) {
  return KUPPI_MEDIUMS.find((x) => x.value === m)?.label ?? m;
}

export function mediumShort(m: string) {
  return KUPPI_MEDIUMS.find((x) => x.value === m)?.short ?? m;
}

/** Best-effort YouTube embed URL. Returns null when not YouTube. */
export function toYoutubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") {
        const v = u.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}`;
      }
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
    return null;
  } catch {
    return null;
  }
}
