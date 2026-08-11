import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs, PageContainer, SectionHeading } from "@/components/ui/page";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatDate, formatRelative, truncateFileName } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { materialTypeBadge, materialTypeLabel } from "@/lib/materials";
import { useMaterialDownload } from "@/hooks/useMaterialDownload";
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
        .select("id,title,description,material_type,file_url,file_name,file_type,year,week_or_module,created_at,subject_id,semester_id,uploaded_by").eq("pending_delete", false)
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
        .select("id,title,material_type,created_at").eq("pending_delete", false)
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
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />
      <PageContainer>
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Home", to: "/" },
            ...(subjectQ.data ? [{ label: subjectQ.data.name, to: "/subject/$id", params: { id: subjectQ.data.id } }] : []),
            { label: m?.title ?? "Material" },
          ]}
        />

        {materialQ.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-[50vh] rounded-2xl" />
          </div>
        ) : materialQ.isError ? (
          <ErrorState title="We couldn't load this material" error={materialQ.error} onRetry={() => materialQ.refetch()} />
        ) : !m ? (
          <EmptyState
            icon={FileText}
            title="Material not found"
            description="This material may have been removed or replaced by an admin. Browse the subject to find the latest version."
            action={<Button asChild size="sm"><Link to="/">Back to home</Link></Button>}
          />
        ) : (
          <>
            <header className="rounded-2xl border border-border bg-card-soft p-5 shadow-soft sm:p-6">
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
              <h1 className="mt-2 text-2xl font-bold tracking-tight break-words sm:text-3xl">{m.title}</h1>
              {m.description && <p className="mt-2 max-w-3xl text-muted-foreground">{m.description}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <UploaderBadge uploader={m.uploaded_by ? uploadersQ.data?.[m.uploaded_by] ?? null : null} />
                  <div className="break-words">
                    Uploaded {formatDate(m.created_at)}
                    {m.file_name ? ` · ${truncateFileName(m.file_name)}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {signedUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a href={signedUrl} target="_blank" rel="noopener">
                        <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />Open
                      </a>
                    </Button>
                  )}

                  <Button size="sm" disabled={dl.busy} aria-busy={dl.busy} onClick={() => dl.download(m)}>
                    {dl.busy ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Preparing…</>
                    ) : (
                      <><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download</>
                    )}
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
                  <iframe src={signedUrl!} title={m.title} className="h-[60vh] w-full rounded-xl bg-background sm:h-[70vh]" />
                ) : (
                  <img src={signedUrl!} alt={m.title} className="max-h-[70vh] w-full rounded-xl bg-background object-contain" />
                )
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Preview not available"
                  description={`${m.file_name ? truncateFileName(m.file_name) : "This file"} can't be shown in the browser. Use Open or Download to view it in a native app.`}
                />
              )}
            </section>

            <nav aria-label="Material navigation" className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {prev ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/material/$id" params={{ id: prev.id }}>
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Previous
                  </Link>
                </Button>
              ) : <div />}
              {next && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/material/$id" params={{ id: next.id }}>
                    Next<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </nav>

            {related.length > 0 && (
              <section className="mt-10">
                <SectionHeading title="Related materials" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      to="/material/$id"
                      params={{ id: r.id }}
                      className="group rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeBadge(r.material_type)}`}>
                        {materialTypeLabel(r.material_type)}
                      </span>
                      <div className="mt-2 font-medium line-clamp-2 transition-colors group-hover:text-primary">{r.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatRelative(r.created_at)}</div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
