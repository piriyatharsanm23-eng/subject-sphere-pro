import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, Eye, ArrowRight, Settings2, Inbox, FileText, MessageSquarePlus, Star } from "lucide-react";
import { MaterialPreviewDialog, type PreviewableMaterial } from "@/components/MaterialPreview";
import { DeadlineBanner, AllDeadlinesList } from "@/components/DeadlineBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { getSelection, type Selection } from "@/lib/selection";
import { MATERIAL_TYPES, materialTypeBadge, materialTypeLabel, downloadMaterial } from "@/lib/materials";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer, PageHeader, SectionHeading, Toolbar } from "@/components/ui/page";
import { CardGridSkeleton, EmptyState, ErrorState, ListSkeleton, MaterialCardSkeleton, SubjectCardSkeleton } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";
import { useUploaders } from "@/lib/uploaders";
import { UploaderBadge } from "@/components/UploaderBadge";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Your dashboard — StudyHub" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [sel, setSel] = useState<Selection | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSelection();
    if (!s) navigate({ to: "/select" });
    else setSel(s);
    setReady(true);
  }, [navigate]);

  if (!ready || !sel) return null;
  return <DashboardContent sel={sel} />;
}

function DashboardContent({ sel }: { sel: Selection }) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [previewing, setPreviewing] = useState<PreviewableMaterial | null>(null);

  const semesterQ = useQuery({
    queryKey: ["semester", sel.semesterId],
    queryFn: async () => {
      const { data, error } = await supabase.from("semesters").select("id,name,description").eq("id", sel.semesterId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const subjectsQ = useQuery({
    queryKey: ["subjects", sel.semesterId, sel.subjectIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id,name,code").in("id", sel.subjectIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const materialsQ = useQuery({
    queryKey: ["materials", sel.subjectIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,description,material_type,file_url,file_name,file_type,year,week_or_module,created_at,subject_id,uploaded_by").eq("pending_delete", false)
        .in("subject_id", sel.subjectIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadersQ = useUploaders((materialsQ.data ?? []).map((m) => m.uploaded_by));

  const deadlinesQ = useQuery({
    queryKey: ["deadlines", sel.subjectIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("id,title,description,deadline_at,subject_id,status,is_archived").eq("pending_delete", false)
        .in("subject_id", sel.subjectIds)
        .eq("status", "active")
        .eq("is_archived", false)
        .gte("deadline_at", new Date().toISOString())
        .order("deadline_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const subjectsById = useMemo(() => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])), [subjectsQ.data]);

  const filtered = useMemo(() => {
    const list = materialsQ.data ?? [];
    return list.filter((m) => {
      if (typeFilter !== "all" && m.material_type !== typeFilter) return false;
      if (subjectFilter !== "all" && m.subject_id !== subjectFilter) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const hay = `${m.title} ${m.description ?? ""} ${m.year ?? ""} ${materialTypeLabel(m.material_type)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [materialsQ.data, q, typeFilter, subjectFilter]);

  const subjectMaterialCounts = useMemo(() => {
    const counts: Record<string, { count: number; latest: string | null }> = {};
    for (const m of materialsQ.data ?? []) {
      const c = counts[m.subject_id] ?? { count: 0, latest: null };
      c.count += 1;
      if (!c.latest || m.created_at > c.latest) c.latest = m.created_at;
      counts[m.subject_id] = c;
    }
    return counts;
  }, [materialsQ.data]);

  // Realtime — invalidate materials & deadlines when they change in the DB.
  // Filter by semester_id so a single subscription covers every selected subject
  // (Postgres changes `in.()` filter with UUIDs is unreliable — semester scope is simpler & sufficient).
  useRealtimeInvalidate(`dashboard:${sel.semesterId}`, [
    { table: "materials", filter: `semester_id=eq.${sel.semesterId}`, keys: [["materials", sel.subjectIds.join(",")]] },
    { table: "deadlines", filter: `semester_id=eq.${sel.semesterId}`, keys: [["deadlines", sel.subjectIds.join(",")]] },
    { table: "semesters", filter: `id=eq.${sel.semesterId}`, keys: [["semester", sel.semesterId]] },
    { table: "subjects", filter: `semester_id=eq.${sel.semesterId}`, keys: [["subjects", sel.subjectIds.join(",")]] },
  ]);

  // Error toasts — one per query when it fails.
  useEffect(() => { if (materialsQ.error) toast.error("Couldn't load materials", { description: (materialsQ.error as Error).message }); }, [materialsQ.error]);
  useEffect(() => { if (deadlinesQ.error) toast.error("Couldn't load deadlines", { description: (deadlinesQ.error as Error).message }); }, [deadlinesQ.error]);
  useEffect(() => { if (subjectsQ.error) toast.error("Couldn't load subjects", { description: (subjectsQ.error as Error).message }); }, [subjectsQ.error]);
  useEffect(() => { if (semesterQ.error) toast.error("Couldn't load semester", { description: (semesterQ.error as Error).message }); }, [semesterQ.error]);

  return (
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />
      <PageContainer size="wide">
        <PageHeader
          breadcrumbs={[{ label: "Home", to: "/" }, { label: "Dashboard" }]}
          eyebrow="Semester"
          title={semesterQ.data?.name ?? "Your dashboard"}
          description={`${sel.subjectIds.length} subject${sel.subjectIds.length === 1 ? "" : "s"} selected · deadlines, materials and past papers in one place.`}
          actions={
            <>
              <Button asChild variant="outline" size="sm"><Link to="/select"><Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />Change preferences</Link></Button>
              <RequestDialog semesterId={sel.semesterId} subjects={subjectsQ.data ?? []} />
              <FeedbackDialog semesterId={sel.semesterId} subjects={subjectsQ.data ?? []} />
            </>
          }
        />

        {/* 1 — Urgent deadlines */}
        <section className="mb-8" aria-label="Upcoming deadlines">
          {deadlinesQ.isLoading ? (
            <CardGridSkeleton count={3} height="h-40" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" />
          ) : deadlinesQ.isError ? (
            <ErrorState title="We couldn't load your deadlines" error={deadlinesQ.error} onRetry={() => deadlinesQ.refetch()} />
          ) : (
            <DeadlineBanner deadlines={deadlinesQ.data ?? []} subjectsById={subjectsById} />
          )}
        </section>

        {/* 2 — Materials + all deadlines */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:gap-8">
          <div className="min-w-0">
            <SectionHeading
              title="Materials"
              action={<span className="text-xs text-muted-foreground" aria-live="polite">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>}
            />

            <div className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-4">

              <Toolbar>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input className="pl-9" aria-label="Search materials" placeholder="Search title, year, type…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-full sm:w-44" aria-label="Filter by subject"><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {(subjectsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-44" aria-label="Filter by material type"><SelectValue placeholder="Material type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {MATERIAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Toolbar>
            </div>

            <div className="mt-4 space-y-3">
              {materialsQ.isLoading ? (
                <MaterialCardSkeleton count={3} />

              ) : materialsQ.isError ? (
                <ErrorState title="We couldn't load your materials" error={materialsQ.error} onRetry={() => materialsQ.refetch()} />
              ) : filtered.length === 0 ? (
                (materialsQ.data ?? []).length === 0
                  ? <EmptyState icon={Inbox} title="No materials yet" description="When a semester admin uploads notes, slides or past papers for your subjects, they appear here instantly." />
                  : <EmptyState icon={Inbox} title="No materials match your filters" description="Try a different search term, or reset the subject and type filters." action={<Button size="sm" variant="outline" onClick={() => { setQ(""); setTypeFilter("all"); setSubjectFilter("all"); }}>Clear filters</Button>} />
              ) : (
                filtered.map((m) => (
                  <article key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(m.material_type)}`}>{materialTypeLabel(m.material_type)}</span>
                          {m.year && <span className="text-xs text-muted-foreground">· {m.year}</span>}
                          {m.week_or_module && <span className="text-xs text-muted-foreground">· {m.week_or_module}</span>}
                          <span className="min-w-0 truncate text-xs text-muted-foreground">· {subjectsById[m.subject_id]?.name}</span>
                        </div>
                        <h3 className="mt-1.5 font-semibold leading-snug line-clamp-2 break-words">{m.title}</h3>
                        {m.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <UploaderBadge uploader={m.uploaded_by ? uploadersQ.data?.[m.uploaded_by] : null} />
                          <span>· {formatRelative(m.created_at)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:w-[15.5rem] sm:shrink-0">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => setPreviewing(m as PreviewableMaterial)}>
                          <Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Preview
                        </Button>
                        <Button size="sm" className="w-full" onClick={async () => {

                          const id = toast.loading("Preparing your download…");
                          try {
                            await downloadMaterial(m);
                            toast.success("Download started", { id });
                          } catch (err) {
                            toast.error("Could not download this file", { id, description: (err as Error)?.message });
                          }
                        }}>
                          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Download
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start" aria-label="All deadlines">
            {deadlinesQ.isLoading ? (
              <ListSkeleton rows={2} className="space-y-3 [&>*]:h-20 [&>*]:rounded-2xl" />
            ) : (
              <AllDeadlinesList deadlines={deadlinesQ.data ?? []} subjectsById={subjectsById} />
            )}
          </aside>
        </div>

        {/* 3 — My subjects */}
        <section className="mt-10">
          <SectionHeading title="Your subjects" description="Jump straight into a subject's materials." />
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjectsQ.isLoading ? (
              <CardGridSkeleton count={3} height="h-28" className="contents" />
            ) : (subjectsQ.data ?? []).length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  icon={Inbox}
                  title="No subjects selected"
                  description="Pick the subjects you're studying this semester and your dashboard will fill up automatically."
                  action={<Button asChild size="sm"><Link to="/select">Choose subjects</Link></Button>}
                />
              </div>
            ) : (
              (subjectsQ.data ?? []).map((s) => {
                const meta = subjectMaterialCounts[s.id];
                return (
                  <Link key={s.id} to="/subject/$id" params={{ id: s.id }} className="group flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card-soft p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">{s.name}</div>
                        {s.code && <div className="truncate text-xs text-muted-foreground">{s.code}</div>}
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><FileText className="h-4 w-4" aria-hidden="true" /> {meta?.count ?? 0} materials</span>
                      {meta?.latest && <span>Updated {formatRelative(meta.latest)}</span>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <MaterialPreviewDialog material={previewing} onClose={() => setPreviewing(null)} />
      </PageContainer>
      <SiteFooter />
    </div>
  );
}


function RequestDialog({ semesterId, subjects }: { semesterId: string; subjects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) { toast.error("Please describe what you need"); return; }
    setBusy(true);
    const { error } = await supabase.from("student_requests").insert({
      semester_id: semesterId,
      subject_id: subjectId || null,
      request_text: text.trim(),
    });
    setBusy(false);
    if (error) { toast.error("Could not submit request"); return; }
    toast.success("Request submitted — thank you!");
    setText(""); setSubjectId(""); setOpen(false);
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><MessageSquarePlus className="mr-2 h-4 w-4" />Request material</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request material</DialogTitle>
          <DialogDescription>Ask the admin team to upload something specific.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Subject (optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">What do you need?</Label>
            <Textarea rows={4} placeholder="e.g. Past paper for Calculus 2023" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Submit request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDialog({ semesterId, subjects }: { semesterId: string; subjects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string>("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) { toast.error("Please write your feedback"); return; }
    setBusy(true);
    const { error } = await supabase.from("feedback").insert({
      semester_id: semesterId,
      subject_id: subjectId || null,
      feedback_text: text.trim(),
      rating: rating || null,
    });
    setBusy(false);
    if (error) { toast.error("Could not submit feedback"); return; }
    toast.success("Thanks for the feedback!");
    setText(""); setSubjectId(""); setRating(0); setOpen(false);
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><MessageSquarePlus className="mr-2 h-4 w-4" />Give feedback</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>Tell us what's working and what isn't.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Subject (optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Overall" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Rating</Label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-badge-assignment text-badge-assignment" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Your feedback</Label>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Send feedback</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
