import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, UserCheck, UserPlus, Users } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/super/visitors")({
  head: () => ({
    meta: [
      { title: "Visitors & members — Super Admin" },
      { name: "description", content: "See how many people use StudyHub, including guests without accounts and registered members." },
      { property: "og:title", content: "Visitors & members — Super Admin" },
      { property: "og:description", content: "Guest visitors vs registered members on StudyHub." },
    ],
  }),
  component: VisitorsPage,
});

type Visit = { visitor_id: string; user_id: string | null; path: string | null; created_at: string };
type Profile = { id: string; full_name: string | null; email: string | null; created_at: string | null };

const RANGES = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function VisitorsPage() {
  const [days, setDays] = useState(30);
  const since = useMemo(() => new Date(Date.now() - days * 86_400_000).toISOString(), [days]);

  const visitsQ = useQuery({
    queryKey: ["super-visits", days],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_visits")
        .select("visitor_id,user_id,path,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["super-visitors-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const stats = useMemo(() => {
    const visits = visitsQ.data ?? [];
    const all = new Set<string>();
    const signedIn = new Set<string>();
    for (const v of visits) {
      all.add(v.visitor_id);
      if (v.user_id) signedIn.add(v.visitor_id);
    }
    const guests = [...all].filter((id) => !signedIn.has(id)).length;

    // daily buckets
    const byDay: Record<string, { all: Set<string>; guest: Set<string> } > = {};
    for (const v of visits) {
      const key = new Date(v.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
      byDay[key] = byDay[key] ?? { all: new Set(), guest: new Set() };
      byDay[key].all.add(v.visitor_id);
      if (!v.user_id) byDay[key].guest.add(v.visitor_id);
    }
    const daily = Object.entries(byDay)
      .map(([d, s]) => ({ day: d, total: s.all.size, guests: s.guest.size }))
      .sort((a, b) => (a.day < b.day ? -1 : 1))
      .slice(-30);

    const pages: Record<string, number> = {};
    for (const v of visits) pages[v.path ?? "/"] = (pages[v.path ?? "/"] ?? 0) + 1;
    const topPages = Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { pageViews: visits.length, unique: all.size, guests, signedIn: signedIn.size, daily, topPages };
  }, [visitsQ.data]);

  const newMembers = useMemo(
    () => (profilesQ.data ?? []).filter((p) => p.created_at && p.created_at >= since).length,
    [profilesQ.data, since],
  );

  const maxDay = Math.max(1, ...stats.daily.map((d) => d.total));
  const loading = visitsQ.isLoading || profilesQ.isLoading;

  return (
    <SuperShell title="Visitors & members" description="How many people use StudyHub — including guests browsing without an account.">
      <div className="mb-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button key={r.days} size="sm" variant={days === r.days ? "default" : "outline"} onClick={() => setDays(r.days)}>
            Last {r.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Unique visitors" value={stats.unique} hint={`in the last ${days} days`} />
            <StatCard icon={Eye} label="Guests (no account)" value={stats.guests} hint="never signed in on this device" />
            <StatCard icon={UserCheck} label="Signed-in visitors" value={stats.signedIn} hint="browsed while logged in" />
            <StatCard icon={UserPlus} label="Account members" value={profilesQ.data?.length ?? 0} hint={`${newMembers} joined in this period`} />
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
            <h2 className="text-sm font-semibold">Daily unique visitors</h2>
            <p className="text-xs text-muted-foreground">Total bar with the guest share highlighted. Page views in period: {stats.pageViews.toLocaleString()}</p>
            {stats.daily.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">No visits recorded yet for this period.</p>
            ) : (
              <div className="mt-4 flex items-end gap-1 h-40 overflow-x-auto">
                {stats.daily.map((d) => (
                  <div key={d.day} className="flex-1 min-w-[10px] flex flex-col items-center gap-1" title={`${d.day}: ${d.total} visitors (${d.guests} guests)`}>
                    <div className="w-full rounded-t bg-primary/25 flex flex-col justify-end" style={{ height: `${(d.total / maxDay) * 100}%` }}>
                      <div className="w-full rounded-t bg-primary" style={{ height: `${d.total ? (d.guests / d.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
            <h2 className="text-sm font-semibold">Most visited pages</h2>
            <ul className="mt-3 space-y-2">
              {stats.topPages.length === 0 && <li className="text-sm text-muted-foreground">No data yet.</li>}
              {stats.topPages.map(([p, n]) => (
                <li key={p} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-mono text-xs">{p}</span>
                  <span className="text-muted-foreground">{n.toLocaleString()} views</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </SuperShell>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
