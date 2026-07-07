import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, Video } from "lucide-react";
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
      { name: "description", content: "Meet the admins who curate and upload learning materials for each semester on StudyHub." },
      { property: "og:title", content: "Contributors — StudyHub" },
      { property: "og:description", content: "Meet the admins who curate and upload learning materials on StudyHub." },
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
  const { data, isLoading } = useQuery({
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

  const admins = (data ?? []).filter((c) => c.role === "admin");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Users className="h-3.5 w-3.5" /> StudyHub team
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Contributors</h1>
          <p className="mt-2 text-muted-foreground">
            The admins behind the semesters — tap anyone to see their upload history.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {admins.length > 0 && (
              <Section title="Semester admins" icon={<GraduationCap className="h-4 w-4" />} items={admins} />
            )}
            {admins.length === 0 && (
              <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                No contributors yet.
              </div>
            )}
            <KuppiPresenters />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
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
          .select("presenter_name,presenter_photo_url,semester_id,subject_id")
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
    return (
      <div className="mt-10 h-32 rounded-2xl border border-border bg-card animate-pulse" />
    );
  }
  if (grouped.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-4">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><Video className="h-4 w-4" /></div>
        <h2 className="font-semibold">Kuppi presenters</h2>
        <span className="text-xs text-muted-foreground">({grouped.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map((g) => (
          <Link
            key={g.name}
            to="/kuppi-presenter/$name"
            params={{ name: encodeURIComponent(g.name) }}
            className="group rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-primary/40 hover:shadow-elevated transition-all"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                {g.photo ? <AvatarImage src={g.photo} alt={g.name} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {g.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate group-hover:text-primary transition-colors">{g.name}</div>
                <div className="text-xs text-muted-foreground">{g.total} kuppi{g.total === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              {Object.entries(g.bySemester).map(([sid, n]) => (
                <div key={sid} className="flex justify-between text-muted-foreground">
                  <span className="truncate">{data?.semById[sid] ?? "—"}</span>
                  <span className="tabular-nums">{n}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {Object.entries(g.bySubject).slice(0, 4).map(([sid, n]) => (
                <Badge key={sid} variant="outline" className="text-[10px]">
                  {data?.subById[sid]?.code ?? data?.subById[sid]?.name ?? "—"} · {n}
                </Badge>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Section({ title, icon, items }: { title: string; icon: React.ReactNode; items: Contributor[] }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Link
            key={`${c.id}-${c.role}-${c.assigned_semester_id ?? "unassigned"}`}
            to="/contributors/$id"
            params={{ id: c.id }}
            className="group rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-primary/40 hover:shadow-elevated transition-all"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                {c.avatar_url ? <AvatarImage src={c.avatar_url} alt={c.full_name ?? "Admin"} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials(c.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold truncate group-hover:text-primary transition-colors">
                  {c.full_name || "Unnamed admin"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {c.semester_name ? c.semester_name : "Unassigned"}
                  </Badge>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
