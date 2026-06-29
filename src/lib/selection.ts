// Local storage helpers for the public student's semester + subject selection.
const KEY = "studyhub.selection.v1";

export interface Selection {
  semesterId: string;
  subjectIds: string[];
}

export function getSelection(): Selection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Selection;
    if (!parsed.semesterId || !Array.isArray(parsed.subjectIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSelection(s: Selection) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSelection() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
