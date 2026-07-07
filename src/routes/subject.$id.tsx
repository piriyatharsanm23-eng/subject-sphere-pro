import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, Calendar, Download, ExternalLink, Eye, FileText, Sparkles, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { materialTypeBadge, materialTypeLabel, downloadMaterial } from "@/lib/materials";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useUploaders } from "@/lib/uploaders";
import { UploaderBadge, type UploaderInfo } from "@/components/UploaderBadge";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { KUPPI_MEDIUMS, mediumLabel, toYoutubeEmbed } from "@/lib/kuppi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIExplainDialog, type AIProvider } from "@/components/AIExplainDialog";
import { useAISettings } from "@/hooks/useAISettings";
import { openExternalAIExplain } from "@/lib/openExternalAI";

export const Route = createFileRoute("/subject/$id")({
  head: () => ({ meta: [{ title: "Subject — StudyHub" }] }),
  component: SubjectPage,
});

function SubjectPage() {
  const { id } = useParams({ from: "/subject/$id" });

  const subjectQ = useQuery({
    queryKey: ["subject", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id,name,code,description,semester_id, semester:semesters(name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const materialsQ = useQuery({
    queryKey: ["subject-materials", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,description,material_type,file_url,file_name,file_type,year,week_or_module,created_at,uploaded_by")
        .eq("subject_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadersQ = useUploaders((materialsQ.data ?? []).map((m) => m.uploaded_by));

  const deadlinesQ = useQuery({
    queryKey: ["subject-deadlines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines").select("id,title,description,deadline_at,status")
        .eq("subject_id", id).eq("status", "active").gte("deadline_at", new Date().toISOString())
        .order("deadline_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const kuppiQ = useQuery({
    queryKey: ["subject-kuppi", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kuppi_videos")
        .select("id,title,description,sections_covered,medium,video_url,presenter_name,presenter_photo_url,created_at")
        .eq("subject_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KuppiRow[];
    },
  });

  const groups = useMemo(() => {
    const m = materialsQ.data ?? [];
    // Treat legacy "lecture_slide" rows as notes.
    return {
      note: m.filter((x) => x.material_type === "note" || x.material_type === "lecture_slide"),
      past_paper: m.filter((x) => x.material_type === "past_paper"),
      assignment: m.filter((x) => x.material_type === "assignment"),
      other: m.filter((x) => x.material_type === "other"),
    };
  }, [materialsQ.data]);


  // Realtime — invalidate when this subject's data changes.
  useRealtimeInvalidate(`subject:${id}`, [
    { table: "materials", filter: `subject_id=eq.${id}`, keys: [["subject-materials", id]] },
    { table: "deadlines", filter: `subject_id=eq.${id}`, keys: [["subject-deadlines", id]] },
    { table: "subjects", filter: `id=eq.${id}`, keys: [["subject", id]] },
  ]);

  useEffect(() => { if (subjectQ.error) toast.error("Couldn't load subject", { description: (subjectQ.error as Error).message }); }, [subjectQ.error]);
  useEffect(() => { if (materialsQ.error) toast.error("Couldn't load materials", { description: (materialsQ.error as Error).message }); }, [materialsQ.error]);
  useEffect(() => { if (deadlinesQ.error) toast.error("Couldn't load deadlines", { description: (deadlinesQ.error as Error).message }); }, [deadlinesQ.error]);

  // Past papers grouped by year
  const papersByYear = useMemo(() => {
    const grouped: Record<string, typeof groups.past_paper> = {};
    for (const p of groups.past_paper) {
      const y = p.year ?? "Undated";
      (grouped[y] ??= []).push(p);
    }
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [groups.past_paper]);

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 max-w-6xl w-full">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to home</Link></Button>

        <header className="rounded-2xl border border-border bg-card-soft p-6 shadow-soft">
          {subjectQ.isLoading ? (
            <div className="space-y-3">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-8 w-64 rounded bg-muted animate-pulse" />
              <div className="h-4 w-full max-w-md rounded bg-muted animate-pulse" />
            </div>
          ) : !subjectQ.data ? (
            <div className="text-center py-6">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">Subject not found</p>
              <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Go back to the dashboard to pick another.</p>
            </div>
          ) : (
            <>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{subjectQ.data.code}</div>
              <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">{subjectQ.data.name}</h1>
              {subjectQ.data.description && <p className="mt-2 text-muted-foreground max-w-2xl">{subjectQ.data.description}</p>}
            </>
          )}
        </header>

        <Tabs defaultValue="note" className="mt-6">
          <TabsList className="grid grid-cols-3 h-auto w-full gap-1 sm:flex sm:flex-wrap sm:w-auto">
            <TabsTrigger value="note" className="text-xs sm:text-sm">Notes ({groups.note.length})</TabsTrigger>
            <TabsTrigger value="past_paper" className="text-xs sm:text-sm">Papers ({groups.past_paper.length})</TabsTrigger>
            <TabsTrigger value="assignment" className="text-xs sm:text-sm">Assign. ({groups.assignment.length})</TabsTrigger>
            <TabsTrigger value="other" className="text-xs sm:text-sm">Tutorials ({groups.other.length})</TabsTrigger>
            <TabsTrigger value="kuppi" className="text-xs sm:text-sm">Kuppi ({(kuppiQ.data ?? []).length})</TabsTrigger>
            <TabsTrigger value="deadlines" className="text-xs sm:text-sm">Deadlines ({(deadlinesQ.data ?? []).length})</TabsTrigger>
          </TabsList>

          {(["note","assignment","other"] as const).map((t) => (
            <TabsContent key={t} value={t} className="mt-4">
              {materialsQ.isLoading ? <MaterialSkeleton /> : (
                <MaterialList
                  items={groups[t]}
                  uploaders={uploadersQ.data ?? {}}
                  subjectName={(subjectQ.data as any)?.name ?? null}
                  semesterName={(subjectQ.data as any)?.semester?.name ?? null}
                />
              )}
            </TabsContent>
          ))}

          <TabsContent value="kuppi" className="mt-4">
            {kuppiQ.isLoading ? <MaterialSkeleton /> : <KuppiSection items={kuppiQ.data ?? []} />}
          </TabsContent>



          <TabsContent value="past_paper" className="mt-4 space-y-6">
            {materialsQ.isLoading ? <MaterialSkeleton /> : papersByYear.length === 0 ? <Empty label="No past papers yet" /> : papersByYear.map(([year, items]) => (
              <div key={year}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{year}</h3>
                <MaterialList
                  items={items}
                  uploaders={uploadersQ.data ?? {}}
                  subjectName={(subjectQ.data as any)?.name ?? null}
                  semesterName={(subjectQ.data as any)?.semester?.name ?? null}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="deadlines" className="mt-4">
            {deadlinesQ.isLoading ? (
              <div className="space-y-3">
                {[0,1].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
              </div>
            ) : (deadlinesQ.data ?? []).length === 0 ? <Empty label="No active deadlines" /> : (
              <div className="space-y-3">
                {deadlinesQ.data!.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <div className="flex items-start gap-4">
                      <div className="grid place-items-center h-12 w-12 rounded-xl bg-badge-assignment/10 text-badge-assignment">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{d.title}</div>
                        {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
                        <div className="mt-2 text-sm">
                          <span className="text-badge-assignment font-medium">{format(new Date(d.deadline_at), "EEEE, MMM d, yyyy · h:mm a")}</span>
                          <span className="text-muted-foreground"> · in {formatDistanceToNow(new Date(d.deadline_at))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}

type MaterialRow = {
  id: string; title: string; description: string | null; material_type: string;
  file_url: string; file_name: string | null; file_type?: string | null;
  year: string | null; week_or_module: string | null;
  created_at: string; uploaded_by: string | null;
};

function MaterialList({
  items,
  uploaders,
  subjectName,
  semesterName,
}: {
  items: MaterialRow[];
  uploaders: Record<string, UploaderInfo>;
  subjectName?: string | null;
  semesterName?: string | null;
}) {
  const [previewing, setPreviewing] = useState<MaterialRow | null>(null);
  const aiSettings = useAISettings().data;
  const aiOn = !!aiSettings?.enabled;
  const showChatGPT = aiOn && aiSettings?.chatgpt_enabled;
  const showGemini = aiOn && aiSettings?.gemini_enabled;
  const openAI = (m: MaterialRow, provider: AIProvider) =>
    openExternalAIExplain(provider, {
      id: m.id,
      title: m.title,
      material_type: materialTypeLabel(m.material_type),
      subject: subjectName ?? null,
      semester: semesterName ?? null,
      file_name: m.file_name,
      file_url: m.file_url,
    });
  if (items.length === 0) return <Empty label="Nothing here yet" />;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((m) => (
          <div key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft hover:shadow-elevated transition-shadow">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(m.material_type)}`}>{materialTypeLabel(m.material_type)}</span>
              {m.week_or_module && <span className="text-xs text-muted-foreground">{m.week_or_module}</span>}
              {m.year && <span className="text-xs text-muted-foreground">{m.year}</span>}
            </div>
            <h4 className="mt-2 font-semibold">{m.title}</h4>
            {m.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
            <div className="mt-3 min-w-0">
              <UploaderBadge uploader={m.uploaded_by ? uploaders[m.uploaded_by] : null} />
              <div className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewing(m)}>
                <Eye className="mr-2 h-4 w-4" />Preview
              </Button>
              <Button size="sm" onClick={async () => {
                const id = toast.loading("Preparing your download…");
                try {
                  await downloadMaterial(m);
                  toast.success("Download started", { id });
                } catch (err) {
                  toast.error("Could not download", { id, description: (err as Error)?.message });
                }
              }}><Download className="mr-2 h-4 w-4" />Download</Button>
              {showChatGPT && (
                <Button size="sm" variant="secondary" onClick={() => openAI(m, "chatgpt")}>
                  <Bot className="mr-2 h-4 w-4 text-emerald-400" />ChatGPT
                  <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
                </Button>
              )}
              {showGemini && (
                <Button size="sm" variant="secondary" onClick={() => openAI(m, "gemini")}>
                  <Sparkles className="mr-2 h-4 w-4 text-sky-400" />Gemini
                  <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <PreviewDialog
        material={previewing}
        onClose={() => setPreviewing(null)}
        onExplain={(p) => previewing && openAI(previewing, p)}
        aiOn={aiOn}
        showChatGPT={!!showChatGPT}
        showGemini={!!showGemini}
      />
    </>
  );
}

function PreviewDialog({
  material,
  onClose,
  onExplain,
  aiOn,
  showChatGPT,
  showGemini,
}: {
  material: MaterialRow | null;
  onClose: () => void;
  onExplain?: (p: AIProvider) => void;
  aiOn?: boolean;
  showChatGPT?: boolean;
  showGemini?: boolean;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    if (!material?.file_url) return;
    setLoading(true);
    supabase.storage
      .from("learning-materials")
      .createSignedUrl(material.file_url, 60 * 10)
      .then(({ data }) => {
        if (cancelled) return;
        setSignedUrl(data?.signedUrl ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [material?.file_url]);

  const isPdf =
    !!material &&
    ((material.file_type ?? "").includes("pdf") ||
      (material.file_name ?? "").toLowerCase().endsWith(".pdf"));
  const isImage = !!material && (material.file_type ?? "").startsWith("image/");
  const canPreview = !!signedUrl && (isPdf || isImage);

  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="text-base truncate pr-8 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {material?.title ?? "Preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-muted/40 min-h-[70vh]">
          {loading || !signedUrl ? (
            <div className="h-[70vh] grid place-items-center text-sm text-muted-foreground">
              Loading preview…
            </div>
          ) : canPreview ? (
            isPdf ? (
              <iframe src={signedUrl} title={material?.title ?? "Preview"} className="w-full h-[75vh] bg-background" />
            ) : (
              <img src={signedUrl} alt={material?.title ?? "Preview"} className="w-full max-h-[75vh] object-contain bg-background" />
            )
          ) : (
            <div className="h-[70vh] grid place-items-center text-center px-6">
              <div>
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">Preview not supported</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {material?.file_name ?? "This file"} can't be shown here. Use Download to open it.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
          <div className="text-xs text-muted-foreground truncate">
            {material?.file_name}
          </div>
          <div className="flex gap-2">
            {material && (
              <Button
                size="sm"
                onClick={async () => {
                  const id = toast.loading("Preparing your download…");
                  try {
                    await downloadMaterial(material);
                    toast.success("Download started", { id });
                  } catch (err) {
                    toast.error("Could not download", { id, description: (err as Error)?.message });
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
          </div>
        </div>
        {aiOn && (showChatGPT || showGemini) && onExplain && material && (
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Study Helper
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Get a complete explanation, formulas, examples, viva questions, and exam revision from this material.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {showChatGPT && (
                <Button size="sm" variant="secondary" onClick={() => onExplain("chatgpt")}>
                  <Bot className="mr-2 h-4 w-4 text-emerald-400" /> Explain with ChatGPT
                </Button>
              )}
              {showGemini && (
                <Button size="sm" variant="secondary" onClick={() => onExplain("gemini")}>
                  <Sparkles className="mr-2 h-4 w-4 text-sky-400" /> Explain with Gemini
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function MaterialSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0,1,2,3].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
    </div>
  );
}

type KuppiRow = {
  id: string;
  title: string;
  description: string | null;
  sections_covered: string | null;
  medium: string;
  video_url: string;
  presenter_name: string;
  presenter_photo_url: string | null;
  created_at: string;
};

function KuppiSection({ items }: { items: KuppiRow[] }) {
  const [med, setMed] = useState<string>("all");
  const [playing, setPlaying] = useState<KuppiRow | null>(null);

  const filtered = med === "all" ? items : items.filter((k) => k.medium === med);

  if (items.length === 0) return <Empty label="No Kuppi videos yet — ask an admin to add one." />;

  return (
    <>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Medium:</span>
        <div className="inline-flex rounded-full border border-border bg-card p-0.5">
          <MediumChip active={med === "all"} onClick={() => setMed("all")}>All</MediumChip>
          {KUPPI_MEDIUMS.map((m) => (
            <MediumChip key={m.value} active={med === m.value} onClick={() => setMed(m.value)}>
              {m.short}
            </MediumChip>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} video{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {filtered.length === 0 ? (
        <Empty label="No Kuppi in this medium." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((k) => (
            <KuppiCard key={k.id} k={k} onPlay={() => setPlaying(k)} />
          ))}
        </div>
      )}

      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b border-border">
            <DialogTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" /> {playing?.title ?? "Kuppi"}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-black aspect-video">
            {playing && (() => {
              const embed = toYoutubeEmbed(playing.video_url);
              if (embed) return <iframe src={embed} title={playing.title} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
              return (
                <div className="h-full grid place-items-center text-center px-6 text-white/80">
                  <div>
                    <ExternalLink className="mx-auto h-8 w-8" />
                    <p className="mt-3 font-semibold">This video hosts outside YouTube.</p>
                    <p className="mt-1 text-sm">Open it in a new tab to watch.</p>
                    <Button asChild size="sm" className="mt-3">
                      <a href={playing.video_url} target="_blank" rel="noopener">
                        <ExternalLink className="mr-2 h-4 w-4" /> Open link
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            Presented by <b className="text-foreground">{playing?.presenter_name}</b>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KuppiCard({ k, onPlay }: { k: KuppiRow; onPlay: () => void }) {
  const mediumTone: Record<string, string> = {
    sinhala: "from-fuchsia-500/20 via-purple-500/10 to-transparent",
    tamil: "from-amber-500/20 via-orange-500/10 to-transparent",
    english: "from-sky-500/20 via-cyan-500/10 to-transparent",
  };
  const chipTone: Record<string, string> = {
    sinhala: "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
    tamil: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30",
    english: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30",
  };
  const embed = toYoutubeEmbed(k.video_url);
  const ytId = embed?.split("/embed/")[1]?.split(/[?&]/)[0];
  const thumb = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${mediumTone[k.medium] ?? "from-primary/15 to-transparent"}`} />
      <button
        type="button"
        onClick={onPlay}
        className="relative block w-full aspect-video overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background"
      >
        {thumb ? (
          <img src={thumb} alt={k.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <Video className="h-10 w-10 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute left-3 top-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${chipTone[k.medium] ?? "bg-primary/15 text-primary ring-1 ring-primary/30"}`}>
            {mediumLabel(k.medium)}
          </span>
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/95 text-primary shadow-lg backdrop-blur transition-transform duration-300 group-hover:scale-110">
            <Video className="h-6 w-6 fill-current" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/90">
          {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
        </div>
      </button>

      <div className="relative p-4">
        <h4 className="font-semibold leading-snug line-clamp-2">{k.title}</h4>
        {k.sections_covered && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            <span className="font-semibold text-foreground/80">Covered:</span> {k.sections_covered}
          </p>
        )}
        {k.description && !k.sections_covered && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{k.description}</p>
        )}

        <div className="mt-3 flex items-center gap-3">
          {k.presenter_photo_url ? (
            <img src={k.presenter_photo_url} alt={k.presenter_name} className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold ring-2 ring-primary/20">
              {k.presenter_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Presented by</div>
            <div className="text-sm font-semibold truncate">{k.presenter_name}</div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={onPlay} className="h-8 px-3">
              <Video className="mr-1.5 h-3.5 w-3.5" /> Watch
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 px-2">
              <a href={k.video_url} target="_blank" rel="noopener" aria-label="Open external link">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediumChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

