import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookPlus, Loader2, Plus, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminShell, type AdminContext } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
  created_at: string;
};

export const Route = createFileRoute("/admin/modules")({
  head: () => ({ meta: [{ title: "Module requests — StudyHub" }] }),
  component: () => (
    <AdminShell
      title="Module requests"
      description="Ask the super admin to add a new module (subject) to any semester you admin."
    >
      {(ctx) => <Body ctx={ctx} />}
    </AdminShell>
  ),
});

function Body({ ctx }: { ctx: AdminContext }) {
  const qc = useQueryClient();

  const requestsQ = useQuery({
    queryKey: ["admin-module-requests", ctx.userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("module_requests")
        .select("id,semester_id,name,code,description,reason,status,reviewer_note,reviewed_at,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ModuleRequest[];
    },
  });

  const sems = ctx.semesters;
  const semNames = Object.fromEntries(sems.map((s) => [s.id, s.name]));

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("module_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request withdrawn");
      qc.invalidateQueries({ queryKey: ["admin-module-requests"] });
    },
    onError: (e: Error) => toast.error("Couldn't withdraw", { description: e.message }),
  });

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Submit a module request and the super admin will review it. Once accepted, the
          subject is created automatically and you can start uploading materials to it.
        </p>
        <NewRequestDialog defaultSemesterId={ctx.semesterId} semesters={sems} />
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <BookPlus className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">My requests</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {requestsQ.data?.length ?? 0} total
          </span>
        </div>
        {requestsQ.isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (requestsQ.data ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No module requests yet. Click <b>Request module</b> to send your first one.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(requestsQ.data ?? []).map((r) => (
              <li key={r.id} className="p-5 flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">
                      {semNames[r.semester_id] ?? "Unknown semester"}
                    </span>
                  </div>
                  <div className="mt-1 font-semibold">
                    {r.code ? `${r.code} · ` : ""}{r.name}
                  </div>
                  {r.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                  {r.reason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-semibold">Reason:</span> {r.reason}
                    </p>
                  )}
                  {r.reviewer_note && (
                    <p className="mt-1 text-xs">
                      <span className="font-semibold">Reviewer note:</span> {r.reviewer_note}
                    </p>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    Sent {format(new Date(r.created_at), "MMM d, yyyy")}
                    {r.reviewed_at && ` · Reviewed ${format(new Date(r.reviewed_at), "MMM d, yyyy")}`}
                  </div>
                </div>
                {r.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => del.mutate(r.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Withdraw
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
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

function NewRequestDialog({
  defaultSemesterId,
  semesters,
}: {
  defaultSemesterId: string;
  semesters: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [semesterId, setSemesterId] = useState(defaultSemesterId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error("Not signed in");
      if (!name.trim()) throw new Error("Module name is required");
      const { error } = await (supabase as any).from("module_requests").insert({
        semester_id: semesterId,
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        reason: reason.trim() || null,
        requested_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent to super admin");
      qc.invalidateQueries({ queryKey: ["admin-module-requests"] });
      setOpen(false);
      setName(""); setCode(""); setDescription(""); setReason("");
    },
    onError: (e: Error) => toast.error("Couldn't submit", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Request module
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a new module</DialogTitle>
          <DialogDescription>
            The super admin will review this. Accepted requests create the subject automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Semester</Label>
            <Select value={semesterId} onValueChange={setSemesterId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Module name*</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Digital Signal Processing" />
          </div>
          <div className="grid gap-1.5">
            <Label>Module code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. EE3074" />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short summary of the module" />
          </div>
          <div className="grid gap-1.5">
            <Label>Reason for the request</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why should this module be added now?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
