import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, FileText, Layers, NotebookPen, ScrollText, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/semester/$id")({
  head: () => ({ meta: [{ title: "Semester — StudyHub" }] }),
  component: SemesterPage,
});

function SemesterPage() {
  const { id } = useParams({ from: "/semester/$id" });

  const semesterQ = useQuery({
    queryKey: ["semester-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semesters")
        .select("id,name,description")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const subjectsQ = useQuery({
    queryKey: ["semester-subjects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id,name,code,description")
        .eq("semester_id", id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const materialsQ = useQuery({
    queryKey: ["semester-materials", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,subject_id,material_type,created_at")
        .eq("semester_id", id)
        .eq("is_archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const deadlinesQ = useQuery({
    queryKey: ["semester-deadlines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("id,subject_id")
        .eq("semester_id", id)
        .eq("status", "active")
        .eq("is_archived", false)
        .gte("deadline_at", new Date().toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const contributorsQ = useQuery({
    queryKey: ["semester-contributors", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_contributors")
        .select("id, full_name, avatar_url")
        .eq("assigned_semester_id", id);
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[];
    },
  });

  const subjects = subjectsQ.data ?? [];
  const materials = materialsQ.data ?? [];
  const deadlines = deadlinesQ.data ?? [];

  const perSubject = subjects.map((s) => {
    const mine = materials.filter((m) => m.subject_id === s.id);
    const latest = mine.reduce<string | null>((acc, m) => (!acc || m.created_at > acc ? m.created_at : acc), null);
    return {
      ...s,
      tutorials: mine.filter((m) => m.material_type === "other").length,
      notes: mine.filter((m) => m.material_type === "note" || m.material_type === "lecture_slide").length,
      papers: mine.filter((m) => m.material_type === "past_paper").length,
      deadlines: deadlines.filter((d) => d.subject_id === s.id).length,
      latest,
    };
  }).sort((a, b) => {
    // Most recently updated subjects first; subjects with no uploads last (alphabetical).
    if (a.latest && b.latest) return b.latest.localeCompare(a.latest);
    if (a.latest) return -1;
    if (b.latest) return 1;
    return a.name.localeCompare(b.name);
  });

  const totals = {
    subjects: subjects.length,
    tutorials: materials.filter((m) => m.material_type === "other").length,
    notes: materials.filter((m) => m.material_type === "note" || m.material_type === "lecture_slide").length,
    papers: materials.filter((m) => m.material_type === "past_paper").length,
    deadlines: deadlines.length,
  };


  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 max-w-6xl w-full">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to home</Link>
        </Button>

        <header className="rounded-2xl border border-border bg-card-soft p-6 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Semester</div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
            {semesterQ.isLoading ? "Loading…" : semesterQ.data?.name ?? "Not found"}
          </h1>
          {semesterQ.data?.description && (
            <p className="mt-2 text-muted-foreground max-w-2xl">{semesterQ.data.description}</p>
          )}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat icon={BookOpen} label="Subjects" value={totals.subjects} tone="text-sky-500" />
            <Stat icon={ScrollText} label="Tutorials" value={totals.tutorials} tone="text-violet-500" />
            <Stat icon={NotebookPen} label="Notes" value={totals.notes} tone="text-emerald-500" />
            <Stat icon={Layers} label="Past papers" value={totals.papers} tone="text-amber-500" />
            <Stat icon={CalendarClock} label="Deadlines" value={totals.deadlines} tone="text-rose-500" />
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Subjects</h2>
          {subjectsQ.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : perSubject.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">No subjects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Admins can add subjects to this semester from the admin dashboard.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {perSubject.map((s) => (
                <Link
                  key={s.id}
                  to="/subject/$id"
                  params={{ id: s.id }}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {s.code && <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{s.code}</div>}
                      <div className="font-semibold group-hover:text-primary transition-colors truncate">{s.name}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <MiniStat icon={ScrollText} label="Tutorials" value={s.tutorials} tone="text-violet-500" />
                    <MiniStat icon={NotebookPen} label="Notes" value={s.notes} tone="text-emerald-500" />
                    <MiniStat icon={Layers} label="Papers" value={s.papers} tone="text-amber-500" />
                    <MiniStat icon={CalendarClock} label="Deadlines" value={s.deadlines} tone="text-rose-500" />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{s.latest ? `Updated ${formatDistanceToNow(new Date(s.latest), { addSuffix: true })}` : "No uploads yet"}</span>
                    <span className="font-medium text-primary group-hover:underline">View materials</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof BookOpen; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: typeof BookOpen; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
    </div>
  );
}
