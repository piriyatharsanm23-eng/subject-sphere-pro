import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowRight, BarChart3, BookOpen, CalendarClock, FileText,
  Library, MessageSquare, Sparkles, Star, Users,
} from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/")({
  head: () => ({ meta: [{ title: "Super Admin — StudyHub" }] }),
  component: SuperHome,
});

function SuperHome() {
  return (
    <SuperShell title="Control center" description="Manage the StudyHub platform end-to-end.">
      <Stats />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.title}
            to={c.to as never}
            className="group rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <c.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold group-hover:text-primary transition-colors">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            <div className="mt-3 inline-flex items-center text-sm font-medium text-primary">
              Open <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </SuperShell>
  );
}

const CARDS = [
  { to: "/super/semesters", icon: BookOpen, title: "Semesters", desc: "Create, edit, activate or archive semesters." },
  { to: "/super/subjects", icon: Library, title: "Subjects", desc: "Curate the subject catalog per semester." },
  { to: "/super/admins", icon: Users, title: "Admins", desc: "Assign or remove admins per semester." },
  { to: "/super/materials", icon: FileText, title: "Materials", desc: "Browse, archive or delete uploads." },
  { to: "/super/deadlines", icon: CalendarClock, title: "Deadlines", desc: "Oversee every deadline across semesters." },
  { to: "/super/requests", icon: MessageSquare, title: "Requests", desc: "Triage student requests and update status." },
  { to: "/super/feedback", icon: Star, title: "Feedback", desc: "Read student feedback and ratings." },
  { to: "/super/analytics", icon: BarChart3, title: "Analytics", desc: "Downloads, popular materials, engagement." },
  { to: "/super/activity", icon: Activity, title: "Activity Log", desc: "Audit every important admin action." },
  { to: "/super/ai-settings", icon: Sparkles, title: "AI Study Helper", desc: "Turn ChatGPT / Gemini explanations on or off." },
];

function Stats() {
  const q = useQuery({
    queryKey: ["super-stats"],
    queryFn: async () => {
      const counts = await Promise.all([
        supabase.from("semesters").select("id", { head: true, count: "exact" }),
        supabase.from("subjects").select("id", { head: true, count: "exact" }),
        supabase.from("materials").select("id", { head: true, count: "exact" }).eq("is_archived", false),
        supabase.from("deadlines").select("id", { head: true, count: "exact" }).eq("is_archived", false),
        supabase.from("student_requests").select("id", { head: true, count: "exact" }).eq("status", "pending"),
        (supabase as any).from("kuppi_videos").select("id", { head: true, count: "exact" }),
      ]);
      return {
        semesters: counts[0].count ?? 0,
        subjects: counts[1].count ?? 0,
        materials: counts[2].count ?? 0,
        deadlines: counts[3].count ?? 0,
        pendingRequests: counts[4].count ?? 0,
        kuppi: counts[5].count ?? 0,
      };
    },
  });
  const s = q.data;
  const items = [
    { label: "Semesters", value: s?.semesters, icon: BookOpen, color: "text-emerald-400" },
    { label: "Subjects", value: s?.subjects, icon: Library, color: "text-sky-400" },
    { label: "Active Materials", value: s?.materials, icon: FileText, color: "text-teal-400" },
    { label: "Active Deadlines", value: s?.deadlines, icon: CalendarClock, color: "text-orange-400" },
    { label: "Pending Requests", value: s?.pendingRequests, icon: MessageSquare, color: "text-rose-400" },
    { label: "Kuppi videos", value: s?.kuppi, icon: BarChart3, color: "text-violet-400" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{i.label}</span>
            <i.icon className={`h-4 w-4 ${i.color}`} />
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums">
            {q.isLoading ? "—" : (i.value ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
