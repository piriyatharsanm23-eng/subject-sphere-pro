import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/subjects")({
  head: () => ({ meta: [{ title: "Subjects — Super Admin" }] }),
  component: SubjectsPage,
});

type Subject = { id: string; name: string; code: string | null; description: string | null; semester_id: string };
type Semester = { id: string; name: string };

function SubjectsPage() {
  const qc = useQueryClient();
  const [semFilter, setSemFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [open, setOpen] = useState(false);

  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("semesters").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Semester[];
    },
  });

  const subjectsQ = useQuery({
    queryKey: ["super-subjects", semFilter],
    queryFn: async () => {
      let qb = supabase.from("subjects").select("id,name,code,description,semester_id").order("name");
      if (semFilter !== "all") qb = qb.eq("semester_id", semFilter);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  const semNameById = useMemo(
    () => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s.name])),
    [semestersQ.data],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["super-subjects"] });

  const remove = async (s: Subject) => {
    if (!confirm(`Delete "${s.name}"? Materials and deadlines under it will be removed.`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Subject deleted");
    refresh();
  };

  return (
    <SuperShell title="Subjects" description="Manage subjects under each semester.">
      <div className="flex flex-wrap gap-3 items-end justify-between mb-4">
        <div className="w-60">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Semester</label>
          <Select value={semFilter} onValueChange={setSemFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {(semestersQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />New subject</Button>
          </DialogTrigger>
          <SubjectDialog
            editing={editing}
            semesters={semestersQ.data ?? []}
            defaultSemester={semFilter !== "all" ? semFilter : undefined}
            onSaved={() => { setOpen(false); setEditing(null); refresh(); }}
          />
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {subjectsQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
        ) : (subjectsQ.data ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No subjects yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Subject</th>
                  <th className="text-left font-medium px-4 py-3">Code</th>
                  <th className="text-left font-medium px-4 py-3">Semester</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(subjectsQ.data ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      {s.description && <div className="text-xs text-muted-foreground line-clamp-1">{s.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.code || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{semNameById[s.semester_id] ?? "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => remove(s)}>
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
    </SuperShell>
  );
}

function SubjectDialog({
  editing, semesters, defaultSemester, onSaved,
}: {
  editing: Subject | null;
  semesters: Semester[];
  defaultSemester?: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [semesterId, setSemesterId] = useState(editing?.semester_id ?? defaultSemester ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!semesterId) return toast.error("Choose a semester");
    setSaving(true);
    const payload = {
      name: name.trim(), code: code.trim() || null,
      description: description.trim() || null, semester_id: semesterId,
    };
    const res = editing
      ? await supabase.from("subjects").update(payload).eq("id", editing.id)
      : await supabase.from("subjects").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Subject updated" : "Subject created");
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit subject" : "New subject"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Semester</label>
          <Select value={semesterId} onValueChange={setSemesterId}>
            <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
            <SelectContent>
              {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <label className="text-sm font-medium">Code</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder="CS-301" />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editing ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
