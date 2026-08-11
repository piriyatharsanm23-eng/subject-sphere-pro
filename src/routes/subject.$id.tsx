import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, Calendar, Download, ExternalLink, Eye, FileText, Loader2, Sparkles, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { materialTypeBadge, materialTypeLabel, downloadMaterial } from "@/lib/materials";
import { useMaterialDownload } from "@/hooks/useMaterialDownload";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { CardGridSkeleton, EmptyState, ErrorState, MaterialCardSkeleton } from "@/components/ui/states";
import { formatDateTime, formatRelative } from "@/lib/format";
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
        .select("id,title,description,material_type,file_url,file_name,file_type,year,week_or_module,created_at,uploaded_by").eq("pending_delete", false)
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
        .from("deadlines").select("id,title,description,deadline_at,status").eq("pending_delete", false)
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
        .select("id,title,description,sections_covered,medium,video_url,presenter_name,presenter_photo_url,created_at").eq("pending_delete", false)
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
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />
      <PageContainer>
        {subjectQ.isLoading ? (
          <div className="mb-6 space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        ) : subjectQ.isError ? (
          <ErrorState className="mb-6" title="We couldn't load this subject" error={subjectQ.error} onRetry={() => subjectQ.refetch()} />
        ) : !subjectQ.data ? (
          <EmptyState
            className="mb-6"
            icon={FileText}
            title="Subject not found"
            description="It may have been removed by an admin. Head back to your dashboard to pick another subject."
            action={<Button asChild size="sm"><Link to="/dashboard">Go to dashboard</Link></Button>}
          />
        ) : (
          <PageHeader
            breadcrumbs={[
              { label: "Home", to: "/" },
              ...((subjectQ.data as any)?.semester?.name
                ? [{ label: (subjectQ.data as any).semester.name as string, to: "/semester/$id", params: { id: subjectQ.data.semester_id } }]
                : []),
              { label: subjectQ.data.name },
            ]}
            eyebrow={subjectQ.data.code}
            title={subjectQ.data.name}
            description={subjectQ.data.description ?? undefined}
          />
        )}


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
              <CardGridSkeleton count={2} height="h-24" className="space-y-3" />
            ) : (deadlinesQ.data ?? []).length === 0 ? (
              <EmptyState icon={Calendar} title="No active deadlines" description="When an admin publishes a deadline for this subject it will appear here." />
            ) : (
              <div className="space-y-3">
                {deadlinesQ.data!.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-badge-assignment/10 text-badge-assignment">
                        <Calendar className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold break-words">{d.title}</div>
                        {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-badge-assignment">{formatDateTime(d.deadline_at)}</span>
                          <span className="text-muted-foreground"> · {formatRelative(d.deadline_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>

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
  const dl = useMaterialDownload();
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
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
        {items.map((m) => (
          <div key={m.id} className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-soft hover:shadow-elevated transition-shadow">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(m.material_type)}`}>{materialTypeLabel(m.material_type)}</span>
              {m.week_or_module && <span className="min-w-0 truncate text-xs text-muted-foreground">{m.week_or_module}</span>}
              {m.year && <span className="text-xs text-muted-foreground">{m.year}</span>}
            </div>
            <h4 className="mt-2 font-semibold leading-snug line-clamp-2 break-words">{m.title}</h4>
            {m.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
            <div className="mt-3 min-w-0">
              <UploaderBadge uploader={m.uploaded_by ? uploaders[m.uploaded_by] : null} />
              <div className="text-xs text-muted-foreground mt-1">{formatRelative(m.created_at)}</div>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-4 [&>*]:w-full">
              <Button size="sm" variant="outline" disabled={dl.isDownloading(m.id)} onClick={() => setPreviewing(m)}>
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />Preview
              </Button>
              <Button size="sm" disabled={dl.isDownloading(m.id)} aria-busy={dl.isDownloading(m.id)} onClick={() => dl.download(m)}>
                {dl.isDownloading(m.id) ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Preparing…</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download</>
                )}
              </Button>
              {showChatGPT && (
                <Button size="sm" variant="secondary" onClick={() => openAI(m, "chatgpt")}>
                  <Bot className="mr-2 h-4 w-4 text-emerald-400" aria-hidden="true" />ChatGPT
                  <ExternalLink className="ml-1 h-3 w-3 opacity-70" aria-hidden="true" />
                </Button>
              )}
              {showGemini && (
                <Button size="sm" variant="secondary" onClick={() => openAI(m, "gemini")}>
                  <Sparkles className="mr-2 h-4 w-4 text-sky-400" aria-hidden="true" />Gemini
                  <ExternalLink className="ml-1 h-3 w-3 opacity-70" aria-hidden="true" />
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
              <Button size="sm" disabled={dlg.busy} aria-busy={dlg.busy} onClick={() => dlg.download(material)}>
                {dlg.busy ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" /> Download</>
                )}
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

function Empty({ label, description }: { label: string; description?: string }) {
  return (
    <EmptyState
      icon={FileText}
      title={label}
      description={description ?? "Nothing has been published here yet — check back soon, or use \u201cRequest material\u201d on your dashboard to ask an admin for it."}
    />
  );
}

function MaterialSkeleton() {
  return <MaterialCardSkeleton count={3} />;
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
          {formatRelative(k.created_at)}
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

