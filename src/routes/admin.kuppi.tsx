import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Video, Loader2, Plus, Trash2, Pencil, ExternalLink, Search, Upload, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminShell, type AdminContext } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { KUPPI_MEDIUMS, mediumLabel } from "@/lib/kuppi";
import { requestDelete, requestUpdate } from "@/lib/pending-changes.functions";
import { useServerFn } from "@tanstack/react-start";

type Kuppi = {
  id: string;
  semester_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  sections_covered: string | null;
  medium: string;
  video_url: string;
  presenter_name: string;
  presenter_photo_url: string | null;
  created_at: string;
};

export const Route = createFileRoute("/admin/kuppi")({
  head: () => ({ meta: [{ title: "Kuppi videos — Admin" }] }),
  component: () => (
    <AdminShell
      title="Kuppi videos"
      description="Add peer-led revision sessions in Sinhala, Tamil or English."
    >
      {(ctx) => <Body ctx={ctx} />}
    </AdminShell>
  ),
});

function Body({ ctx }: { ctx: AdminContext }) {
  const qc = useQueryClient();
  const doRequestDelete = useServerFn(requestDelete);
  const doRequestUpdate = useServerFn(requestUpdate);
  const [q, setQ] = useState("");
  const [med, setMed] = useState<string>("all");
  const [editing, setEditing] = useState<Kuppi | null>(null);
  const [open, setOpen] = useState(false);

  const subjectsQ = useQuery({
    queryKey: ["admin-kuppi-subjects", ctx.semesterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects").select("id,name,code").eq("semester_id", ctx.semesterId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const kuppiQ = useQuery({
    queryKey: ["admin-kuppi", ctx.semesterId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kuppi_videos")
        .select("*").eq("pending_delete", false)
        .eq("semester_id", ctx.semesterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Kuppi[];
    },
  });

  const subById = useMemo(
    () => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])),
    [subjectsQ.data],
  );

  const rows = useMemo(() => {
    let list = kuppiQ.data ?? [];
    if (med !== "all") list = list.filter((k) => k.medium === med);
    if (q.trim()) {
      const n = q.toLowerCase();
      list = list.filter(
        (k) =>
          k.title.toLowerCase().includes(n) ||
          (k.presenter_name ?? "").toLowerCase().includes(n) ||
          (subById[k.subject_id]?.name ?? "").toLowerCase().includes(n),
      );
    }
    return list;
  }, [kuppiQ.data, med, q, subById]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await doRequestDelete({ data: { entityType: "kuppi", entityId: id } });
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.queued ? "Removal request sent to super admin" : "Kuppi deleted");
      qc.invalidateQueries({ queryKey: ["admin-kuppi"] });
    },
    onError: (e: Error) => toast.error("Couldn't submit removal", { description: e.message }),
  });

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search title, presenter or subject…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={med} onValueChange={setMed}>
            <SelectTrigger><SelectValue placeholder="Medium" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All mediums</SelectItem>
              {KUPPI_MEDIUMS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" /> New Kuppi</Button>
            </DialogTrigger>
            <KuppiDialog
              ctx={ctx}
              editing={editing}
              subjects={subjectsQ.data ?? []}
              existingPresenters={Array.from(new Set((kuppiQ.data ?? []).map((k) => k.presenter_name).filter(Boolean))).sort()}
              presenterPhotos={Object.fromEntries((kuppiQ.data ?? []).filter((k) => k.presenter_photo_url).map((k) => [k.presenter_name, k.presenter_photo_url as string]))}
              requestUpdateFn={doRequestUpdate}
              onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-kuppi"] }); }}
            />
          </Dialog>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{rows.length} kuppi{rows.length === 1 ? "" : "s"} in {ctx.semesterName}</div>
      </div>

      {kuppiQ.isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Video className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No Kuppi videos yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first one with <b>New Kuppi</b>.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((k) => (
            <li key={k.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start gap-3">
                {k.presenter_photo_url ? (
                  <img src={k.presenter_photo_url} alt={k.presenter_name} className="h-12 w-12 rounded-full object-cover ring-1 ring-border" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold">
                    {k.presenter_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary">
                      {mediumLabel(k.medium)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{subById[k.subject_id]?.name ?? "—"}</span>
                  </div>
                  <h3 className="mt-1 font-semibold truncate">{k.title}</h3>
                  <div className="text-xs text-muted-foreground">by {k.presenter_name} · {format(new Date(k.created_at), "MMM d, yyyy")}</div>
                  {k.sections_covered && <p className="mt-1 text-xs text-muted-foreground line-clamp-2"><b>Covered:</b> {k.sections_covered}</p>}
                  {k.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{k.description}</p>}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <Button asChild size="sm" variant="outline">
                  <a href={k.video_url} target="_blank" rel="noopener">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open video
                  </a>
                </Button>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(k); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-400 hover:text-rose-300"
                    onClick={() => { if (confirm(`Delete "${k.title}"?`)) del.mutate(k.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KuppiDialog({
  ctx,
  editing,
  subjects,
  onSaved,
  requestUpdateFn,
  existingPresenters,
  presenterPhotos,
}: {
  ctx: AdminContext;
  editing: Kuppi | null;
  subjects: { id: string; name: string; code: string | null }[];
  onSaved: () => void;
  requestUpdateFn: (opts: { data: { entityType: "kuppi"; entityId: string; proposedData: Record<string, unknown> } }) => Promise<{ queued: boolean }>;
  existingPresenters: string[];
  presenterPhotos: Record<string, string>;
}) {
  const [subjectId, setSubjectId] = useState(editing?.subject_id ?? subjects[0]?.id ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [medium, setMedium] = useState(editing?.medium ?? "sinhala");
  const [videoUrl, setVideoUrl] = useState(editing?.video_url ?? "");
  const [presenterName, setPresenterName] = useState(editing?.presenter_name ?? "");
  const [presenterPhoto, setPresenterPhoto] = useState<string>(editing?.presenter_photo_url ?? "");
  const [sections, setSections] = useState(editing?.sections_covered ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onPickPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const path = `${uid}/kuppi-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr || !signed) throw signErr ?? new Error("Sign URL failed");
      setPresenterPhoto(signed.signedUrl);
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error("Could not upload photo", { description: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!subjectId) return toast.error("Pick a subject");
    if (!title.trim()) return toast.error("Add a title");
    if (!videoUrl.trim()) return toast.error("Add the YouTube / OneDrive / DMS link");
    if (!presenterName.trim()) return toast.error("Add the presenter name");
    setSaving(true);
    const payload = {
      semester_id: ctx.semesterId,
      subject_id: subjectId,
      title: title.trim(),
      description: description.trim() || null,
      sections_covered: sections.trim() || null,
      medium,
      video_url: videoUrl.trim(),
      presenter_name: presenterName.trim(),
      presenter_photo_url: presenterPhoto.trim() || null,
    };
    if (editing) {
      try {
        const res = await requestUpdateFn({ data: { entityType: "kuppi", entityId: editing.id, proposedData: payload } });
        setSaving(false);
        toast.success(res.queued ? "Edit sent to super admin for approval" : "Kuppi updated");
        onSaved();
      } catch (e) {
        setSaving(false);
        toast.error("Couldn't save", { description: e instanceof Error ? e.message : "Failed" });
      }
    } else {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      const { error } = await (supabase as any).from("kuppi_videos").insert({ ...payload, uploaded_by: uid });
      setSaving(false);
      if (error) return toast.error("Couldn't save", { description: error.message });
      toast.success("Kuppi added");
      // Reset form fields so the next entry starts empty.
      setTitle("");
      setVideoUrl("");
      setPresenterName("");
      setPresenterPhoto("");
      setSections("");
      setDescription("");
      onSaved();
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit Kuppi" : "New Kuppi video"}</DialogTitle>
        <DialogDescription>Peer-recorded revision session — Sinhala or Tamil (or English).</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Subject*</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Title*</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 — Frequency response" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Medium*</Label>
            <Select value={medium} onValueChange={setMedium}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KUPPI_MEDIUMS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Presenter name*</Label>
            <Input
              list="kuppi-presenter-names"
              value={presenterName}
              onChange={(e) => {
                const v = e.target.value;
                setPresenterName(v);
                // If matches an existing presenter and no photo yet, auto-fill photo.
                const match = existingPresenters.find((n) => n.toLowerCase() === v.trim().toLowerCase());
                if (match && !presenterPhoto && presenterPhotos[match]) {
                  setPresenterPhoto(presenterPhotos[match]);
                }
              }}
              placeholder="Pick from list or type a new name"
            />
            <datalist id="kuppi-presenter-names">
              {existingPresenters.map((n) => <option key={n} value={n} />)}
            </datalist>
            <p className="text-[11px] text-muted-foreground">
              {existingPresenters.length > 0 ? `${existingPresenters.length} existing presenter${existingPresenters.length === 1 ? "" : "s"} — start typing to reuse, or add a new name.` : "First kuppi in this semester — add the presenter's name."}
            </p>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Video link* (YouTube, OneDrive, DMS)</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…" />
        </div>
        <div className="grid gap-1.5">
          <Label>Presenter photo (optional)</Label>
          <div className="flex items-center gap-3">
            {presenterPhoto ? (
              <img src={presenterPhoto} alt="Presenter" className="h-14 w-14 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold">
                {(presenterName || "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {presenterPhoto ? "Replace" : "Upload"}
              </Button>
              {presenterPhoto && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setPresenterPhoto("")} disabled={uploading}>
                  <XIcon className="mr-2 h-4 w-4" />Remove
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickPhoto(f); }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">PNG or JPG, up to 5 MB.</p>
        </div>
        <div className="grid gap-1.5">
          <Label>Sections covered</Label>
          <Input value={sections} onChange={(e) => setSections(e.target.value)} placeholder="e.g. Chapter 3 § 3.1 – 3.4" />
        </div>
        <div className="grid gap-1.5">
          <Label>Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editing ? "Save changes" : "Add Kuppi"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
