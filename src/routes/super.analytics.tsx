import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, FileText, Loader2, TrendingUp } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Super Admin" }] }),
  component: AnalyticsPage,
});

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
        .select("id,title,material_type,semester_id,subject_id,download_count,is_archived")
        .order("download_count", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const downloadsQ = useQuery({
    queryKey: ["super-downloads-recent"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("downloads")
        .select("downloaded_at")
        .gte("downloaded_at", since)
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const semById = useMemo(() => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])), [semestersQ.data]);
  const subById = useMemo(() => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])), [subjectsQ.data]);

  const totalDownloads = useMemo(
    () => (matsQ.data ?? []).reduce((a, m) => a + (m.download_count ?? 0), 0),
    [matsQ.data],
  );
  const totalMaterials = (matsQ.data ?? []).filter((m) => !m.is_archived).length;

  const top = (matsQ.data ?? []).slice(0, 10);

  // Downloads-by-day for last 14 days
  const days = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const d of downloadsQ.data ?? []) {
      const key = (d.downloaded_at ?? "").slice(0, 10);
      if (key in buckets) buckets[key]++;
    }
    return Object.entries(buckets).map(([k, v]) => ({ day: k, n: v }));
  }, [downloadsQ.data]);
  const maxDay = Math.max(1, ...days.map((d) => d.n));

  // Downloads by semester
  const bySemester = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matsQ.data ?? []) {
      map[m.semester_id] = (map[m.semester_id] ?? 0) + (m.download_count ?? 0);
    }
    return Object.entries(map)
      .map(([id, n]) => ({ id, name: semById[id]?.name ?? "—", n }))
      .sort((a, b) => b.n - a.n);
  }, [matsQ.data, semById]);
  const maxSem = Math.max(1, ...bySemester.map((s) => s.n));

  // Materials by type
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matsQ.data ?? []) {
      if (m.is_archived) continue;
      map[m.material_type] = (map[m.material_type] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [matsQ.data]);

  const loading = matsQ.isLoading || downloadsQ.isLoading;

  return (
    <SuperShell title="Analytics" description="Engagement at a glance across the platform.">
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            <Stat label="Total downloads" value={totalDownloads} icon={Download} accent="text-violet-400" />
            <Stat label="Active materials" value={totalMaterials} icon={FileText} accent="text-emerald-400" />
            <Stat label="Last 14 days" value={(downloadsQ.data ?? []).length} icon={TrendingUp} accent="text-teal-400" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Downloads — last 14 days">
              <div className="flex items-end gap-1.5 h-40">
                {days.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.n}`}>
                    <div
                      className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors"
                      style={{ height: `${(d.n / maxDay) * 100}%`, minHeight: 2 }}
                    />
                    <div className="text-[9px] text-muted-foreground">{d.day.slice(5)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Downloads by semester">
              {bySemester.length === 0 ? (
                <p className="text-sm text-muted-foreground">No downloads yet.</p>
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
                      <span className="capitalize text-sm">{t}</span>
                      <span className="text-lg font-semibold tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Top materials">
              {top.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <ol className="space-y-1.5">
                  {top.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {semById[m.semester_id]?.name ?? "—"} · {subById[m.subject_id]?.name ?? "—"}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                        <Download className="h-3 w-3" />{m.download_count}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
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
