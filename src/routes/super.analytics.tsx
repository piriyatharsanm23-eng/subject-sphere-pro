import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileText, Loader2, TrendingUp, Video } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Super Admin" }] }),
  component: AnalyticsPage,
});

type Mat = { id: string; title: string; material_type: string; semester_id: string; subject_id: string; is_archived: boolean; created_at: string };

function AnalyticsPage() {
  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => (await supabase.from("semesters").select("id,name")).data ?? [],
  });
  const subjectsQ = useQuery({
    queryKey: ["super-all-subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id,name,semester_id")).data ?? [],
  });
  const matsQ = useQuery({
    queryKey: ["super-analytics-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,material_type,semester_id,subject_id,is_archived,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Mat[];
    },
  });
  const kuppiQ = useQuery({
    queryKey: ["super-analytics-kuppi"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("kuppi_videos").select("id,semester_id,medium,created_at").limit(500);
      return (data ?? []) as { id: string; semester_id: string; medium: string; created_at: string }[];
    },
  });

  const semById = useMemo(() => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])), [semestersQ.data]);

  const totalMaterials = (matsQ.data ?? []).filter((m) => !m.is_archived).length;

  // Materials by semester
  const bySemester = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matsQ.data ?? []) {
      if (m.is_archived) continue;
      map[m.semester_id] = (map[m.semester_id] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([id, n]) => ({ id, name: semById[id]?.name ?? "—", n }))
      .sort((a, b) => b.n - a.n);
  }, [matsQ.data, semById]);
  const maxSem = Math.max(1, ...bySemester.map((s) => s.n));

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matsQ.data ?? []) {
      if (m.is_archived) continue;
      map[m.material_type] = (map[m.material_type] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [matsQ.data]);

  const kuppiByMedium = useMemo(() => {
    const map: Record<string, number> = { sinhala: 0, tamil: 0, english: 0 };
    for (const k of kuppiQ.data ?? []) map[k.medium] = (map[k.medium] ?? 0) + 1;
    return map;
  }, [kuppiQ.data]);

  const recent = useMemo(() => {
    const since = Date.now() - 14 * 86_400_000;
    return (matsQ.data ?? []).filter((m) => new Date(m.created_at).getTime() > since).length;
  }, [matsQ.data]);

  const loading = matsQ.isLoading || kuppiQ.isLoading || subjectsQ.isLoading;

  return (
    <SuperShell title="Analytics" description="Engagement at a glance across the platform.">
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            <Stat label="Active materials" value={totalMaterials} icon={FileText} accent="text-emerald-400" />
            <Stat label="Kuppi videos" value={kuppiQ.data?.length ?? 0} icon={Video} accent="text-violet-400" />
            <Stat label="Uploaded (14 days)" value={recent} icon={TrendingUp} accent="text-teal-400" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Materials by semester">
              {bySemester.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials yet.</p>
              ) : (
                <div className="space-y-2">
                  {bySemester.map((s) => (
                    <div key={s.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{s.name}</span><span className="tabular-nums text-muted-foreground">{s.n}</span>
                      </div>
                      <div className="h-2 rounded bg-muted">
                        <div className="h-2 rounded bg-emerald-500/70" style={{ width: `${(s.n / maxSem) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Materials by type">
              {byType.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {byType.map(([t, n]) => (
                    <div key={t} className="rounded-lg border border-border bg-background/40 p-3 flex items-center justify-between">
                      <span className="capitalize text-sm">{t.replace(/_/g, " ")}</span>
                      <span className="text-lg font-semibold tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Kuppi videos by medium">
              <div className="grid grid-cols-3 gap-2">
                {(["sinhala", "tamil", "english"] as const).map((m) => (
                  <div key={m} className="rounded-lg border border-border bg-background/40 p-3 text-center">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{m}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{kuppiByMedium[m] ?? 0}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </SuperShell>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof BarChart3; accent: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
