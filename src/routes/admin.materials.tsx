import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Archive, ArchiveRestore, Download, FileText, Loader2, Pencil, Plus, Search, Trash2, Upload,
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
import { MATERIAL_TYPES, materialTypeLabel } from "@/lib/materials";
import { buildMaterialStoragePath, logActivity } from "@/lib/activity";

export const Route = createFileRoute("/admin/materials")({
  head: () => ({ meta: [{ title: "Materials — Admin" }] }),
  component: AdminMaterialsRoute,
});

type Material = {
  id: string; title: string; description: string | null; material_type: string;
  year: string | null; week_or_module: string | null;
  semester_id: string; subject_id: string;
  file_url: string; file_name: string | null;
  download_count: number; is_archived: boolean; created_at: string;
};

function AdminMaterialsRoute() {
  return (
    <AdminShell title="Materials" description="Upload lecture slides, notes, past papers and assignments.">
      {(ctx) => <MaterialsPage ctx={ctx} />}
    </AdminShell>
  );
}

function MaterialsPage({ ctx }: { ctx: AdminContext }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [open, setOpen] = useState(false);

  const subjectsQ = useQuery({
    queryKey: ["admin-subjects", ctx.semesterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects").select("id,name,code").eq("semester_id", ctx.semesterId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const materialsQ = useQuery({
    queryKey: ["admin-materials", ctx.semesterId, subject, type, showArchived],
    queryFn: async () => {
      let qb = supabase
        .from("materials")
        .select("id,title,description,material_type,year,week_or_module,semester_id,subject_id,file_url,file_name,download_count,is_archived,created_at")
        .eq("semester_id", ctx.semesterId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (subject !== "all") qb = qb.eq("subject_id", subject);
      if (type !== "all") qb = qb.eq("material_type", type);
      if (!showArchived) qb = qb.eq("is_archived", false);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });

  const subById = useMemo(
    () => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])),
    [subjectsQ.data],
  );

  const rows = useMemo(() => {
    const list = materialsQ.data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter((m) => m.title.toLowerCase().includes(n));
  }, [materialsQ.data, q]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-materials"] });

  const toggleArchive = async (m: Material) => {
    const { error } = await supabase.from("materials").update({ is_archived: !m.is_archived }).eq("id", m.id);
    if (error) return toast.error(error.message);
    await logActivity({
      action_type: "archive",
      description: `${m.is_archived ? "Restored" : "Archived"} material "${m.title}"`,
      target_type: "material", target_id: m.id,
      semester_id: m.semester_id, subject_id: m.subject_id,
    });
    toast.success(m.is_archived ? "Restored" : "Archived");
    refresh();
  };

  const remove = async (m: Material) => {
    if (!confirm(`Permanently delete "${m.title}"?`)) return;
    if (m.file_url) await supabase.storage.from("learning-materials").remove([m.file_url]);
    const { error } = await supabase.from("materials").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    await logActivity({
      action_type: "delete", description: `Deleted material "${m.title}"`,
      target_type: "material", target_id: m.id,
      semester_id: m.semester_id, subject_id: m.subject_id,
    });
    toast.success("Material deleted");
    refresh();
  };

  const downloadOne = async (m: Material) => {
    const { data, error } = await supabase.storage.from("learning-materials")
      .createSignedUrl(m.file_url, 60 * 5);
    if (error || !data) return toast.error(error?.message ?? "Cannot generate link");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const noSubjects = (subjectsQ.data ?? []).length === 0 && !subjectsQ.isLoading;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 justify-end mb-4">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} disabled={noSubjects}>
              <Plus className="mr-2 h-4 w-4" />Upload material
            </Button>
          </DialogTrigger>
          <MaterialDialog
            ctx={ctx}
            editing={editing}
            subjects={subjectsQ.data ?? []}
            onSaved={() => { setOpen(false); setEditing(null); refresh(); }}
          />
        </Dialog>
      </div>

      {noSubjects && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200 mb-4">
          This semester has no subjects yet. Ask a super admin to add subjects before uploading.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft mb-4">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {(subjectsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MATERIAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {materialsQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No materials yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Title</th>
                  <th className="text-left font-medium px-4 py-3">Type</th>
                  <th className="text-left font-medium px-4 py-3">Subject</th>
                  <th className="text-left font-medium px-4 py-3"><Download className="inline h-3.5 w-3.5" /></th>
                  <th className="text-left font-medium px-4 py-3">Uploaded</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((m) => (
                  <tr key={m.id} className={`hover:bg-muted/30 ${m.is_archived ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium inline-flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="break-words">{m.title}</span>
                        {m.is_archived && <span className="ml-1 text-[10px] uppercase tracking-wider rounded bg-muted px-1.5 py-0.5">archived</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground whitespace-nowrap">
                      {materialTypeLabel(m.material_type)}{m.year ? ` · ${m.year}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{subById[m.subject_id]?.name ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{m.download_count}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(m.created_at), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => downloadOne(m)} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleArchive(m)} title={m.is_archived ? "Restore" : "Archive"}>
                        {m.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => remove(m)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function MaterialDialog({
  ctx, editing, subjects, onSaved,
}: {
  ctx: AdminContext;
  editing: Material | null;
  subjects: { id: string; name: string; code: string | null }[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [subjectId, setSubjectId] = useState(editing?.subject_id ?? subjects[0]?.id ?? "");
  const [materialType, setMaterialType] = useState<string>(editing?.material_type ?? "lecture_slide");
  const [year, setYear] = useState(editing?.year ?? "");
  const [weekOrModule, setWeekOrModule] = useState(editing?.week_or_module ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!subjectId) return toast.error("Select a subject");
    if (!editing && !file) return toast.error("Choose a file to upload");
    if (file && file.size > 50 * 1024 * 1024) return toast.error("File must be under 50 MB");

    setSaving(true);
    try {
      let file_url: string = editing?.file_url ?? "";
      let file_name: string | null = editing?.file_name ?? null;
      let file_type: string | null = null;

      if (file) {
        setProgress("Uploading file…");
        const subject = subjects.find((s) => s.id === subjectId);
        const path = buildMaterialStoragePath({
          semesterSlug: ctx.semesterName,
          subjectSlug: subject?.name ?? "subject",
          materialType,
          fileName: file.name,
        });
        const { error: upErr } = await supabase.storage
          .from("learning-materials")
          .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (upErr) throw upErr;

        // Remove previous file when replacing
        if (editing?.file_url) {
          await supabase.storage.from("learning-materials").remove([editing.file_url]);
        }
        file_url = path;
        file_name = file.name;
        file_type = file.type;
      }

      setProgress("Saving…");
      if (editing) {
        const { error } = await supabase.from("materials").update({
          title: title.trim(),
          description: description.trim() || null,
          subject_id: subjectId,
          material_type: materialType,
          year: year.trim() || null,
          week_or_module: weekOrModule.trim() || null,
          ...(file ? { file_url, file_name, file_type } : {}),
        }).eq("id", editing.id);
        if (error) throw error;
        await logActivity({
          action_type: "edit",
          description: `Edited material "${title.trim()}"`,
          target_type: "material", target_id: editing.id,
          semester_id: ctx.semesterId, subject_id: subjectId,
        });
        toast.success("Material updated");
      } else {
        const { data, error } = await supabase.from("materials").insert({
          semester_id: ctx.semesterId,
          subject_id: subjectId,
          uploaded_by: ctx.userId,
          title: title.trim(),
          description: description.trim() || null,
          material_type: materialType,
          year: year.trim() || null,
          week_or_module: weekOrModule.trim() || null,
          file_url,
          file_name,
          file_type,
        }).select("id").maybeSingle();
        if (error) throw error;
        await logActivity({
          action_type: "upload",
          description: `Uploaded ${materialTypeLabel(materialType)}: "${title.trim()}"`,
          target_type: "material", target_id: data?.id ?? null,
          semester_id: ctx.semesterId, subject_id: subjectId,
        });
        toast.success("Material uploaded");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit material" : "Upload material"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 – Synchronous Machines" maxLength={140} />
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
            <label className="text-sm font-medium">Type</label>
            <Select value={materialType} onValueChange={setMaterialType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Year (optional)</label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2024" maxLength={20} />
          </div>
          <div>
            <label className="text-sm font-medium">Week / Module (optional)</label>
            <Input value={weekOrModule} onChange={(e) => setWeekOrModule(e.target.value)} placeholder="e.g. Week 3" maxLength={40} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Description (optional)</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
        </div>
        <div>
          <label className="text-sm font-medium">{editing ? "Replace file (optional)" : "File"}</label>
          <div
            onClick={() => inputRef.current?.click()}
            className="mt-1 cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors px-4 py-6 text-center"
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <div className="mt-2 text-sm">
              {file ? <span className="font-medium break-all">{file.name}</span> :
                editing?.file_name ? <span className="text-muted-foreground">Current: {editing.file_name}</span> :
                <span className="text-muted-foreground">Click to choose a file (max 50 MB)</span>}
            </div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {progress ?? (editing ? "Save changes" : "Upload")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
