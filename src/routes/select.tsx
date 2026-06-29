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

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 max-w-5xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Set your preferences</h1>
          <p className="mt-2 text-muted-foreground">Choose a semester and the subjects you're studying. We'll remember it on this device.</p>
        </div>

        {/* Step 1 */}
        <section className="rounded-2xl border border-border bg-card shadow-soft p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <h2 className="font-semibold text-lg">Select your semester</h2>
          </div>
          {semestersQ.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0,1,2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : semestersQ.data && semestersQ.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {semestersQ.data.map((s) => {
                const active = semesterId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSemesterId(s.id); if (semesterId !== s.id) setSubjectIds([]); }}
                    className={cn(
                      "text-left rounded-xl border p-4 transition-all",
                      active ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-card hover:border-primary/40 hover:shadow-soft"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">{s.name}</div>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    {s.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No semesters available yet.</p>
          )}
        </section>

        {/* Step 2 */}
        <section className={cn("mt-6 rounded-2xl border border-border bg-card shadow-soft p-6 sm:p-8 transition-opacity", !semesterId && "opacity-50 pointer-events-none")}>
          <div className="flex items-center gap-3 mb-5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <h2 className="font-semibold text-lg">Pick your subjects</h2>
            {subjectIds.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{subjectIds.length} selected</span>}
          </div>
          {!semesterId ? (
            <p className="text-sm text-muted-foreground">Select a semester first.</p>
          ) : subjectsQ.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0,1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : subjectsQ.data && subjectsQ.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjectsQ.data.map((sub) => {
                const active = subjectIds.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    onClick={() => toggleSubject(sub.id)}
                    className={cn(
                      "text-left rounded-xl border p-4 transition-all",
                      active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {active ? <Check className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{sub.name}</div>
                        {sub.code && <div className="text-xs text-muted-foreground">{sub.code}</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subjects in this semester yet.</p>
          )}
        </section>

        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={onSave} disabled={!semesterId || subjectIds.length === 0}>
            Save & continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
