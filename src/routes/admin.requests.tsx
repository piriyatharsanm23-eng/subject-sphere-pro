import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { materialIssueLabel } from "@/components/ReportMaterialButton";
import { ExternalLink } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminShell, type AdminContext } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/admin/requests")({
  head: () => ({ meta: [{ title: "Requests — Admin" }] }),
  component: () => (
    <AdminShell title="Student requests" description="View and respond to student requests for your semester.">
      {(ctx) => <RequestsPage ctx={ctx} />}
    </AdminShell>
  ),
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

function RequestsPage({ ctx }: { ctx: AdminContext }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const subjectsQ = useQuery({
    queryKey: ["admin-subjects", ctx.semesterId],
    queryFn: async () => (await supabase.from("subjects").select("id,name").eq("semester_id", ctx.semesterId)).data ?? [],
  });

  const listQ = useQuery({
    queryKey: ["admin-requests", ctx.semesterId, status],
    queryFn: async () => {
      let qb = supabase
        .from("student_requests")
        .select("id,request_text,status,semester_id,subject_id,created_at")
        .eq("semester_id", ctx.semesterId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (status !== "all") qb = qb.eq("status", status);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const subById = useMemo(
    () => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])),
    [subjectsQ.data],
  );

  const rows = useMemo(() => {
    const list = listQ.data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter((r) => r.request_text.toLowerCase().includes(n));
  }, [listQ.data, q]);

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
    qc.invalidateQueries({ queryKey: ["admin-requests"] });
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft mb-4">
        <div className="grid gap-2 md:grid-cols-2">
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
                {r.subject_id && <> · {subById[r.subject_id]?.name}</>}
              </div>
              <div className="mt-3">
                <Select value={r.status} onValueChange={(v) => updateStatus(r, v)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
