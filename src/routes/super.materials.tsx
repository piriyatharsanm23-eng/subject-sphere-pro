import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ArchiveRestore, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/super/materials")({
  head: () => ({ meta: [{ title: "Materials — Super Admin" }] }),
  component: MaterialsPage,
});

type Material = {
  id: string; title: string; material_type: string; year: string | null;
  semester_id: string; subject_id: string; file_url: string;
  is_archived: boolean; created_at: string;
};

function MaterialsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sem, setSem] = useState("all");
  const [type, setType] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => (await supabase.from("semesters").select("id,name").order("name")).data ?? [],
  });
  const subjectsQ = useQuery({
    queryKey: ["super-all-subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id,name,semester_id").order("name")).data ?? [],
  });

  const materialsQ = useQuery({
    queryKey: ["super-materials", sem, type, showArchived],
    queryFn: async () => {
      let qb = supabase
        .from("materials")
        .select("id,title,material_type,year,semester_id,subject_id,file_url,is_archived,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (sem !== "all") qb = qb.eq("semester_id", sem);
      if (type !== "all") qb = qb.eq("material_type", type);
      if (!showArchived) qb = qb.eq("is_archived", false);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });

  const subById = useMemo(() => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])), [subjectsQ.data]);
  const semById = useMemo(() => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])), [semestersQ.data]);

  const rows = useMemo(() => {
    const list = materialsQ.data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter((m) => m.title.toLowerCase().includes(n));
  }, [materialsQ.data, q]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["super-materials"] });

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

  return (
    <SuperShell title="All Materials" description="View, archive, restore or delete materials across every semester.">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft mb-4">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={sem} onValueChange={setSem}>
            <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {(semestersQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="slides">Slides</SelectItem>
              <SelectItem value="notes">Notes</SelectItem>
              <SelectItem value="papers">Papers</SelectItem>
              <SelectItem value="assignments">Assignments</SelectItem>
              <SelectItem value="other">Other</SelectItem>
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
          <div className="p-10 text-center text-muted-foreground">No materials match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Title</th>
                  <th className="text-left font-medium px-4 py-3">Type</th>
                  <th className="text-left font-medium px-4 py-3">Semester / Subject</th>
                  <th className="text-left font-medium px-4 py-3">Created</th>
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
                    <td className="px-4 py-3 capitalize text-muted-foreground whitespace-nowrap">{m.material_type}{m.year ? ` · ${m.year}` : ""}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div>{semById[m.semester_id]?.name ?? "—"}</div>
                      <div className="text-foreground/80">{subById[m.subject_id]?.name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(m.created_at), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => toggleArchive(m)}>
                        {m.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => remove(m)}>
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
