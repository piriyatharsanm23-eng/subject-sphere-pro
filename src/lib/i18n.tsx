import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en";

export const LANG_LABELS: Record<Lang, string> = { en: "English" };

type Dict = Record<string, string>;

const en: Dict = {
  // Nav (public)
  "nav.dashboard": "Dashboard",
  "nav.contributors": "Contributors",
  "nav.help": "Help",
  "nav.preferences": "Preferences",
  "nav.admin": "Admin",
  "nav.adminSignIn": "Admin sign in",
  "nav.menu": "Menu",
  "nav.search": "Search",
  // Admin nav
  "admin.overview": "Overview",
  "admin.materials": "Materials",
  "admin.kuppi": "Kuppi videos",
  "admin.deadlines": "Deadlines",
  "admin.moduleRequests": "Module requests",
  "admin.studentRequests": "Student requests",
  "admin.feedback": "Feedback",
  "admin.guide": "Guide",
  "admin.profile": "Profile",
  "admin.signOut": "Sign out",
  "admin.currentSemester": "Current semester",
  "admin.selectSemester": "Select semester",
  "admin.super": "Super admin",
  "admin.role": "Admin",
  "admin.noSemesterTitle": "No semester assigned",
  "admin.noSemesterBody": "You don't have an assigned semester yet. Ask a super admin to assign one.",
  "admin.backHome": "Back home",
  // Super nav
  "super.overview": "Overview",
  "super.notifications": "Notifications",
  "super.semesters": "Semesters",
  "super.subjects": "Subjects",
  "super.moduleRequests": "Module requests",
  "super.admins": "Admins",
  "super.users": "All accounts",
  "super.materials": "Materials",
  "super.deadlines": "Deadlines",
  "super.requests": "Requests",
  "super.pending": "Pending changes",
  "super.feedback": "Feedback",
  "super.analytics": "Analytics",
  "super.activity": "Activity Log",
  "super.authSettings": "Auth settings",
  "super.profile": "Your profile",
  "super.title": "Super Admin",
  "super.accessRequired": "Super Admin access required",
  "super.noPermission": "You don't have permission to view this page.",
  // Common
  "common.language": "Language",
  "common.signedOut": "Signed out",
};

const DICTS: Record<Lang, Dict> = { en };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k });

const STORAGE_KEY = "app.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && DICTS[saved]) setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };

  const t = (key: string) => DICTS[lang][key] ?? DICTS.en[key] ?? key;

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useT() {
  return useContext(LangCtx);
}
