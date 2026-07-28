import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ta" | "si";

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  ta: "தமிழ்",
  si: "සිංහල",
};

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

const ta: Dict = {
  "nav.dashboard": "முகப்பு",
  "nav.contributors": "பங்களிப்பாளர்கள்",
  "nav.help": "உதவி",
  "nav.preferences": "விருப்பங்கள்",
  "nav.admin": "நிர்வாகி",
  "nav.adminSignIn": "நிர்வாகி உள்நுழைவு",
  "nav.menu": "பட்டியல்",
  "nav.search": "தேடு",
  "admin.overview": "மேலோட்டம்",
  "admin.materials": "பாட உபகரணங்கள்",
  "admin.kuppi": "குப்பி வீடியோக்கள்",
  "admin.deadlines": "காலக்கெடுக்கள்",
  "admin.moduleRequests": "பாட கோரிக்கைகள்",
  "admin.studentRequests": "மாணவர் கோரிக்கைகள்",
  "admin.feedback": "கருத்து",
  "admin.guide": "வழிகாட்டி",
  "admin.profile": "சுயவிவரம்",
  "admin.signOut": "வெளியேறு",
  "admin.currentSemester": "தற்போதைய செமஸ்டர்",
  "admin.selectSemester": "செமஸ்டரைத் தேர்ந்தெடுக்கவும்",
  "admin.super": "தலைமை நிர்வாகி",
  "admin.role": "நிர்வாகி",
  "admin.noSemesterTitle": "செமஸ்டர் ஒதுக்கப்படவில்லை",
  "admin.noSemesterBody": "உங்களுக்கு இன்னும் செமஸ்டர் ஒதுக்கப்படவில்லை. தலைமை நிர்வாகியிடம் கேளுங்கள்.",
  "admin.backHome": "முகப்புக்கு",
  "super.overview": "மேலோட்டம்",
  "super.notifications": "அறிவிப்புகள்",
  "super.semesters": "செமஸ்டர்கள்",
  "super.subjects": "பாடங்கள்",
  "super.moduleRequests": "பாட கோரிக்கைகள்",
  "super.admins": "நிர்வாகிகள்",
  "super.users": "அனைத்து கணக்குகள்",
  "super.materials": "பாட உபகரணங்கள்",
  "super.deadlines": "காலக்கெடுக்கள்",
  "super.requests": "கோரிக்கைகள்",
  "super.pending": "நிலுவை மாற்றங்கள்",
  "super.feedback": "கருத்து",
  "super.analytics": "பகுப்பாய்வு",
  "super.activity": "செயல்பாட்டுப் பதிவு",
  "super.authSettings": "அங்கீகார அமைப்புகள்",
  "super.profile": "உங்கள் சுயவிவரம்",
  "super.title": "தலைமை நிர்வாகி",
  "super.accessRequired": "தலைமை நிர்வாகி அணுகல் தேவை",
  "super.noPermission": "இந்த பக்கத்தை பார்க்க உங்களுக்கு அனுமதி இல்லை.",
  "common.language": "மொழி",
  "common.signedOut": "வெளியேறியது",
};

const si: Dict = {
  "nav.dashboard": "පාලනය",
  "nav.contributors": "දායකයන්",
  "nav.help": "උදව්",
  "nav.preferences": "අභිරුචි",
  "nav.admin": "පරිපාලක",
  "nav.adminSignIn": "පරිපාලක පිවිසුම",
  "nav.menu": "මෙනුව",
  "nav.search": "සොයන්න",
  "admin.overview": "දළ විශ්ලේෂණය",
  "admin.materials": "ඉගැන්වීම් ද්‍රව්‍ය",
  "admin.kuppi": "කුප්පි වීඩියෝ",
  "admin.deadlines": "අවසන් දින",
  "admin.moduleRequests": "විෂය ඉල්ලීම්",
  "admin.studentRequests": "සිසු ඉල්ලීම්",
  "admin.feedback": "ප්‍රතිචාර",
  "admin.guide": "මාර්ගෝපදේශය",
  "admin.profile": "පැතිකඩ",
  "admin.signOut": "පිටවෙන්න",
  "admin.currentSemester": "වත්මන් සමයේ",
  "admin.selectSemester": "සමයක් තෝරන්න",
  "admin.super": "ප්‍රධාන පරිපාලක",
  "admin.role": "පරිපාලක",
  "admin.noSemesterTitle": "සමයක් පවරා නැත",
  "admin.noSemesterBody": "ඔබට තවම සමයක් පවරා නැත. ප්‍රධාන පරිපාලකයෙකුගෙන් ඉල්ලන්න.",
  "admin.backHome": "මුල් පිටුවට",
  "super.overview": "දළ විශ්ලේෂණය",
  "super.notifications": "දැනුම්දීම්",
  "super.semesters": "සමයන්",
  "super.subjects": "විෂයන්",
  "super.moduleRequests": "විෂය ඉල්ලීම්",
  "super.admins": "පරිපාලකයන්",
  "super.users": "සියලු ගිණුම්",
  "super.materials": "ඉගැන්වීම් ද්‍රව්‍ය",
  "super.deadlines": "අවසන් දින",
  "super.requests": "ඉල්ලීම්",
  "super.pending": "පොරොත්තු වෙනස්කම්",
  "super.feedback": "ප්‍රතිචාර",
  "super.analytics": "විශ්ලේෂණ",
  "super.activity": "ක්‍රියාකාරකම් ලොගය",
  "super.authSettings": "අනන්‍යතා සැකසුම්",
  "super.profile": "ඔබේ පැතිකඩ",
  "super.title": "ප්‍රධාන පරිපාලක",
  "super.accessRequired": "ප්‍රධාන පරිපාලක පිවිසුම අවශ්‍යයි",
  "super.noPermission": "මෙම පිටුව බැලීමට ඔබට අවසර නැත.",
  "common.language": "භාෂාව",
  "common.signedOut": "පිටව ගියා",
};

const DICTS: Record<Lang, Dict> = { en, ta, si };

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
