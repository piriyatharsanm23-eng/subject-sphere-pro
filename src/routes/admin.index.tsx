import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, CalendarClock, FileText, MessageSquare, Star, Video,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — StudyHub" }] }),
  component: AdminHome,
});

function AdminHome() {
  return (
    <AdminShell title="Admin overview" description="Manage lecture materials, deadlines, requests and feedback for your semester.">
      {(ctx) => <Body semesterId={ctx.semesterId} />}
    </AdminShell>
  );
}

function Body({ semesterId }: { semesterId: string }) {
  const stats = useQuery({
    queryKey: ["admin-stats", semesterId],
    queryFn: async () => {
      const [m, d, r, f, k] = await Promise.all([
        supabase.from("materials").select("id", { head: true, count: "exact" }).eq("semester_id", semesterId).eq("is_archived", false),
        supabase.from("deadlines").select("id", { head: true, count: "exact" }).eq("semester_id", semesterId).eq("is_archived", false),
        supabase.from("student_requests").select("id", { head: true, count: "exact" }).eq("semester_id", semesterId).eq("status", "pending"),
        supabase.from("feedback").select("id", { head: true, count: "exact" }).eq("semester_id", semesterId),
        (supabase as any).from("kuppi_videos").select("id", { head: true, count: "exact" }).eq("semester_id", semesterId),
      ]);
      return {
        materials: m.count ?? 0,
        deadlines: d.count ?? 0,
        requests: r.count ?? 0,
        feedback: f.count ?? 0,
        kuppi: k.count ?? 0,
      };
    },
  });

  const items = [
    { label: "Materials", value: stats.data?.materials, icon: FileText, color: "text-teal-400" },
    { label: "Deadlines", value: stats.data?.deadlines, icon: CalendarClock, color: "text-orange-400" },
    { label: "Pending requests", value: stats.data?.requests, icon: MessageSquare, color: "text-rose-400" },
    { label: "Feedback", value: stats.data?.feedback, icon: Star, color: "text-amber-400" },
    { label: "Kuppi videos", value: stats.data?.kuppi, icon: Video, color: "text-emerald-400" },
  ];

  const cards = [
    { to: "/admin/materials", icon: FileText, title: "Upload materials", desc: "Add slides, notes, past papers and assignments." },
    { to: "/admin/kuppi", icon: Video, title: "Kuppi videos", desc: "Add student-recorded Kuppi sessions with Sinhala/Tamil filter." },
    { to: "/admin/deadlines", icon: CalendarClock, title: "Create deadlines", desc: "Publish deadlines with due date and attachment." },
    { to: "/admin/requests", icon: MessageSquare, title: "Student requests", desc: "Triage requests and mark them resolved." },
    { to: "/admin/feedback", icon: Star, title: "Feedback", desc: "Read ratings and comments from students." },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{i.label}</span>
              <i.icon className={`h-4 w-4 ${i.color}`} />
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums">
              {stats.isLoading ? "—" : (i.value ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
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
    </>
  );
}
