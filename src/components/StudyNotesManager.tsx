import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, Eye, ExternalLink, Loader2, NotebookPen, Pencil, Plus, Save, Search, Send, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { NoteMarkdown } from "@/components/NoteMarkdown";
import { slugify, type StudyNote } from "@/lib/notes";
import { logActivity } from "@/lib/activity";

type Subject = { id: string; name: string; code: string | null };
type MaterialRef = { id: string; title: string; subject_id: string };

const STARTER = `## Introduction

Write the note in Markdown. Use **bold**, lists and tables.

## Key formula

Inline maths like $E = mc^2$, or a display block:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

### Worked example

1. Step one
2. Step two
`;

export function StudyNotesManager({
  semesterId,
  semesters,
  onSemesterChange,
}: {
  semesterId: string;
  semesters?: Array<{ id: string; name: string }>;
  onSemesterChange?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<StudyNote> | null>(null);

  const subjectsQ = useQuery({
    queryKey: ["notes-subjects", semesterId],
    enabled: !!semesterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects").select("id,name,code").eq("semester_id", semesterId).order("name");
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  const materialsQ = useQuery({
    queryKey: ["notes-materials", semesterId],
    enabled: !!semesterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials").select("id,title,subject_id")
        .eq("semester_id", semesterId).eq("is_archived", false).eq("pending_delete", false)
        .order("title");
      if (error) throw error;
      return (data ?? []) as MaterialRef[];
    },
  });

  const notesQ = useQuery({
    queryKey: ["manage-study-notes", semesterId, subjectFilter],
    enabled: !!semesterId,
    queryFn: async () => {
      let qb = (supabase as any)
        .from("study_notes")
        .select("id,title,slug,chapter,description,content,order_index,published,subject_id,semester_id,material_id,created_at,updated_at")
        .eq("semester_id", semesterId)
        .order("order_index", { ascending: true })
        .order("title", { ascending: true });
      if (subjectFilter !== "all") qb = qb.eq("subject_id", subjectFilter);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as StudyNote[];
    },
  });

  const subById = useMemo(
    () => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])),
    [subjectsQ.data],
  );

  const rows = useMemo(() => {
    const list = notesQ.data ?? [];
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter((x) => x.title.toLowerCase().includes(n) || (x.chapter ?? "").toLowerCase().includes(n));
  }, [notesQ.data, q]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["manage-study-notes"] });
    qc.invalidateQueries({ queryKey: ["study-notes-index"] });
    qc.invalidateQueries({ queryKey: ["study-notes-nav"] });
  };

  const swapOrder = async (note: StudyNote, dir: -1 | 1) => {
    const siblings = (notesQ.data ?? []).filter((n) => n.subject_id === note.subject_id);
    const i = siblings.findIndex((n) => n.id === note.id);
    const other = siblings[i + dir];
    if (!other) return;
    const a = note.order_index ?? 0;
    const b = other.order_index ?? 0;
    const [na, nb] = a === b ? [dir < 0 ? b - 1 : b + 1, b] : [b, a];
    const { error } = await (supabase as any).from("study_notes").upsert([
      { id: note.id, order_index: na },
      { id: other.id, order_index: nb },
    ]);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (note: StudyNote) => {
    if (!confirm(`Delete the study note "${note.title}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("study_notes").delete().eq("id", note.id);
    if (error) return toast.error(error.message);
    await logActivity({
      action_type: "delete",
      description: `Deleted study note "${note.title}"`,
      target_type: "study_note", target_id: note.id,
      semester_id: note.semester_id, subject_id: note.subject_id,
    });
    toast.success("Study note deleted");
    refresh();
  };

  const togglePublish = async (note: StudyNote) => {
    const { error } = await (supabase as any)
      .from("study_notes").update({ published: !note.published }).eq("id", note.id);
    if (error) return toast.error(error.message);
    toast.success(note.published ? "Moved back to draft" : "Published");
    refresh();
  };

  const noSubjects = !subjectsQ.isLoading && (subjectsQ.data ?? []).length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {semesters && onSemesterChange && (
          <Select value={semesterId} onValueChange={onSemesterChange}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="pl-9" />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="All subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {(subjectsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setEditing({ content: STARTER, published: false, order_index: (notesQ.data?.length ?? 0) + 1 })}
          disabled={noSubjects}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />New note
        </Button>
      </div>

      {noSubjects && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Add a subject to this semester first — study notes belong to a subject.
        </p>
      )}

      {notesQ.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <NotebookPen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">No study notes yet. Create your first one.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className="rounded-xl border border-border bg-card p-3 shadow-soft">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{n.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      n.published ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}>
                      {n.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {subById[n.subject_id]?.name ?? "Subject"}{n.chapter ? ` · ${n.chapter}` : ""} · /{n.slug}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="Move up" onClick={() => swapOrder(n, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Move down" onClick={() => swapOrder(n, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  {n.published && (
                    <Button variant="ghost" size="icon" aria-label="Open note" asChild>
                      <a
                        href={`/notes/${slugify(subById[n.subject_id]?.name ?? "subject")}/${n.slug}`}
                        target="_blank" rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => togglePublish(n)}>
                    {n.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Edit note" onClick={() => setEditing(n)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete note" onClick={() => remove(n)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <NoteEditorDialog
          note={editing}
          semesterId={semesterId}
          subjects={subjectsQ.data ?? []}
          materials={materialsQ.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function NoteEditorDialog({
  note, semesterId, subjects, materials, onClose, onSaved,
}: {
  note: Partial<StudyNote>;
  semesterId: string;
  subjects: Subject[];
  materials: MaterialRef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note.title ?? "");
  const [slug, setSlug] = useState(note.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!note.slug);
  const [chapter, setChapter] = useState(note.chapter ?? "");
  const [description, setDescription] = useState(note.description ?? "");
  const [subjectId, setSubjectId] = useState(note.subject_id ?? subjects[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(note.material_id ?? "none");
  const [orderIndex, setOrderIndex] = useState(String(note.order_index ?? 1));
  const [content, setContent] = useState(note.content ?? STARTER);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Load a .md / .txt file straight into the editor. */
  const importFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("That file is too big (max 2 MB)");
    const text = await file.text();
    if (!text.trim()) return toast.error("That file is empty");
    setContent(text);
    if (!title.trim()) {
      const heading = /^#{1,3}\s+(.+)$/m.exec(text)?.[1]?.trim();
      const fromName = file.name.replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]+/g, " ").trim();
      setTitle(heading || fromName);
    }
    toast.success(`Loaded "${file.name}"`);
  };

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const subjectMaterials = materials.filter((m) => m.subject_id === subjectId);

  const save = async (publish: boolean) => {
    if (!title.trim()) return toast.error("Give the note a title");
    if (!subjectId) return toast.error("Pick a subject");
    const finalSlug = slugify(slug || title);
    if (!finalSlug) return toast.error("Give the note a valid web address");

    setSaving(true);
    const payload = {
      semester_id: semesterId,
      subject_id: subjectId,
      material_id: materialId === "none" ? null : materialId,
      title: title.trim(),
      slug: finalSlug,
      chapter: chapter.trim() || null,
      description: description.trim() || null,
      content,
      order_index: Number(orderIndex) || 0,
      published: publish,
    };

    const res = note.id
      ? await (supabase as any).from("study_notes").update(payload).eq("id", note.id).select("id").maybeSingle()
      : await (supabase as any).from("study_notes").insert(payload).select("id").maybeSingle();
    setSaving(false);

    if (res.error) {
      const msg = /duplicate key|unique/i.test(res.error.message)
        ? "Another note already uses that web address — change the address."
        : res.error.message;
      return toast.error(msg);
    }

    await logActivity({
      action_type: note.id ? "edit" : "upload",
      description: `${note.id ? "Updated" : "Created"} study note "${payload.title}"${publish ? " (published)" : " (draft)"}`,
      target_type: "study_note", target_id: res.data?.id ?? note.id ?? null,
      semester_id: semesterId, subject_id: subjectId,
    });
    toast.success(publish ? "Study note published" : "Saved as draft");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[96vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{note.id ? "Edit study note" : "New study note"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="note-title">Title</Label>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fourier Series" />
          </div>
          <div>
            <Label htmlFor="note-slug">Web address</Label>
            <Input
              id="note-slug"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
              placeholder="fourier-series"
            />
          </div>
          <div>
            <Label htmlFor="note-chapter">Chapter (optional)</Label>
            <Input id="note-chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Chapter 3" />
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setMaterialId("none"); }}>
              <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Related PDF (optional)</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {subjectMaterials.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="note-order">Order</Label>
            <Input id="note-order" type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="note-desc">Short description (optional)</Label>
            <Input id="note-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this note covers" />
          </div>
        </div>

        <Tabs defaultValue="write" className="mt-2">
          <TabsList>
            <TabsTrigger value="write"><Pencil className="mr-2 h-4 w-4" aria-hidden="true" />Write</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="mr-2 h-4 w-4" aria-hidden="true" />Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <div
              className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); importFile(e.dataTransfer.files?.[0]); }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />Upload a .md file
              </Button>
              <span className="text-xs text-muted-foreground">
                Or drag a Markdown (.md) or text file here — it replaces what's below.
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              spellCheck={false}
              className="font-mono text-sm"
              placeholder="Write in Markdown. Use $...$ for maths."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Markdown supported. Maths: <code>$x^2$</code> inline, <code>$$…$$</code> on its own lines.
            </p>
          </TabsContent>
          <TabsContent value="preview">
            <div className="max-h-[50dvh] overflow-y-auto rounded-xl border border-border bg-card p-5">
              <NoteMarkdown content={content} />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
            Save as draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
