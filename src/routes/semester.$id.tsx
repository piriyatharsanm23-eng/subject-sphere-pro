import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, FileText, Layers, NotebookPen, ScrollText, Users, Video } from "lucide-react";
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
        .select("id,subject_id,material_type,created_at").eq("pending_delete", false)
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
        .select("id,subject_id").eq("pending_delete", false)
        .eq("semester_id", id)
        .eq("status", "active")
        .eq("is_archived", false)
        .gte("deadline_at", new Date().toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const kuppiQ = useQuery({
    queryKey: ["semester-kuppi-counts", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kuppi_videos")
        .select("id,subject_id").eq("pending_delete", false)
        .eq("semester_id", id);
      if (error) throw error;
      return (data ?? []) as { id: string; subject_id: string }[];
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
  const kuppis = kuppiQ.data ?? [];

  const perSubject = subjects.map((s) => {
    const mine = materials.filter((m) => m.subject_id === s.id);
    const latest = mine.reduce<string | null>((acc, m) => (!acc || m.created_at > acc ? m.created_at : acc), null);
    return {
      ...s,
      tutorials: mine.filter((m) => m.material_type === "other").length,
      notes: mine.filter((m) => m.material_type === "note" || m.material_type === "lecture_slide").length,
      papers: mine.filter((m) => m.material_type === "past_paper").length,
      deadlines: deadlines.filter((d) => d.subject_id === s.id).length,
      kuppis: kuppis.filter((k) => k.subject_id === s.id).length,
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


  const isError = semesterQ.isError || subjectsQ.isError;

  return (
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />
      <PageContainer>
        <PageHeader
          breadcrumbs={[{ label: "Home", to: "/" }, { label: semesterQ.data?.name ?? "Semester" }]}
          eyebrow="Semester"
          title={semesterQ.isLoading ? "Loading…" : (semesterQ.data?.name ?? "Semester not found")}
          description={semesterQ.data?.description ?? "Browse every subject, note, past paper and deadline in this semester."}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/select">Change preferences</Link>
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat icon={BookOpen} label="Subjects" value={totals.subjects} tone="text-sky-500" />
            <Stat icon={ScrollText} label="Tutorials" value={totals.tutorials} tone="text-violet-500" />
            <Stat icon={NotebookPen} label="Notes" value={totals.notes} tone="text-emerald-500" />
            <Stat icon={Layers} label="Past papers" value={totals.papers} tone="text-amber-500" />
            <Stat icon={CalendarClock} label="Deadlines" value={totals.deadlines} tone="text-rose-500" />
          </div>
        </PageHeader>

        {isError && (
          <ErrorState
            className="mb-6"
            title="We couldn't load this semester"
            error={(semesterQ.error ?? subjectsQ.error) as Error}
            onRetry={() => { semesterQ.refetch(); subjectsQ.refetch(); }}
          />
        )}

        {(contributorsQ.data ?? []).length > 0 && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                <Users className="h-4 w-4" aria-hidden="true" /> Contributors
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {(contributorsQ.data ?? []).map((c) => (
                  <Link
                    key={c.id}
                    to="/contributors/$id"
                    params={{ id: c.id }}
                    className="group inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-muted/40 pl-1 pr-3 py-1 transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Avatar className="h-6 w-6">
                      {c.avatar_url ? <AvatarImage src={c.avatar_url} alt="" /> : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {(c.full_name ?? "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[10rem] truncate text-xs font-medium group-hover:text-primary transition-colors">
                      {c.full_name ?? "Admin"}
                    </span>
                  </Link>
                ))}
              </div>
              <Link to="/contributors" className="ml-auto text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
          </section>
        )}

        <section>
          <SectionHeading title="Subjects" description={`${perSubject.length} subject${perSubject.length === 1 ? "" : "s"} in this semester`} />
          {subjectsQ.isLoading ? (
            <CardGridSkeleton count={6} height="h-44" />
          ) : perSubject.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No subjects yet"
              description="Semester admins add subjects from the admin dashboard. Check back soon or browse another semester."
              action={<Button asChild variant="outline" size="sm"><Link to="/">Browse semesters</Link></Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {perSubject.map((s) => (
                <Link
                  key={s.id}
                  to="/subject/$id"
                  params={{ id: s.id }}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {s.code && <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground truncate">{s.code}</div>}
                      <div className="font-semibold group-hover:text-primary transition-colors line-clamp-2">{s.name}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <MiniStat icon={ScrollText} label="Tutorials" value={s.tutorials} tone="text-violet-500" />
                    <MiniStat icon={NotebookPen} label="Notes" value={s.notes} tone="text-emerald-500" />
                    <MiniStat icon={Layers} label="Papers" value={s.papers} tone="text-amber-500" />
                    <MiniStat icon={CalendarClock} label="Deadlines" value={s.deadlines} tone="text-rose-500" />
                    <MiniStat icon={Video} label="Kuppi" value={s.kuppis} tone="text-sky-500" />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{s.latest ? `Updated ${formatRelative(s.latest)}` : "No uploads yet"}</span>
                    <span className="shrink-0 font-medium text-primary group-hover:underline">View materials</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </PageContainer>
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
