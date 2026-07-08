import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, Video, Sparkles, Upload, BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Contributor = {
  id: string;
  role: string;
  assigned_semester_id: string | null;
  semester_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export const Route = createFileRoute("/contributors")({
  head: () => ({
    meta: [
      { title: "Contributors — StudyHub" },
      { name: "description", content: "Meet the admins and kuppi presenters who curate learning materials and record revision sessions on StudyHub." },
      { property: "og:title", content: "Contributors — StudyHub" },
      { property: "og:description", content: "Meet the admins and kuppi presenters behind StudyHub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContributorsPage,
});

function initials(name: string | null | undefined) {
  const src = (name || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function ContributorsPage() {
  const contributorsQ = useQuery({
    queryKey: ["contributors"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_contributors")
        .select("id,role,assigned_semester_id,semester_name,full_name,avatar_url")
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Contributor[];
    },
    staleTime: 60_000,
  });

  const uploadsQ = useQuery({
    queryKey: ["contributor-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("uploaded_by")
        .eq("pending_delete", false)
        .eq("is_archived", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) {
        if (r.uploaded_by) counts[r.uploaded_by] = (counts[r.uploaded_by] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 60_000,
  });

  const kuppiQ = useQuery({
    queryKey: ["contributor-kuppi-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("kuppi_videos")
        .select("id", { count: "exact", head: true })
        .eq("pending_delete", false);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const admins = (contributorsQ.data ?? []).filter((c) => c.role === "admin");
  const totalMaterials = Object.values(uploadsQ.data ?? {}).reduce((a, b) => a + b, 0);
  const semestersCovered = new Set(admins.map((a) => a.assigned_semester_id).filter(Boolean)).size;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(124,58,237,0.25), transparent 60%), radial-gradient(ellipse 60% 50% at 90% 20%, rgba(59,130,246,0.20), transparent 60%)",
            }}
          />
          <div className="container mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> The people behind StudyHub
              </div>
              <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">Contributors</h1>
              <p className="mt-3 text-muted-foreground text-lg">
                Semester admins curate materials, deadlines and past papers. Kuppi presenters record peer-led revision sessions in Sinhala, Tamil and English. Tap any card to see their contributions.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
              <HeroStat icon={GraduationCap} label="Admins" value={admins.length} tone="text-violet-500" />
              <HeroStat icon={BookOpen} label="Semesters covered" value={semestersCovered} tone="text-sky-500" />
              <HeroStat icon={Upload} label="Materials shared" value={totalMaterials} tone="text-emerald-500" />
              <HeroStat icon={Video} label="Kuppi videos" value={kuppiQ.data ?? 0} tone="text-rose-500" />
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 sm:px-6 py-10">
          {contributorsQ.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 rounded-2xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {admins.length > 0 ? (
                <AdminSection admins={admins} uploads={uploadsQ.data ?? {}} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                  No contributors yet.
                </div>
              )}
              <KuppiPresenters />
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function AdminSection({ admins, uploads }: { admins: Contributor[]; uploads: Record<string, number> }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-500">
          <GraduationCap className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold">Semester admins</h2>
        <span className="text-xs text-muted-foreground">({admins.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {admins.map((c) => {
          const count = uploads[c.id] ?? 0;
          return (
            <Link
              key={`${c.id}-${c.role}-${c.assigned_semester_id ?? "unassigned"}`}
              to="/contributors/$id"
              params={{ id: c.id }}
              className="group relative rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-primary/40 hover:shadow-elevated hover:-translate-y-0.5 transition-all overflow-hidden"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(124,58,237,0.14), transparent 70%)",
                }}
              />
              <div className="relative flex items-start gap-3">
                <Avatar className="h-14 w-14 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  {c.avatar_url ? <AvatarImage src={c.avatar_url} alt={c.full_name ?? "Admin"} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials(c.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate group-hover:text-primary transition-colors">
                    {c.full_name || "Unnamed admin"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {c.semester_name ? c.semester_name : "Unassigned"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground tabular-nums">{count}</span> upload{count === 1 ? "" : "s"}
                </span>
                <span className="font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  View profile →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

type KuppiPresenterRow = {
  presenter_name: string;
  presenter_photo_url: string | null;
  semester_id: string;
  subject_id: string;
};

function KuppiPresenters() {
  const { data, isLoading } = useQuery({
    queryKey: ["kuppi-presenters"],
    queryFn: async () => {
      const [{ data: k }, { data: sems }, { data: subs }] = await Promise.all([
        (supabase as any)
          .from("kuppi_videos")
          .select("presenter_name,presenter_photo_url,semester_id,subject_id").eq("pending_delete", false)
          .order("presenter_name"),
        supabase.from("semesters").select("id,name"),
        supabase.from("subjects").select("id,name,code"),
      ]);
      return {
        rows: (k ?? []) as KuppiPresenterRow[],
        semById: Object.fromEntries((sems ?? []).map((s: any) => [s.id, s.name])),
        subById: Object.fromEntries((subs ?? []).map((s: any) => [s.id, s])),
      };
    },
    staleTime: 60_000,
  });

  const grouped = (() => {
    const map = new Map<string, { name: string; photo: string | null; total: number; bySemester: Record<string, number>; bySubject: Record<string, number> }>();
    for (const r of data?.rows ?? []) {
      const key = r.presenter_name.trim().toLowerCase();
      const g = map.get(key) ?? { name: r.presenter_name, photo: r.presenter_photo_url, total: 0, bySemester: {}, bySubject: {} };
      g.total += 1;
      g.bySemester[r.semester_id] = (g.bySemester[r.semester_id] ?? 0) + 1;
      g.bySubject[r.subject_id] = (g.bySubject[r.subject_id] ?? 0) + 1;
      if (!g.photo && r.presenter_photo_url) g.photo = r.presenter_photo_url;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();

  if (isLoading) {
    return <div className="mt-12 h-40 rounded-2xl border border-border bg-card animate-pulse" />;
  }
  if (grouped.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="flex items-center gap-2 mb-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-500">
          <Video className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold">Kuppi presenters</h2>
        <span className="text-xs text-muted-foreground">({grouped.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map((g) => (
          <Link
            key={g.name}
            to="/kuppi-presenter/$name"
            params={{ name: encodeURIComponent(g.name) }}
            className="group relative rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-primary/40 hover:shadow-elevated hover:-translate-y-0.5 transition-all overflow-hidden"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60 group-hover:opacity-100 transition-opacity"
              style={{
                background:
                  "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(244,63,94,0.12), transparent 70%)",
              }}
            />
            <div className="relative flex items-center gap-3">
              <Avatar className="h-14 w-14 ring-2 ring-rose-500/20 group-hover:ring-rose-500/40 transition-all">
                {g.photo ? <AvatarImage src={g.photo} alt={g.name} /> : null}
                <AvatarFallback className="bg-rose-500/10 text-rose-500 font-semibold">
                  {g.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate group-hover:text-primary transition-colors">{g.name}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{g.total}</span> kuppi{g.total === 1 ? "" : "s"}
                  {" · "}
                  <span className="font-semibold text-foreground tabular-nums">{Object.keys(g.bySubject).length}</span> subject{Object.keys(g.bySubject).length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap gap-1">
              {Object.entries(g.bySubject).slice(0, 5).map(([sid, n]) => (
                <Badge key={sid} variant="outline" className="text-[10px]">
                  {data?.subById[sid]?.code ?? data?.subById[sid]?.name ?? "—"} · {n}
                </Badge>
              ))}
              {Object.keys(g.bySubject).length > 5 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{Object.keys(g.bySubject).length - 5} more
                </Badge>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
