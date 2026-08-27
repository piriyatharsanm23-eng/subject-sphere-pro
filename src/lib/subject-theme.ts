export const SUBJECT_CARD_THEMES = [
  "subject-card-indigo",
  "subject-card-violet",
  "subject-card-fuchsia",
  "subject-card-rose",
  "subject-card-amber",
  "subject-card-emerald",
  "subject-card-sky",
  "subject-card-teal",
] as const;

export type SubjectCardTheme = (typeof SUBJECT_CARD_THEMES)[number];

export function subjectThemeClass(id: string): SubjectCardTheme {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_CARD_THEMES[hash % SUBJECT_CARD_THEMES.length];
}
