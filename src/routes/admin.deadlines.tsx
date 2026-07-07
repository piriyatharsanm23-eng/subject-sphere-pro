import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Archive, ArchiveRestore, CalendarClock, Loader2, Paperclip,
  Pencil, Plus, Search, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminShell, type AdminContext } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { buildMaterialStoragePath, logActivity } from "@/lib/activity";
import { notifyDeadlineCreated } from "@/lib/notify-deadline.functions";

export const Route = createFileRoute("/admin/deadlines")({
  head: () => ({ meta: [{ title: "Deadlines — Admin" }] }),
  component: AdminDeadlinesRoute,
});

type Deadline = {
  id: string; title: string; description: string | null;
  deadline_at: string; attachment_url: string | null;
  semester_id: string; subject_id: string;
  status: string; is_archived: boolean;
};

function AdminDeadlinesRoute() {
  return (
    <AdminShell title="Deadlines" description="Publish and manage deadlines for your semester.">
      {(ctx) => <DeadlinesPage ctx={ctx} />}
    </AdminShell>
  );
}

function DeadlinesPage({ ctx }: { ctx: AdminContext }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [open, setOpen] = useState(false);

  const subjectsQ = useQuery({
    queryKey: ["admin-subjects", ctx.semesterId],
    queryFn: async () => (await supabase
      .from("subjects").select("id,name,code").eq("semester_id", ctx.semesterId).order("name")).data ?? [],
  });

  const listQ = useQuery({
    queryKey: ["admin-deadlines", ctx.semesterId, subject, showArchived],
    queryFn: async () => {
      let qb = supabase
        .from("deadlines")
        .select("id,title,description,deadline_at,attachment_url,semester_id,subject_id,status,is_archived")
        .eq("semester_id", ctx.semesterId)
        .order("deadline_at", { ascending: true })
        .limit(500);
      if (subject !== "all") qb = qb.eq("subject_id", subject);
      if (!showArchived) qb = qb.eq("is_archived", false);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Deadline[];
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
    return list.filter((d) => d.title.toLowerCase().includes(n));
  }, [listQ.data, q]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-deadlines"] });

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
    if (d.attachment_url) await supabase.storage.from("learning-materials").remove([d.attachment_url]);
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

  const noSubjects = (subjectsQ.data ?? []).length === 0 && !subjectsQ.isLoading;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} disabled={noSubjects}>
              <Plus className="mr-2 h-4 w-4" />New deadline
            </Button>
          </DialogTrigger>
          <DeadlineDialog
            ctx={ctx}
            editing={editing}
            subjects={subjectsQ.data ?? []}
            onSaved={() => { setOpen(false); setEditing(null); refresh(); }}
          />
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft mb-4">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search deadlines…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {(subjectsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
          <div className="p-10 text-center text-muted-foreground">No deadlines yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Deadline</th>
                  <th className="text-left font-medium px-4 py-3">When</th>
                  <th className="text-left font-medium px-4 py-3">Subject</th>
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
                        <div className="font-medium inline-flex items-center gap-2 flex-wrap">
                          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="break-words">{d.title}</span>
                          {d.attachment_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                          {d.is_archived && <span className="text-[10px] uppercase tracking-wider rounded bg-muted px-1.5 py-0.5">archived</span>}
                          {past && !d.is_archived && <span className="text-[10px] uppercase tracking-wider rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 px-1.5 py-0.5">expired</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <div>{format(at, "MMM d, yyyy · h:mm a")}</div>
                        <div className="text-xs">{formatDistanceToNow(at, { addSuffix: true })}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{subById[d.subject_id]?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
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
          </div>
        )}
      </div>
    </>
  );
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DeadlineDialog({
  ctx, editing, subjects, onSaved,
}: {
  ctx: AdminContext;
  editing: Deadline | null;
  subjects: { id: string; name: string; code: string | null }[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [subjectId, setSubjectId] = useState(editing?.subject_id ?? subjects[0]?.id ?? "");
  const [when, setWhen] = useState(toLocalInput(editing?.deadline_at ?? null));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!subjectId) return toast.error("Select a subject");
    if (!when) return toast.error("Pick a due date and time");
    if (file && file.size > 25 * 1024 * 1024) return toast.error("Attachment must be under 25 MB");

    setSaving(true);
    try {
      let attachment_url = editing?.attachment_url ?? null;
      if (file) {
        const subject = subjects.find((s) => s.id === subjectId);
        const path = buildMaterialStoragePath({
          semesterSlug: ctx.semesterId,
          subjectSlug: subject?.name ?? "subject",
          materialType: "deadline",
          fileName: file.name,
        });
        const { error: upErr } = await supabase.storage
          .from("learning-materials")
          .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        if (editing?.attachment_url) {
          await supabase.storage.from("learning-materials").remove([editing.attachment_url]);
        }
        attachment_url = path;
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        subject_id: subjectId,
        deadline_at: new Date(when).toISOString(),
        attachment_url,
      };

      if (editing) {
        const { error } = await supabase.from("deadlines").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logActivity({
          action_type: "deadline_edit",
          description: `Edited deadline "${title.trim()}"`,
          target_type: "deadline", target_id: editing.id,
          semester_id: ctx.semesterId, subject_id: subjectId,
        });
        toast.success("Deadline updated");
      } else {
        const { data, error } = await supabase.from("deadlines").insert({
          ...payload,
          semester_id: ctx.semesterId,
          created_by: ctx.userId,
          status: "active",
        }).select("id").maybeSingle();
        if (error) throw error;
        await logActivity({
          action_type: "deadline_create",
          description: `Created deadline "${title.trim()}"`,
          target_type: "deadline", target_id: data?.id ?? null,
          semester_id: ctx.semesterId, subject_id: subjectId,
        });
        toast.success("Deadline created");
        if (data?.id) {
          try {
            const res = await notifyDeadlineCreated({ data: { deadlineId: data.id } });
            if (res?.sent) toast.success(`Notified ${res.sent} Telegram subscriber${res.sent === 1 ? "" : "s"}`);
          } catch (err) {
            console.error("telegram notify failed", err);
          }
        }
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit deadline" : "New deadline"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="e.g. Assignment 2 submission" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Subject</label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Due at</label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Description (optional)</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={800} />
        </div>
        <div>
          <label className="text-sm font-medium">Attachment (optional)</label>
          <div
            onClick={() => inputRef.current?.click()}
            className="mt-1 cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors px-4 py-5 text-center"
          >
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <div className="mt-2 text-sm">
              {file ? <span className="font-medium break-all">{file.name}</span> :
                editing?.attachment_url ? <span className="text-muted-foreground">Current attachment kept</span> :
                <span className="text-muted-foreground">Click to attach a file</span>}
            </div>
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editing ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
