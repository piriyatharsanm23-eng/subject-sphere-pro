import { GraduationCap, Mail, HelpCircle, Send } from "lucide-react";

const TELEGRAM_BOT_URL = "https://t.me/StudyHub_Materials_Bot";
const SUPPORT_EMAIL = "piriyatharsan2611@gmail.com";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/50">
      <div className="container mx-auto px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-gradient"><GraduationCap className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-bold">StudyHub</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            One calm place for every lecture slide, past paper and deadline — built for students.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Quick links</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="/dashboard" className="hover:text-foreground transition">Dashboard</a></li>
            <li><a href="/select" className="hover:text-foreground transition">Change preferences</a></li>
            <li><a href="/help" className="hover:text-foreground transition inline-flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> Help & guide</a></li>
            <li><a href="/auth" className="hover:text-foreground transition">Admin sign in</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Support</h4>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-2">
            <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
          </a>
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-2">
            <Send className="h-4 w-4" /> Telegram bot
          </a>
          <p className="mt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} StudyHub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
