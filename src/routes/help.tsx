import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Send,
  MessageCircle,
  Download,
  BookOpen,
  Search,
  Layers,
  GraduationCap,
  CalendarClock,
  Mail,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const TELEGRAM_BOT_URL = "https://t.me/StudyGeniusX_bot";
const TELEGRAM_BOT_HANDLE = "@StudyGeniusX_bot";
const SUPPORT_EMAIL = "piriyatharsan2611@gmail.com";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & guide — StudyHub" },
      {
        name: "description",
        content:
          "Learn how to enroll, browse subjects, download materials via our Telegram bot and use StudyHub efficiently.",
      },
      { property: "og:title", content: "Help & guide — StudyHub" },
      {
        property: "og:description",
        content:
          "Enrollment, Telegram bot downloads and tips to use StudyHub more efficiently.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60 bg-hero">
          <div className="pointer-events-none absolute -top-32 -left-24 h-[400px] w-[400px] rounded-full bg-emerald-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-24 h-[380px] w-[380px] rounded-full bg-teal-400/20 blur-3xl" />
          <div className="relative container mx-auto px-4 sm:px-6 py-14 sm:py-20 max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <span>Help centre</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              How to use{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-200">
                StudyHub
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-white/75">
              Everything you need — enrollment, browsing, downloading via Telegram, and tips to
              get the most out of the site.
            </p>
          </div>
        </section>

        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 max-w-5xl grid gap-10">
          {/* Enrollment */}
          <Card
            icon={<GraduationCap className="h-5 w-5" />}
            eyebrow="Getting started"
            title="Enroll in your dashboard"
          >
            <Steps
              items={[
                {
                  title: "Open the Dashboard",
                  desc: "Click Dashboard in the top menu. No account is required to browse.",
                },
                {
                  title: "Choose your semester",
                  desc: "Pick the semester you're currently studying from the Preferences screen.",
                },
                {
                  title: "Select your subjects",
                  desc: "Tick every subject you take this semester so your dashboard shows only what matters to you.",
                },
                {
                  title: "Save your selection",
                  desc: "Hit Save. Your choices are stored on this device — no login needed.",
                },
              ]}
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="sm">
                <Link to="/select">
                  Set my preferences <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            </div>
          </Card>

          {/* Telegram bot */}
          <Card
            icon={<Send className="h-5 w-5" />}
            eyebrow="Downloads"
            title="Download materials via our Telegram bot"
            accent
          >
            <p className="text-sm text-muted-foreground">
              The <strong>{TELEGRAM_BOT_HANDLE}</strong> bot mirrors every uploaded material and
              deadline so you can grab notes, past papers, tutorials and PDFs straight to your
              phone — with ChatGPT / Gemini shortcuts on every file.
            </p>

            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                First-time setup
              </div>
              <Steps
                items={[
                  {
                    title: "Open the bot and press Start",
                    desc: `Tap the button below (or search ${TELEGRAM_BOT_HANDLE} on Telegram) and send /start. A main menu with buttons appears.`,
                  },
                  {
                    title: "Enroll — pick your semester",
                    desc: "Tap 📚 Enroll / Change Subjects (or send /enroll). Pick your current semester from the buttons.",
                  },
                  {
                    title: "Tap subjects to enroll",
                    desc: "Toggle each subject you take this semester (✅ = enrolled). Use ✅ Enroll All if you want every subject, then press ✔️ Done.",
                  },
                ]}
              />
            </div>

            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Download materials (any time after enrolling)
              </div>
              <Steps
                items={[
                  {
                    title: "Send /download or /materials",
                    desc: "The bot shows only your enrolled subjects — no need to pick a semester again.",
                  },
                  {
                    title: "Pick a subject → pick a category",
                    desc: "Choose 📘 Lecture Slides, 📝 Notes, 📄 Past Papers, 📌 Tutorials / Assignments, or ⏰ Deadlines.",
                  },
                  {
                    title: "Tap a material",
                    desc: "The bot sends the PDF right into the chat with buttons: ⬇️ Download PDF, 🌐 Open in Website, 🤖 Open in ChatGPT, ✨ Open in Gemini.",
                  },
                  {
                    title: "Ask AI to teach it",
                    desc: "🤖 ChatGPT and ✨ Gemini open a new chat pre-filled with a full study prompt. Attach the PDF and press send — the AI walks you through the material.",
                  },
                ]}
              />
            </div>

            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                All commands
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <CmdRow cmd="/start" desc="Main menu with buttons" />
                <CmdRow cmd="/download" desc="Download materials (same as /materials)" />
                <CmdRow cmd="/materials" desc="Download materials" />
                <CmdRow cmd="/enroll" desc="Enroll in subjects (buttons)" />
                <CmdRow cmd="/change_subjects" desc="Change your enrolled subjects" />
                <CmdRow cmd="/my_subjects" desc="Show your enrolled subjects" />
                <CmdRow cmd="/deadlines" desc="Upcoming deadlines for your subjects" />
                <CmdRow cmd="/stop" desc="Unsubscribe (send /start to resume)" />
                <CmdRow cmd="/help" desc="Show help inside Telegram" />
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm">
              <div className="font-semibold mb-1">🔔 Auto reminders</div>
              <p className="text-muted-foreground">
                Once enrolled, the bot sends deadline reminders 7 days, 2 days, 1 day before, and
                on the due day — only for your subjects.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="sm" className="bg-sky-500 hover:bg-sky-500/90 text-white">
                <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer">
                  <Send className="mr-2 h-4 w-4" /> Open {TELEGRAM_BOT_HANDLE}
                </a>
              </Button>
              <code className="rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs">
                {TELEGRAM_BOT_URL}
              </code>
            </div>
          </Card>

          {/* Efficiency tips */}
          <Card
            icon={<Sparkles className="h-5 w-5" />}
            eyebrow="Pro tips"
            title="Use the website more efficiently"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tip
                icon={<Search className="h-4 w-4" />}
                title="Global search"
                desc="Press ⌘K / Ctrl+K anywhere to jump to a subject, material or deadline in seconds."
              />
              <Tip
                icon={<CalendarClock className="h-4 w-4" />}
                title="Watch urgent deadlines"
                desc="The dashboard highlights deadlines due in the next 72 hours in red — check daily."
              />
              <Tip
                icon={<Layers className="h-4 w-4" />}
                title="Follow recent uploads"
                desc="The home page shows the freshest materials so you never miss a new lecture."
              />
              <Tip
                icon={<BookOpen className="h-4 w-4" />}
                title="Bookmark a subject"
                desc="Save the subject page as a browser bookmark for one-tap access to all its materials."
              />
              <Tip
                icon={<Download className="h-4 w-4" />}
                title="Prefer downloads for offline"
                desc="Download PDFs before class — Wi-Fi in the hall is unreliable."
              />
              <Tip
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Reliable & no login"
                desc="Browsing is anonymous. Only admins log in to upload — your usage stays private."
              />
            </div>
          </Card>

          {/* Support */}
          <Card
            icon={<MessageCircle className="h-5 w-5" />}
            eyebrow="Support"
            title="Still need help?"
          >
            <p className="text-sm text-muted-foreground">
              Missing a material, spotted a broken link, or want to become a contributor? Reach
              out — we usually reply within a day.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition-all"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Email support
                  </div>
                  <div className="font-medium truncate group-hover:text-primary transition-colors">
                    {SUPPORT_EMAIL}
                  </div>
                </div>
              </a>
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition-all"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-500">
                  <Send className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Telegram bot
                  </div>
                  <div className="font-medium truncate group-hover:text-primary transition-colors">
                    {TELEGRAM_BOT_URL.replace("https://", "")}
                  </div>
                </div>
              </a>
            </div>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({
  icon,
  eyebrow,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-6 sm:p-8 shadow-soft ${
        accent
          ? "border-sky-500/30 bg-gradient-to-br from-sky-500/5 via-card to-card"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${
            accent ? "bg-sky-500/15 text-sky-500" : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold tabular-nums">
            {i + 1}
          </div>
          <div className="min-w-0">
            <div className="font-medium">{s.title}</div>
            <div className="text-sm text-muted-foreground">{s.desc}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tip({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-medium text-sm">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          {title}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function CmdRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-primary shrink-0">
        {cmd}
      </code>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </div>
  );
}
