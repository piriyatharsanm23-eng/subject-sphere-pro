import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { getSelection, setSelection } from "@/lib/selection";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/select")({
  head: () => ({ meta: [{ title: "Choose your semester & subjects — StudyHub" }] }),
  component: SelectPage,
});

function SelectPage() {
  const navigate = useNavigate();
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  useEffect(() => {
    const s = getSelection();
    if (s) { setSemesterId(s.semesterId); setSubjectIds(s.subjectIds); }
  }, []);

  const semestersQ = useQuery({
    queryKey: ["semesters", "active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("semesters").select("id,name,description").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const subjectsQ = useQuery({
    queryKey: ["subjects", semesterId],
    enabled: !!semesterId,
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id,name,code,description").eq("semester_id", semesterId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const toggleSubject = (id: string) => {
    setSubjectIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const onSave = () => {
    if (!semesterId) { toast.error("Choose a semester"); return; }
    if (subjectIds.length === 0) { toast.error("Pick at least one subject"); return; }
    setSelection({ semesterId, subjectIds });
    toast.success("Preferences saved");
    navigate({ to: "/dashboard" });
  };

  const canSave = !!semesterId && subjectIds.length > 0;

  return (
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />
      <PageContainer size="narrow">
        <PageHeader
          breadcrumbs={[{ label: "Home", to: "/" }, { label: "Preferences" }]}
          eyebrow="Step by step"
          title="Set your preferences"
          description="Choose your semester and the subjects you're studying. We'll remember this on this device so your dashboard stays personal."
        />

        {/* Step 1 */}
        <section aria-labelledby="step-1" className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            <h2 id="step-1" className="text-base font-semibold sm:text-lg">Select your semester</h2>
          </div>
          {semestersQ.isLoading ? (
            <CardGridSkeleton count={3} height="h-24" className="grid grid-cols-1 gap-3 sm:grid-cols-2" />
          ) : semestersQ.isError ? (
            <ErrorState title="We couldn't load semesters" error={semestersQ.error} onRetry={() => semestersQ.refetch()} />
          ) : semestersQ.data && semestersQ.data.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {semestersQ.data.map((s) => {
                const active = semesterId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setSemesterId(s.id); if (semesterId !== s.id) setSubjectIds([]); }}
                    className={cn(
                      "min-h-11 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-card hover:border-primary/40 hover:shadow-soft",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold break-words">{s.name}</div>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </div>
                    {s.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No semesters available yet" description="An admin needs to publish a semester before you can pick one." />
          )}
        </section>

        {/* Step 2 */}
        <section
          aria-labelledby="step-2"
          className={cn(
            "mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-opacity sm:mt-6 sm:p-6",
            !semesterId && "pointer-events-none opacity-60",
          )}
        >
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            <h2 id="step-2" className="text-base font-semibold sm:text-lg">Pick your subjects</h2>
            {subjectIds.length > 0 && (
              <span className="ml-auto text-xs font-medium text-muted-foreground" aria-live="polite">{subjectIds.length} selected</span>
            )}
          </div>
          {!semesterId ? (
            <p className="text-sm text-muted-foreground">Select a semester first.</p>
          ) : subjectsQ.isLoading ? (
            <CardGridSkeleton count={4} height="h-20" className="grid grid-cols-1 gap-3 sm:grid-cols-2" />
          ) : subjectsQ.isError ? (
            <ErrorState title="We couldn't load subjects" error={subjectsQ.error} onRetry={() => subjectsQ.refetch()} />
          ) : subjectsQ.data && subjectsQ.data.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {subjectsQ.data.map((sub) => {
                const active = subjectIds.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSubject(sub.id)}
                    className={cn(
                      "min-h-11 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {active ? <Check className="h-4 w-4" aria-hidden="true" /> : <BookOpen className="h-4 w-4" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{sub.name}</div>
                        {sub.code && <div className="text-xs text-muted-foreground">{sub.code}</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No subjects in this semester yet" description="Check back soon — admins add subjects as the semester starts." />
          )}
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:mt-8 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button size="lg" className="w-full sm:w-auto" onClick={onSave} disabled={!canSave}>
            Save & continue <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}

