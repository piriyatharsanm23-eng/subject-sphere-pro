import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity, ArrowLeft, CalendarIcon, Filter, Search, ShieldAlert, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { ACTION_TYPES, actionBadge, actionLabel } from "@/lib/activity";

export const Route = createFileRoute("/super/activity")({
  head: () => ({ meta: [{ title: "Activity Logs — StudyHub" }] }),
  component: ActivityLogsPage,
});

function ActivityLogsPage() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<"checking" | "denied" | "ok">("checking");

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) { navigate({ to: "/auth" }); return; }
      const { data, error } = await supabase.rpc("is_super_admin", { _user_id: uid });
      if (error || !data) setAuthState("denied"); else setAuthState("ok");
    })();
  }, [navigate]);

  if (authState === "checking") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (authState === "denied") {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-4 text-xl font-semibold">Super Admin access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">You don't have permission to view activity logs.</p>
          <Button asChild className="mt-6"><Link to="/">Back home</Link></Button>
        </div>
      </div>
    );
  }
  return <LogsView />;
}

function LogsView() {
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const semestersQ = useQuery({
    queryKey: ["all-semesters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("semesters").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const subjectsQ = useQuery({
    queryKey: ["all-subjects", semesterFilter],
    queryFn: async () => {
      let qb = supabase.from("subjects").select("id,name,semester_id").order("name");
      if (semesterFilter !== "all") qb = qb.eq("semester_id", semesterFilter);
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });

  const logsQ = useQuery({
    queryKey: ["activity-logs", actionFilter, semesterFilter, subjectFilter, dateFilter],
    queryFn: async () => {
      let qb = supabase
        .from("activity_logs")
        .select("id,user_name,user_role,action_type,target_type,target_id,semester_id,subject_id,description,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (actionFilter !== "all") qb = qb.eq("action_type", actionFilter);
      if (semesterFilter !== "all") qb = qb.eq("semester_id", semesterFilter);
      if (subjectFilter !== "all") qb = qb.eq("subject_id", subjectFilter);
      if (dateFilter) {
        const start = new Date(dateFilter); start.setHours(0, 0, 0, 0);
        const end = new Date(dateFilter); end.setHours(23, 59, 59, 999);
        qb = qb.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });

  const semById = useMemo(() => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])), [semestersQ.data]);
  const subById = useMemo(() => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])), [subjectsQ.data]);

  const filtered = useMemo(() => {
    const list = logsQ.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((l) =>
      (l.user_name ?? "").toLowerCase().includes(needle) ||
      (l.description ?? "").toLowerCase().includes(needle),
    );
  }, [logsQ.data, q]);

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 max-w-7xl w-full">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Super Admin
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Activity Logs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every important action taken by admins and super admins.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/super"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link></Button>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="grid gap-2 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by admin name or description…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{actionLabel(a)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={semesterFilter} onValueChange={(v) => { setSemesterFilter(v); setSubjectFilter("all"); }}>
              <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All semesters</SelectItem>
                {(semestersQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {(subjectsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />
              {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}
            </div>
            <div className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">When</th>
                  <th className="text-left font-medium px-4 py-3">Who</th>
                  <th className="text-left font-medium px-4 py-3">Action</th>
                  <th className="text-left font-medium px-4 py-3">Description</th>
                  <th className="text-left font-medium px-4 py-3">Semester / Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logsQ.isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-14 text-center text-muted-foreground">No activity matches these filters.</td></tr>
                ) : (
                  filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{format(new Date(l.created_at), "MMM d, h:mm a")}</div>
                        <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{l.user_name ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground capitalize">{(l.user_role ?? "").replace("_", " ")}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${actionBadge(l.action_type)}`}>
                          {actionLabel(l.action_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">{l.description}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {l.semester_id && <div>{semById[l.semester_id]?.name ?? "—"}</div>}
                        {l.subject_id && <div className="text-foreground/80">{subById[l.subject_id]?.name ?? ""}</div>}
                        {!l.semester_id && !l.subject_id && <span>—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
