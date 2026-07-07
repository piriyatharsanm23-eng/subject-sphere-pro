import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Upload,
  CalendarClock,
  MessageSquare,
  BookPlus,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  LifeBuoy,
  Mail,
  Phone,
  ArrowRight,
  Video,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

const SUPPORT_EMAIL = "piriyatharsan2611@gmail.com";

export const Route = createFileRoute("/admin/guide")({
  head: () => ({ meta: [{ title: "Admin guide — StudyHub" }] }),
  component: () => (
    <AdminShell
      title="Admin guide"
      description="Everything you need to run your assigned semester efficiently and reliably."
    >
      {() => <Body />}
    </AdminShell>
  ),
});

function Body() {
  return (
    <div className="grid gap-6">
      {/* Intro */}
      <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
          <Sparkles className="h-3 w-3" /> Welcome, admin
        </div>
        <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight">
          Do your assigned work in 4 tabs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Your job is to keep your semester's <b>materials</b>, <b>deadlines</b> and{" "}
          <b>student requests</b> up to date. Every action is scoped to the semester
          currently selected in the sidebar switcher.
        </p>
      </section>

      {/* Section: Materials */}
      <Guide
        icon={<Upload className="h-5 w-5" />}
        title="Upload lecture materials"
        to="/admin/materials"
        steps={[
          "Open Materials → New material.",
          "Choose the subject, then pick the type: Notes, Past Paper, Assignment or Tutorial.",
          "Give it a clear title (e.g. 'Week 3 — Frequency response'), add a short description, then attach the PDF.",
          "Tick Year for past papers so students can filter easily.",
          "Save. It appears instantly on the public site and in the Telegram bot.",
        ]}
        tips={[
          "Use consistent titles across a subject — students scan, they don't read.",
          "Prefer PDFs under 20 MB. Scan images down to A4 300dpi before uploading.",
          "Archive an outdated slide instead of deleting — it keeps download history.",
        ]}
      />

      {/* Section: Deadlines */}
      <Guide
        icon={<CalendarClock className="h-5 w-5" />}
        title="Create and manage deadlines"
        to="/admin/deadlines"
        steps={[
          "Open Deadlines → New deadline.",
          "Pick the subject, add a title, description and the due date/time.",
          "Optionally attach a brief file (assignment sheet, rubric).",
          "Save — students see it on their dashboard and get urgency badges automatically.",
        ]}
        tips={[
          "Enter the deadline in the student's local time (Sri Lanka time).",
          "Mark deadlines Completed after the submission window closes so they drop off the urgent list.",
          "Group extensions as a new deadline — never edit the old one silently.",
        ]}
      />

      {/* Section: Kuppi videos */}
      <Guide
        icon={<Video className="h-5 w-5" />}
        title="Add a Kuppi (peer-led revision) video"
        to="/admin/kuppi"
        steps={[
          "Open Kuppi videos → New Kuppi.",
          "Pick the subject, add a clear title, and choose the medium — සිංහල, தமிழ் or English.",
          "Paste the YouTube, OneDrive or DMS link. YouTube links play inline; other links open in a new tab.",
          "Add the presenter's name (required). Add a photo URL if you have one — otherwise the initials appear.",
          "Write the sections covered (e.g. 'Chapter 3 §3.1 – 3.4') and a short description. Save.",
          "Students can filter Kuppi by Sinhala or Tamil on the subject page and watch inline.",
        ]}
        tips={[
          "Use the presenter's full name consistently — the Contributors page groups Kuppi history by presenter name.",
          "Keep titles short and specific to the topic covered, not just a week number.",
          "For OneDrive/DMS, make sure the share link works without sign-in.",
        ]}
      />



      {/* Section: Module requests */}
      <Guide
        icon={<BookPlus className="h-5 w-5" />}
        title="Request a new module (subject)"
        to="/admin/modules"
        steps={[
          "Open Module requests → Request module.",
          "Pick the semester the new module belongs to, add the module name, code and short description.",
          "Add a short reason so the super admin can decide quickly.",
          "Submit. The super admin reviews it and, once accepted, the subject is created automatically — you can immediately start uploading materials to it.",
        ]}
        tips={[
          "Use the official module code from your syllabus (e.g. EE3074).",
          "Requests you send are visible in the same page with their status.",
          "If it's urgent, mention it in the reason.",
        ]}
      />

      {/* Section: Student requests */}
      <Guide
        icon={<MessageSquare className="h-5 w-5" />}
        title="Handle student requests"
        to="/admin/requests"
        steps={[
          "Open Student requests.",
          "Read the ask, then either upload the missing material or reply with a note.",
          "Mark the request Resolved when done — the student sees the status change.",
        ]}
        tips={[
          "Try to reply within 48 hours — even a 'we're on it' note is enough.",
          "Repeated identical requests usually mean a missing weekly item — upload once and clear all.",
        ]}
      />

      {/* Best practices */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Reliability
            </div>
            <h2 className="text-lg font-bold tracking-tight">Work efficiently and reliably</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Verify uploads", "After saving, open the public subject page and check the file previews correctly."],
            ["Right semester", "Always confirm the semester switcher at the top of the sidebar before uploading."],
            ["Descriptive titles", "Include week/module number so materials sort naturally."],
            ["Keep it lean", "Archive superseded material instead of stacking duplicates."],
            ["Respect students", "No blank titles, no random file names — students will thank you."],
            ["Backup source files", "Keep your originals — the site is the delivery layer, not the archive of record."],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{t}</div>
                <div className="text-xs text-muted-foreground">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Help */}
      <SuperAdminContacts />
    </div>
  );
}

function initials(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function SuperAdminContacts() {
  const q = useQuery({
    queryKey: ["super-admin-contacts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("super_admin_contacts")
        .select("id, full_name, avatar_url, phone, email");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; avatar_url: string | null; phone: string | null; email: string | null }[];
    },
  });
  const admins = q.data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Need help
          </div>
          <h2 className="text-lg font-bold tracking-tight">Stuck? Reach a super admin</h2>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        For access issues, missing semesters, or anything that blocks you from working —
        contact a super admin directly.
      </p>

      {admins.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {admins.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 ring-1 ring-border">
                  {a.avatar_url ? <AvatarImage src={a.avatar_url} alt={a.full_name ?? "Super admin"} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {initials(a.full_name, a.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.full_name ?? "Super admin"}</div>
                  <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">Super admin</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.phone ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${a.phone.replace(/\s+/g, "")}`}>
                      <Phone className="mr-2 h-4 w-4" /> {a.phone}
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No phone added yet</span>
                )}
                {a.email && (
                  <Button asChild size="sm" variant="ghost">
                    <a href={`mailto:${a.email}`}>
                      <Mail className="mr-2 h-4 w-4" /> {a.email}
                    </a>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail className="mr-2 h-4 w-4" /> {SUPPORT_EMAIL}
            </a>
          </Button>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Super admins can add or update their phone number from their <b>Profile</b> page.
      </p>
    </section>
    </div>
  );
}

function Guide({
  icon,
  title,
  to,
  steps,
  tips,
}: {
  icon: React.ReactNode;
  title: string;
  to: string;
  steps: string[];
  tips: string[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={to as never}>
            Open <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            How to
          </div>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold tabular-nums">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            Tips
          </div>
          <ul className="space-y-2">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-1 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
