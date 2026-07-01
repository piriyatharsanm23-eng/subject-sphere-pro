import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MATERIAL_TYPES, materialTypeBadge, materialTypeLabel, downloadMaterial } from "@/lib/materials";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useMemo } from "react";
import { useUploaders } from "@/lib/uploaders";
import { UploaderBadge, type UploaderInfo } from "@/components/UploaderBadge";

export const Route = createFileRoute("/subject/$id")({
  head: () => ({ meta: [{ title: "Subject — StudyHub" }] }),
  component: SubjectPage,
});

function SubjectPage() {
  const { id } = useParams({ from: "/subject/$id" });

  const subjectQ = useQuery({
    queryKey: ["subject", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id,name,code,description,semester_id").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const materialsQ = useQuery({
    queryKey: ["subject-materials", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,description,material_type,file_url,file_name,file_type,year,week_or_module,created_at,download_count,uploaded_by")
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

  const groups = useMemo(() => {
    const m = materialsQ.data ?? [];
    return {
      lecture_slide: m.filter((x) => x.material_type === "lecture_slide"),
      note: m.filter((x) => x.material_type === "note"),
      past_paper: m.filter((x) => x.material_type === "past_paper"),
      assignment: m.filter((x) => x.material_type === "assignment"),
      other: m.filter((x) => x.material_type === "other"),
    };
  }, [materialsQ.data]);

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
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard</Link></Button>

        <header className="rounded-2xl border border-border bg-card-soft p-6 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{subjectQ.data?.code}</div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">{subjectQ.data?.name ?? "Loading…"}</h1>
          {subjectQ.data?.description && <p className="mt-2 text-muted-foreground max-w-2xl">{subjectQ.data.description}</p>}
        </header>

        <Tabs defaultValue="lecture_slide" className="mt-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="lecture_slide">Lecture Slides ({groups.lecture_slide.length})</TabsTrigger>
            <TabsTrigger value="note">Notes ({groups.note.length})</TabsTrigger>
            <TabsTrigger value="past_paper">Past Papers ({groups.past_paper.length})</TabsTrigger>
            <TabsTrigger value="assignment">Assignments ({groups.assignment.length})</TabsTrigger>
            <TabsTrigger value="deadlines">Deadlines ({(deadlinesQ.data ?? []).length})</TabsTrigger>
          </TabsList>

          {(["lecture_slide","note","assignment"] as const).map((t) => (
            <TabsContent key={t} value={t} className="mt-4">
              <MaterialList items={groups[t]} uploaders={uploadersQ.data ?? {}} />
            </TabsContent>
          ))}

          <TabsContent value="past_paper" className="mt-4 space-y-6">
            {papersByYear.length === 0 ? <Empty label="No past papers yet" /> : papersByYear.map(([year, items]) => (
              <div key={year}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{year}</h3>
                <MaterialList items={items} uploaders={uploadersQ.data ?? {}} />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="deadlines" className="mt-4">
            {(deadlinesQ.data ?? []).length === 0 ? <Empty label="No active deadlines" /> : (
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

function MaterialList({ items }: { items: { id: string; title: string; description: string | null; material_type: string; file_url: string; file_name: string | null; year: string | null; week_or_module: string | null; created_at: string; download_count: number }[] }) {
  if (items.length === 0) return <Empty label="Nothing here yet" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((m) => (
        <div key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft hover:shadow-elevated transition-shadow">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(m.material_type)}`}>{materialTypeLabel(m.material_type)}</span>
            {m.week_or_module && <span className="text-xs text-muted-foreground">{m.week_or_module}</span>}
            {m.year && <span className="text-xs text-muted-foreground">{m.year}</span>}
          </div>
          <h4 className="mt-2 font-semibold">{m.title}</h4>
          {m.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })} · {m.download_count} downloads</div>
            <Button size="sm" onClick={async () => {
              try { await downloadMaterial(m); toast.success("Download started"); }
              catch { toast.error("Could not download"); }
            }}><Download className="mr-2 h-4 w-4" />Download</Button>
          </div>
        </div>
      ))}
    </div>
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
