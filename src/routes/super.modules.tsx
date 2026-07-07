import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookPlus, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { SuperShell } from "@/components/SuperShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

type ModuleRequest = {
  id: string;
  semester_id: string;
  name: string;
  code: string | null;
  description: string | null;
  reason: string | null;
  status: "pending" | "accepted" | "rejected";
  reviewer_note: string | null;
  reviewed_at: string | null;
  requested_by: string;
  created_at: string;
  created_subject_id: string | null;
};

export const Route = createFileRoute("/super/modules")({
  head: () => ({ meta: [{ title: "Module requests — Super admin" }] }),
  component: () => (
    <SuperShell
      title="Module requests"
      description="Review admin requests for new modules. Accepting a request auto-creates the subject."
    >
      <Body />
    </SuperShell>
  ),
});

function Body() {
  const qc = useQueryClient();

  const reqsQ = useQuery({
    queryKey: ["super-module-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("module_requests")
        .select("id,semester_id,name,code,description,reason,status,reviewer_note,reviewed_at,requested_by,created_at,created_subject_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ModuleRequest[];
    },
  });

  const semsQ = useQuery({
    queryKey: ["super-module-semesters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("semesters").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profsQ = useQuery({
    queryKey: ["super-module-requester-profiles", (reqsQ.data ?? []).map((r) => r.requested_by).join(",")],
    enabled: (reqsQ.data ?? []).length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((reqsQ.data ?? []).map((r) => r.requested_by)));
      const { data, error } = await (supabase as any)
        .from("public_profile_info")
        .select("id,full_name")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id] = p.full_name ?? "Admin";
      return map;
    },
  });

  const semNames = Object.fromEntries((semsQ.data ?? []).map((s) => [s.id, s.name]));
  const names = profsQ.data ?? {};

  const all = reqsQ.data ?? [];
  const pending = all.filter((r) => r.status === "pending");
  const reviewed = all.filter((r) => r.status !== "pending");

  const decide = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "accepted" | "rejected"; note?: string }) => {
      const { error } = await (supabase as any)
        .from("module_requests")
        .update({ status, reviewer_note: note ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === "accepted"
          ? "Approved — subject created automatically"
          : "Request rejected"
      );
      qc.invalidateQueries({ queryKey: ["super-module-requests"] });
    },
    onError: (e: Error) => toast.error("Couldn't update", { description: e.message }),
  });

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
        <TabsTrigger value="reviewed">Reviewed ({reviewed.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="pending" className="mt-4">
        <List items={pending} semNames={semNames} names={names} onDecide={decide.mutate} loading={reqsQ.isLoading} />
      </TabsContent>
      <TabsContent value="reviewed" className="mt-4">
        <List items={reviewed} semNames={semNames} names={names} loading={reqsQ.isLoading} />
      </TabsContent>
    </Tabs>
  );
}

function List({
  items, semNames, names, onDecide, loading,
}: {
  items: ModuleRequest[];
  semNames: Record<string, string>;
  names: Record<string, string>;
  onDecide?: (v: { id: string; status: "accepted" | "rejected"; note?: string }) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Nothing here.
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {items.map((r) => (
        <Row key={r.id} r={r} semNames={semNames} names={names} onDecide={onDecide} />
      ))}
    </div>
  );
}

function Row({
  r, semNames, names, onDecide,
}: {
  r: ModuleRequest;
  semNames: Record<string, string>;
  names: Record<string, string>;
  onDecide?: (v: { id: string; status: "accepted" | "rejected"; note?: string }) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [name, setName] = useState(r.name);
  const [code, setCode] = useState(r.code ?? "");
  const [description, setDescription] = useState(r.description ?? "");
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  const acceptWithEdits = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("module_requests")
        .update({
          name: name.trim() || r.name,
          code: code.trim() || null,
          description: description.trim() || null,
          reviewer_note: note.trim() || null,
          status: "accepted",
        })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approved — subject created");
      qc.invalidateQueries({ queryKey: ["super-module-requests"] });
      setAcceptOpen(false);
    },
    onError: (e: Error) => toast.error("Couldn't approve", { description: e.message }),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={r.status} />
            <span className="text-xs text-muted-foreground">
              {semNames[r.semester_id] ?? "Unknown semester"} · by {names[r.requested_by] ?? "Admin"}
            </span>
          </div>
          <div className="mt-1 font-semibold flex items-center gap-2">
            <BookPlus className="h-4 w-4 text-primary" />
            {r.code ? `${r.code} · ` : ""}{r.name}
          </div>
          {r.description && (
            <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
          )}
          {r.reason && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-semibold">Reason:</span> {r.reason}
            </p>
          )}
          {r.reviewer_note && (
            <p className="mt-1 text-xs">
              <span className="font-semibold">Note:</span> {r.reviewer_note}
            </p>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            Sent {format(new Date(r.created_at), "MMM d, yyyy 'at' h:mm a")}
            {r.reviewed_at && ` · Reviewed ${format(new Date(r.reviewed_at), "MMM d, yyyy")}`}
          </div>
        </div>
        {onDecide && r.status === "pending" && (
          <div className="flex gap-2">
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
              <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject this module request</DialogTitle>
                  <DialogDescription>Add an optional note visible to the admin.</DialogDescription>
                </DialogHeader>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Reason (optional)" />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDecide({ id: r.id, status: "rejected", note });
                      setRejectOpen(false);
                    }}
                  >
                    Reject
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
              <Button size="sm" onClick={() => setAcceptOpen(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve & create subject</DialogTitle>
                  <DialogDescription>
                    Review the details — a new subject will be added to{" "}
                    <b>{semNames[r.semester_id] ?? "the semester"}</b> immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Code</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Note to admin (optional)</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setAcceptOpen(false)}>Cancel</Button>
                  <Button onClick={() => acceptWithEdits.mutate()} disabled={acceptWithEdits.isPending}>
                    {acceptWithEdits.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Approve
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ModuleRequest["status"] }) {
  const map = {
    pending: { icon: Clock, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300", label: "Pending" },
    accepted: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", label: "Accepted" },
    rejected: { icon: XCircle, cls: "bg-rose-500/15 text-rose-600 dark:text-rose-300", label: "Rejected" },
  } as const;
  const s = map[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}
