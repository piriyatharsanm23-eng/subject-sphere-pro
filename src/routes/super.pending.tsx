import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Check, Clock, Loader2, Trash2, X } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { approveChange, rejectChange } from "@/lib/pending-changes.functions";

export const Route = createFileRoute("/super/pending")({
  head: () => ({ meta: [{ title: "Pending changes — Super Admin" }] }),
  component: () => (
    <SuperShell title="Pending changes" description="Review admin edits and deletions before they go live for students.">
      <PendingPage />
    </SuperShell>
  ),
});

type Row = {
  id: string;
  entity_type: "material" | "deadline" | "kuppi";
  entity_id: string;
  action: "update" | "delete";
  proposed_data: any;
  snapshot: any;
  status: string;
  created_at: string;
  requested_by: string | null;
  semester_id: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
};

const ENTITY_LABEL: Record<Row["entity_type"], string> = {
  material: "Material",
  deadline: "Deadline",
  kuppi: "Kuppi",
};

function PendingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const doApprove = useServerFn(approveChange);
  const doReject = useServerFn(rejectChange);

  const pendingQ = useQuery({
    queryKey: ["super-pending", tab],
    queryFn: async () => {
      const q = supabase
        .from("pending_changes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = tab === "pending"
        ? await q.eq("status", "pending")
        : await q.in("status", ["approved", "rejected"]);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const requesterIds = useMemo(
    () => Array.from(new Set((pendingQ.data ?? []).map((r) => r.requested_by).filter(Boolean))) as string[],
    [pendingQ.data],
  );
  const profilesQ = useQuery({
    queryKey: ["super-pending-profiles", requesterIds.sort().join(",")],
    queryFn: async () => {
      if (requesterIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", requesterIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id.slice(0, 6); });
      return map;
    },
    enabled: requesterIds.length > 0,
  });

  const handle = async (id: string, kind: "approve" | "reject") => {
    try {
      if (kind === "approve") {
        await doApprove({ data: { pendingId: id } });
        toast.success("Change approved and applied");
      } else {
        const reason = window.prompt("Optional reason for rejection?") ?? undefined;
        await doReject({ data: { pendingId: id, reason: reason || undefined } });
        toast.success("Change rejected");
      }
      qc.invalidateQueries({ queryKey: ["super-pending"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <TabsList>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
      </TabsList>

      <TabsContent value={tab} className="mt-4">
        {pendingQ.isLoading ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (pendingQ.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {tab === "pending" ? "No pending changes right now." : "Nothing has been reviewed yet."}
          </div>
        ) : (
          <div className="grid gap-3">
            {(pendingQ.data ?? []).map((r) => (
              <PendingCard
                key={r.id}
                row={r}
                requester={r.requested_by ? profilesQ.data?.[r.requested_by] ?? "Admin" : "Admin"}
                onApprove={() => handle(r.id, "approve")}
                onReject={() => handle(r.id, "reject")}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function PendingCard({
  row, requester, onApprove, onReject,
}: {
  row: Row;
  requester: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const snap = row.snapshot ?? {};
  const proposed = row.proposed_data ?? {};
  const title = snap.title ?? snap.name ?? row.entity_id.slice(0, 8);

  const diffKeys = row.action === "update"
    ? Object.keys(proposed).filter((k) => JSON.stringify(proposed[k]) !== JSON.stringify(snap[k]))
    : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={row.action === "delete" ? "destructive" : "secondary"} className="capitalize">
              {row.action === "delete" ? <><Trash2 className="h-3 w-3 mr-1" /> Delete</> : "Edit"}
            </Badge>
            <Badge variant="outline">{ENTITY_LABEL[row.entity_type]}</Badge>
            {row.status !== "pending" && (
              <Badge variant={row.status === "approved" ? "default" : "outline"}>{row.status}</Badge>
            )}
          </div>
          <div className="mt-1.5 font-semibold truncate">{title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" /> Requested by {requester} · {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </div>
        </div>
        {row.status === "pending" && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={onReject}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button size="sm" onClick={onApprove}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
          </div>
        )}
      </div>

      {row.action === "update" && diffKeys.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Proposed changes</div>
          <div className="grid gap-2 text-sm">
            {diffKeys.map((k) => (
              <div key={k} className="grid gap-1 sm:grid-cols-[120px_1fr]">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="min-w-0">
                  <div className="text-xs text-rose-500 line-through break-words">{fmt(snap[k])}</div>
                  <div className="text-xs text-emerald-500 break-words">{fmt(proposed[k])}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {row.action === "delete" && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-500">
          Students no longer see this item. Approving will permanently delete it. Rejecting will restore it.
        </div>
      )}

      {row.reject_reason && (
        <div className="mt-3 text-xs text-muted-foreground">Reason: {row.reject_reason}</div>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}
