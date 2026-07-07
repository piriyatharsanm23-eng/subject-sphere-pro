import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Download,
  FileText,
  MessageSquare,
  Sparkles,
  GraduationCap,
  Clock,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { getSelection } from "@/lib/selection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyHub — Your study materials, organised" },
      { name: "description", content: "Pick your semester and subjects, then access every lecture slide, note, past paper and deadline in one beautiful place." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    setHasSelection(!!getSelection());
  }, []);

  const { data: semesters } = useQuery({
    queryKey: ["semesters", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semesters")
        .select("id, name, description")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const featuredSemester = semesters?.[0];

  const { data: preview } = useQuery({
    queryKey: ["landing-preview", featuredSemester?.id],
    enabled: !!featuredSemester?.id,
    queryFn: async () => {
      const semesterId = featuredSemester!.id;
      const [subjectsRes, materialsRes, deadlinesRes] = await Promise.all([
        supabase.from("subjects").select("id", { count: "exact", head: true }).eq("semester_id", semesterId),
        supabase
          .from("materials")
          .select("id, title, material_type, subject:subjects(name)", { count: "exact" })
          .eq("is_archived", false)
          .eq("semester_id", semesterId)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("deadlines")
          .select("id, title, deadline_at, subject:subjects(name)", { count: "exact" })
          .eq("is_archived", false)
          .eq("semester_id", semesterId)
          .gte("deadline_at", new Date().toISOString())
          .order("deadline_at", { ascending: true })
          .limit(2),
      ]);
      return {
        subjectCount: subjectsRes.count ?? 0,
        materialCount: materialsRes.count ?? 0,
        deadlineCount: deadlinesRes.count ?? 0,
        materials: materialsRes.data ?? [],
        deadlines: deadlinesRes.data ?? [],
      };
    },
  });

  const typeStyle: Record<string, string> = {
    slides: "bg-sky-400/20 text-sky-100",
    notes: "bg-emerald-400/20 text-emerald-100",
    paper: "bg-violet-400/20 text-violet-100",
    past_paper: "bg-violet-400/20 text-violet-100",
    assignment: "bg-amber-400/20 text-amber-100",
    other: "bg-white/15 text-white/90",
  };

  const previewRows: { t: string; b: string; c: string }[] = [];
  if (preview) {
    const now = Date.now();
    for (const d of preview.deadlines) {
      const hours = (new Date(d.deadline_at).getTime() - now) / 36e5;
      const label = hours < 24 ? "Urgent" : hours < 72 ? "Due soon" : "Deadline";
      const cls = hours < 24 ? "bg-rose-400/20 text-rose-100" : hours < 72 ? "bg-amber-400/20 text-amber-100" : "bg-teal-400/20 text-teal-100";
      const subj = (d.subject as any)?.name ?? "";
      previewRows.push({ t: `${subj} · ${d.title}`, b: label, c: cls });
    }
    for (const m of preview.materials) {
      const subj = (m.subject as any)?.name ?? "";
      const t = String(m.material_type ?? "other");
      previewRows.push({
        t: `${subj} · ${m.title}`,
        b: t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        c: typeStyle[t] ?? typeStyle.other,
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero" />
        {/* animated gradient orbs */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-emerald-400/30 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-teal-400/25 blur-3xl animate-pulse [animation-delay:1.5s]" />
        <div className="pointer-events-none absolute top-1/3 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-sky-400/15 blur-3xl" />
        {/* grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />

        <div className="relative container mx-auto px-4 sm:px-6 pt-14 pb-20 sm:pt-20 sm:pb-28 lg:pt-28 lg:pb-36">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            {/* COPY */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                <span>Built for students, organised by semester</span>
              </div>

              <h1 className="mt-5 text-[2.25rem] leading-[1.05] sm:text-5xl lg:text-[4rem] font-extrabold tracking-tight text-white">
                Every lecture slide and past paper,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-200">
                  one calm place
                </span>
                <span className="text-emerald-300">.</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-white/75 max-w-xl leading-relaxed">
                Instant, no-login access to lecture materials, notes, past papers and upcoming deadlines — sorted by your semester and subjects.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate({ to: hasSelection ? "/dashboard" : "/select" })}
                  className="bg-white text-navy hover:bg-white/90 shadow-glow font-semibold w-full sm:w-auto"
                >
                  {hasSelection ? "Open dashboard" : "Start learning"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="bg-white/5 border-white/30 text-white hover:bg-white/15 hover:text-white backdrop-blur w-full sm:w-auto"
                >
                  <Link to="/select">Choose semester</Link>
                </Button>
              </div>

              {/* trust row */}
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-white/70">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> No sign-up required</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-emerald-300" /> Live deadline alerts</div>
                <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-emerald-300" /> Organised by subject</div>
              </div>
            </div>

            {/* PREVIEW CARD */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-emerald-400/30 via-teal-400/20 to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-white/90">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/20 text-emerald-200">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-semibold">
                      {featuredSemester ? `${featuredSemester.name} · Today` : "Today"}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-400/20 text-emerald-100 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 border border-emerald-300/30">Live</span>
                </div>

                <div className="space-y-2.5 min-h-[180px]">
                  {previewRows.length > 0 ? (
                    previewRows.slice(0, 4).map((r, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 px-3 py-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-md bg-white/10 text-white/80 shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 text-sm text-white/90 truncate">{r.t}</div>
                        <span className={`shrink-0 rounded-full text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 ${r.c}`}>{r.b}</span>
                      </div>
                    ))
                  ) : (
                    <div className="grid place-items-center h-[180px] text-sm text-white/60 text-center px-4">
                      {featuredSemester
                        ? "No materials or deadlines yet for this semester."
                        : "No active semesters yet. Once an admin adds them, live content shows here."}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "Subjects", v: preview?.subjectCount ?? 0 },
                    { k: "Materials", v: preview?.materialCount ?? 0 },
                    { k: "Deadlines", v: preview?.deadlineCount ?? 0 },
                  ].map((s) => (
                    <div key={s.k} className="rounded-xl bg-white/5 border border-white/10 py-2">
                      <div className="text-base font-bold text-white">{s.v}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/60">{s.k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* fade to page */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 sm:px-6 -mt-10 sm:-mt-14 relative z-10">
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, title: "Lecture slides & notes", desc: "Download up-to-date material from every subject.", tint: "from-sky-500/15 to-transparent", iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
            { icon: BookOpen, title: "Past papers archive", desc: "Browse past papers, organised by year.", tint: "from-violet-500/15 to-transparent", iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
            { icon: Calendar, title: "Live deadlines", desc: "See assignments and exam dates at a glance.", tint: "from-emerald-500/15 to-transparent", iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
            { icon: MessageSquare, title: "Request & feedback", desc: "Ask for missing material or report issues.", tint: "from-amber-500/15 to-transparent", iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
          ].map((f) => (
            <div
              key={f.title}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${f.tint} opacity-60`} />
              <div className="relative">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${f.iconBg}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 sm:mt-4 font-semibold text-sm sm:text-base leading-tight">{f.title}</h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AVAILABLE SEMESTERS */}
      <section className="container mx-auto px-4 sm:px-6 mt-16 sm:mt-24">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
              <Layers className="h-3 w-3" /> Catalog
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Available semesters</h2>
            <p className="mt-1 text-muted-foreground text-sm">Pick a semester to view its subjects and materials.</p>
          </div>
          <Button asChild variant="ghost" className="shrink-0">
            <Link to="/select">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <SemesterCards semesters={semesters ?? []} />
      </section>

      <RecentUploads />


      {/* CTA */}
      <section className="container mx-auto px-4 sm:px-6 mt-16 sm:mt-24 mb-16 sm:mb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-hero p-8 sm:p-12 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/30 blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Ready to organise your study life?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/75 max-w-xl mx-auto">
              No login. No clutter. Just everything you need to ace this semester.
            </p>
            <Button
              size="lg"
              onClick={() => navigate({ to: hasSelection ? "/dashboard" : "/select" })}
              className="mt-6 bg-white text-navy hover:bg-white/90 shadow-glow font-semibold"
            >
              {hasSelection ? "Open dashboard" : "Get started — it's free"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="flex-1" />
      <SiteFooter />
    </div>
  );
}

function SemesterCards({ semesters }: { semesters: { id: string; name: string; description: string | null }[] }) {
  const ids = semesters.map((s) => s.id);
  const statsQ = useQuery({
    queryKey: ["home-sem-stats", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [mat, dead] = await Promise.all([
        supabase.from("materials").select("semester_id,material_type").in("semester_id", ids).eq("is_archived", false),
        supabase.from("deadlines").select("semester_id").in("semester_id", ids).eq("is_archived", false).eq("status", "active").gte("deadline_at", new Date().toISOString()),
        // subjects loaded separately below
      ]);
      const subs = await supabase.from("subjects").select("id,semester_id").in("semester_id", ids);
      const by: Record<string, { subjects: number; tutorials: number; notes: number; papers: number; deadlines: number }> = {};
      for (const id of ids) by[id] = { subjects: 0, tutorials: 0, notes: 0, papers: 0, deadlines: 0 };
      for (const s of subs.data ?? []) by[s.semester_id].subjects += 1;
      for (const m of mat.data ?? []) {
        const b = by[m.semester_id]; if (!b) continue;
        if (m.material_type === "other" || m.material_type === "lecture_slide") b.tutorials += 1;
        else if (m.material_type === "note") b.notes += 1;
        else if (m.material_type === "past_paper") b.papers += 1;
      }
      for (const d of dead.data ?? []) if (by[d.semester_id]) by[d.semester_id].deadlines += 1;

      return by;
    },
  });

  if (semesters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-semibold">No semesters yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Admins can add semesters from the admin dashboard.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {semesters.map((s) => {
        const st = statsQ.data?.[s.id];
        const empty = st && st.subjects === 0 && st.tutorials === 0 && st.notes === 0 && st.papers === 0 && st.deadlines === 0;
        return (
          <Link
            key={s.id}
            to="/semester/$id"
            params={{ id: s.id }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card-soft p-5 sm:p-6 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all"
          >
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-gradient text-primary-foreground shadow-glow">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold truncate group-hover:text-primary transition-colors">{s.name}</h3>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
            </div>
            {s.description && <p className="relative mt-3 text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
            {empty ? (
              <p className="relative mt-4 text-xs text-muted-foreground italic">No materials uploaded yet.</p>
            ) : (
              <div className="relative mt-4 grid grid-cols-5 gap-1.5 text-center">
                {[
                  { k: "Subj", v: st?.subjects },
                  { k: "Tutorials", v: st?.tutorials },
                  { k: "Notes", v: st?.notes },
                  { k: "Papers", v: st?.papers },
                  { k: "Due", v: st?.deadlines },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg bg-muted/60 py-1.5">
                    <div className="text-sm font-bold tabular-nums">{x.v ?? "—"}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{x.k}</div>
                  </div>
                ))}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function RecentUploads() {
  const q = useQuery({
    queryKey: ["home-recent-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,material_type,created_at,subject_id,semester_id,subject:subjects(name),semester:semesters(name)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section className="container mx-auto px-4 sm:px-6 mt-16 sm:mt-24">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> Fresh
          </div>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Recent uploads</h2>
          <p className="mt-1 text-muted-foreground text-sm">The latest lecture slides, notes and papers added by your admins.</p>
        </div>
      </div>
      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Recent uploads will appear here after admins upload materials.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data!.map((m: any) => (
            <Link
              key={m.id}
              to="/material/$id"
              params={{ id: m.id }}
              className="group rounded-2xl border border-border bg-card p-4 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium capitalize">
                  {String(m.material_type).replace("_", " ")}
                </span>
                <span className="truncate">{m.semester?.name}</span>
              </div>
              <h3 className="mt-2 font-semibold group-hover:text-primary transition-colors line-clamp-2">{m.title}</h3>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{m.subject?.name}</span>
                <span className="shrink-0">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

