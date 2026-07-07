import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Download, ExternalLink, FileText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { downloadMaterial, materialTypeBadge, materialTypeLabel } from "@/lib/materials";
import { useUploaders } from "@/lib/uploaders";
import { UploaderBadge } from "@/components/UploaderBadge";
import { ReportMaterialButton } from "@/components/ReportMaterialButton";

export const Route = createFileRoute("/material/$id")({
  head: () => ({ meta: [{ title: "Material — StudyHub" }] }),
  component: MaterialPage,
});

function MaterialPage() {
  const { id } = useParams({ from: "/material/$id" });

  const materialQ = useQuery({
    queryKey: ["material", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,description,material_type,file_url,file_name,file_type,year,week_or_module,created_at,subject_id,semester_id,uploaded_by")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const m = materialQ.data;

  const subjectQ = useQuery({
    queryKey: ["material-subject", m?.subject_id],
    enabled: !!m?.subject_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id,name,code").eq("id", m!.subject_id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const semesterQ = useQuery({
    queryKey: ["material-semester", m?.semester_id],
    enabled: !!m?.semester_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("semesters").select("id,name").eq("id", m!.semester_id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const siblingsQ = useQuery({
    queryKey: ["material-siblings", m?.subject_id],
    enabled: !!m?.subject_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,material_type,created_at")
        .eq("subject_id", m!.subject_id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const siblings = siblingsQ.data ?? [];
  const idx = siblings.findIndex((s) => s.id === id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const related = siblings.filter((s) => s.id !== id).slice(0, 5);

  const uploadersQ = useUploaders(m?.uploaded_by ? [m.uploaded_by] : []);

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    if (!m?.file_url) return;
    supabase.storage.from("learning-materials").createSignedUrl(m.file_url, 60 * 10).then(({ data }) => {
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [m?.file_url]);

  const isPdf = (m?.file_type ?? "").includes("pdf") || (m?.file_name ?? "").toLowerCase().endsWith(".pdf");
  const isImage = (m?.file_type ?? "").startsWith("image/");
  const canPreview = !!signedUrl && (isPdf || isImage);

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 flex-1 max-w-6xl w-full">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/subject/$id" params={{ id: m?.subject_id ?? "" }}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back to subject
          </Link>
        </Button>

        {materialQ.isLoading ? (
          <div className="h-64 rounded-2xl bg-muted animate-pulse" />
        ) : !m ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">Material not found</p>
          </div>
        ) : (
          <>
            <header className="rounded-2xl border border-border bg-card-soft p-6 shadow-soft">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(m.material_type)}`}>
                  {materialTypeLabel(m.material_type)}
                </span>
                {semesterQ.data && <span className="text-xs text-muted-foreground">{semesterQ.data.name}</span>}
                {subjectQ.data && (
                  <Link to="/subject/$id" params={{ id: subjectQ.data.id }} className="text-xs text-primary hover:underline">
                    {subjectQ.data.name}
                  </Link>
                )}
                {m.year && <span className="text-xs text-muted-foreground">· {m.year}</span>}
                {m.week_or_module && <span className="text-xs text-muted-foreground">· {m.week_or_module}</span>}
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">{m.title}</h1>
              {m.description && <p className="mt-2 text-muted-foreground max-w-3xl">{m.description}</p>}
              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <UploaderBadge uploader={m.uploaded_by ? uploadersQ.data?.[m.uploaded_by] ?? null : null} />
                  <div>
                    Uploaded {format(new Date(m.created_at), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="flex gap-2">
                  {signedUrl && (
                    <Button asChild variant="outline">
                      <a href={signedUrl} target="_blank" rel="noopener">
                        <ExternalLink className="mr-2 h-4 w-4" />Open
                      </a>
                    </Button>
                  )}
                  <Button
                    onClick={async () => {
                      const tid = toast.loading("Preparing your download…");
                      try {
                        await downloadMaterial(m);
                        toast.success("Download started", { id: tid });
                      } catch (err) {
                        toast.error("Could not download", { id: tid, description: (err as Error)?.message });
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />Download
                  </Button>
                  <ReportMaterialButton
                    materialId={m.id}
                    materialTitle={m.title}
                    semesterId={m.semester_id}
                    subjectId={m.subject_id}
                  />
                </div>
              </div>
            </header>

            <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
              {canPreview ? (
                isPdf ? (
                  <iframe src={signedUrl!} title={m.title} className="w-full h-[70vh] rounded-xl bg-background" />
                ) : (
                  <img src={signedUrl!} alt={m.title} className="w-full max-h-[70vh] object-contain rounded-xl bg-background" />
                )
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/40 p-10 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 font-semibold">Preview not available</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.file_name ?? "This file"} can't be previewed here. Use Open or Download.
                  </p>
                </div>
              )}
            </section>

            <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
              {prev ? (
                <Button asChild variant="outline">
                  <Link to="/material/$id" params={{ id: prev.id }}>
                    <ArrowLeft className="mr-2 h-4 w-4" />Previous
                  </Link>
                </Button>
              ) : <div />}
              {next && (
                <Button asChild variant="outline">
                  <Link to="/material/$id" params={{ id: next.id }}>
                    Next<ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>

            {related.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-semibold mb-3">Related materials</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      to="/material/$id"
                      params={{ id: r.id }}
                      className="group rounded-xl border border-border bg-card p-4 hover:shadow-elevated transition-shadow"
                    >
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(r.material_type)}`}>
                        {materialTypeLabel(r.material_type)}
                      </span>
                      <div className="mt-2 font-medium group-hover:text-primary transition-colors line-clamp-2">{r.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
