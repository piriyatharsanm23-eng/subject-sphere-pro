import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Archive, ArchiveRestore, CalendarClock, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/super/deadlines")({
  head: () => ({ meta: [{ title: "Deadlines — Super Admin" }] }),
  component: DeadlinesPage,
});

type Deadline = {
  id: string; title: string; deadline_at: string;
  semester_id: string; subject_id: string;
  status: string; is_archived: boolean;
};

function DeadlinesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sem, setSem] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => (await supabase.from("semesters").select("id,name").order("name")).data ?? [],
  });
  const subjectsQ = useQuery({
    queryKey: ["super-all-subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id,name,semester_id").order("name")).data ?? [],
  });

  const listQ = useQuery({
    queryKey: ["super-deadlines", sem, showArchived],
    queryFn: async () => {
      let qb = supabase
        .from("deadlines")
        .select("id,title,deadline_at,semester_id,subject_id,status,is_archived")
        .order("deadline_at", { ascending: true })
        .limit(500);
      if (sem !== "all") qb = qb.eq("semester_id", sem);
      if (!showArchived) qb = qb.eq("is_archived", false);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Deadline[];
    },
  });

  const subById = useMemo(() => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])), [subjectsQ.data]);
  const semById = useMemo(() => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])), [semestersQ.data]);

  const rows = useMemo(() => {
    const list = listQ.data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter((d) => d.title.toLowerCase().includes(n));
  }, [listQ.data, q]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["super-deadlines"] });

  const toggleArchive = async (d: Deadline) => {
    const { error } = await supabase.from("deadlines").update({ is_archived: !d.is_archived }).eq("id", d.id);
    if (error) return toast.error(error.message);
    await logActivity({
      action_type: "deadline_archive",
      description: `${d.is_archived ? "Restored" : "Archived"} deadline "${d.title}"`,
      target_type: "deadline", target_id: d.id,
      semester_id: d.semester_id, subject_id: d.subject_id,
    });
    toast.success(d.is_archived ? "Restored" : "Archived");
    refresh();
  };

  const remove = async (d: Deadline) => {
    if (!confirm(`Delete deadline "${d.title}"?`)) return;
    const { error } = await supabase.from("deadlines").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    await logActivity({
      action_type: "deadline_delete", description: `Deleted deadline "${d.title}"`,
      target_type: "deadline", target_id: d.id,
      semester_id: d.semester_id, subject_id: d.subject_id,
    });
    toast.success("Deleted");
    refresh();
  };

  return (
    <SuperShell title="All Deadlines" description="Oversee every deadline across the platform.">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft mb-4">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search deadlines…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={sem} onValueChange={setSem}>
            <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {(semestersQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} deadline{rows.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {listQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No deadlines match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Deadline</th>
                <th className="text-left font-medium px-4 py-3">When</th>
                <th className="text-left font-medium px-4 py-3">Semester / Subject</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((d) => {
                const at = new Date(d.deadline_at);
                const past = at.getTime() < Date.now();
                return (
                  <tr key={d.id} className={`hover:bg-muted/30 ${d.is_archived ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />{d.title}
                        {d.is_archived && <span className="ml-1 text-[10px] uppercase tracking-wider rounded bg-muted px-1.5 py-0.5">archived</span>}
                        {past && !d.is_archived && <span className="ml-1 text-[10px] uppercase tracking-wider rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 px-1.5 py-0.5">expired</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <div>{format(at, "MMM d, yyyy · h:mm a")}</div>
                      <div className="text-xs">{formatDistanceToNow(at, { addSuffix: true })}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div>{semById[d.semester_id]?.name ?? "—"}</div>
                      <div className="text-foreground/80">{subById[d.subject_id]?.name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => toggleArchive(d)}>
                        {d.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => remove(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </SuperShell>
  );
}
