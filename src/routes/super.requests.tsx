import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquare, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/super/requests")({
  head: () => ({ meta: [{ title: "Requests — Super Admin" }] }),
  component: RequestsPage,
});

type Req = {
  id: string; request_text: string; status: string;
  semester_id: string | null; subject_id: string | null; created_at: string;
};


const STATUSES = ["pending", "in_review", "resolved", "rejected"] as const;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  in_review: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function RequestsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sem, setSem] = useState("all");

  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => (await supabase.from("semesters").select("id,name").order("name")).data ?? [],
  });
  const subjectsQ = useQuery({
    queryKey: ["super-all-subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id,name,semester_id")).data ?? [],
  });

  const listQ = useQuery({
    queryKey: ["super-requests", status, sem],
    queryFn: async () => {
      let qb = supabase
        .from("student_requests")
        .select("id,request_text,status,semester_id,subject_id,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (status !== "all") qb = qb.eq("status", status);
      if (sem !== "all") qb = qb.eq("semester_id", sem);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const semById = useMemo(() => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])), [semestersQ.data]);
  const subById = useMemo(() => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])), [subjectsQ.data]);

  const rows = useMemo(() => {
    const list = listQ.data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter((r) => r.request_text.toLowerCase().includes(n));
  }, [listQ.data, q]);


  const refresh = () => qc.invalidateQueries({ queryKey: ["super-requests"] });

  const updateStatus = async (r: Req, next: string) => {
    const { error } = await supabase.from("student_requests").update({ status: next }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await logActivity({
      action_type: "request_status_change",
      description: `Request status: ${r.status} → ${next}`,
      target_type: "student_request", target_id: r.id,
      semester_id: r.semester_id, subject_id: r.subject_id,
    });
    toast.success("Status updated");
    refresh();
  };

  const remove = async (r: Req) => {
    if (!confirm("Delete this request?")) return;
    const { error } = await supabase.from("student_requests").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return (
    <SuperShell title="Student Requests" description="Triage requests and update their status.">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft mb-4">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sem} onValueChange={setSem}>
            <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {(semestersQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {listQ.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">No requests.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Anonymous</span>

                    <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${STATUS_STYLE[r.status] ?? ""}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{r.request_text}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "MMM d, yyyy · h:mm a")} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    {r.semester_id && <> · {semById[r.semester_id]?.name}</>}
                    {r.subject_id && <> · {subById[r.subject_id]?.name}</>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Select value={r.status} onValueChange={(v) => updateStatus(r, v)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="ml-auto text-rose-400 hover:text-rose-300" onClick={() => remove(r)}>
                  <Trash2 className="h-4 w-4 mr-1" />Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </SuperShell>
  );
}
