import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, ArrowRight, Settings2, Inbox, FileText, MessageSquarePlus, Star } from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";
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
        .select("id,title,description,material_type,file_url,file_name,file_type,year,week_or_module,created_at,subject_id,download_count,uploaded_by")
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
        .select("id,title,description,deadline_at,subject_id,status,is_archived")
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

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 max-w-7xl w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Semester</div>
            <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight break-words">{semesterQ.data?.name ?? "Your dashboard"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{sel.subjectIds.length} subject{sel.subjectIds.length === 1 ? "" : "s"} selected</p>
          </div>
          <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            <Button asChild variant="outline"><Link to="/select"><Settings2 className="mr-2 h-4 w-4" />Change preferences</Link></Button>
            <RequestDialog semesterId={sel.semesterId} subjects={subjectsQ.data ?? []} />
            <FeedbackDialog semesterId={sel.semesterId} subjects={subjectsQ.data ?? []} />
          </div>
        </div>

        {/* Deadline reminder banner — urgent first */}
        <div className="mb-10">
          {deadlinesQ.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0,1,2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <DeadlineBanner deadlines={deadlinesQ.data ?? []} subjectsById={subjectsById} />
          )}
        </div>

        {/* Subject cards */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Your subjects</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(subjectsQ.data ?? []).map((s) => {
              const meta = subjectMaterialCounts[s.id];
              return (
                <Link key={s.id} to="/subject/$id" params={{ id: s.id }} className="group rounded-2xl border border-border bg-card-soft p-5 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold group-hover:text-primary transition-colors">{s.name}</div>
                      {s.code && <div className="text-xs text-muted-foreground">{s.code}</div>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {meta?.count ?? 0} materials</span>
                    {meta?.latest && <span>Updated {formatDistanceToNow(new Date(meta.latest), { addSuffix: true })}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-3 mt-10">
          {/* Materials */}
          <div className="lg:col-span-2">
            <div className="flex items-end justify-between mb-3">
              <h2 className="text-lg font-semibold">Materials</h2>
              <span className="text-xs text-muted-foreground">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search title, year, type…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="sm:w-44"><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {(subjectsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="sm:w-44"><SelectValue placeholder="Material type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {MATERIAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {materialsQ.isLoading ? (
                [0,1,2].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)
              ) : filtered.length === 0 ? (
                <EmptyState icon={Inbox} title="No materials yet" description="When admins upload material for your subjects, it will appear here." />
              ) : (
                filtered.map((m) => (
                  <article key={m.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft hover:shadow-elevated transition-shadow">
                    <div className="flex flex-wrap items-start gap-3 justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(m.material_type)}`}>{materialTypeLabel(m.material_type)}</span>
                          {m.year && <span className="text-xs text-muted-foreground">· {m.year}</span>}
                          {m.week_or_module && <span className="text-xs text-muted-foreground">· {m.week_or_module}</span>}
                          <span className="text-xs text-muted-foreground">· {subjectsById[m.subject_id]?.name}</span>
                        </div>
                        <h3 className="mt-1 font-semibold truncate">{m.title}</h3>
                        {m.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <UploaderBadge uploader={m.uploaded_by ? uploadersQ.data?.[m.uploaded_by] : null} />
                          <span>· {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                          <span>· {m.download_count} downloads</span>
                        </div>
                      </div>
                      <Button size="sm" onClick={async () => {
                        try { await downloadMaterial(m); toast.success("Download started"); }
                        catch { toast.error("Could not download this file"); }
                      }}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          {/* All deadlines list */}
          <aside>
            {deadlinesQ.isLoading ? (
              <div className="space-y-3">
                {[0,1].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
              </div>
            ) : (
              <AllDeadlinesList deadlines={deadlinesQ.data ?? []} subjectsById={subjectsById} />
            )}
          </aside>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Inbox; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
