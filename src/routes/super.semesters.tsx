import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/semesters")({
  head: () => ({ meta: [{ title: "Semesters — Super Admin" }] }),
  component: SemestersPage,
});

type Semester = { id: string; name: string; description: string | null; is_active: boolean };

function SemestersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Semester | null>(null);
  const [open, setOpen] = useState(false);

  const semsQ = useQuery({
    queryKey: ["super-semesters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semesters")
        .select("id,name,description,is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Semester[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["super-semesters"] });

  const toggleActive = async (s: Semester) => {
    const { error } = await supabase.from("semesters").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(`Semester ${!s.is_active ? "activated" : "deactivated"}`);
    refresh();
  };

  const remove = async (s: Semester) => {
    if (!confirm(`Delete "${s.name}"? Subjects and content under it will be removed.`)) return;
    const { error } = await supabase.from("semesters").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Semester deleted");
    refresh();
  };

  return (
    <SuperShell title="Semesters" description="Create and manage academic semesters.">
      <div className="flex justify-end mb-4">
        <Dialog
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />New semester</Button>
          </DialogTrigger>
          <SemesterDialog editing={editing} onSaved={() => { setOpen(false); setEditing(null); refresh(); }} />
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {semsQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
        ) : (semsQ.data ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No semesters yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Description</th>
                  <th className="text-left font-medium px-4 py-3">Active</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(semsQ.data ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md">{s.description || "—"}</td>
                    <td className="px-4 py-3"><Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} /></td>
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

function SemesterDialog({ editing, onSaved }: { editing: Semester | null; onSaved: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, is_active: isActive };
    const res = editing
      ? await supabase.from("semesters").update(payload).eq("id", editing.id)
      : await supabase.from("semesters").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Semester updated" : "Semester created");
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit semester" : "New semester"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Semester 5" maxLength={80} />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} id="act" />
          <label htmlFor="act" className="text-sm">Active (visible to students)</label>
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
