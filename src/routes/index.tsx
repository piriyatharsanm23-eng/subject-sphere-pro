import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Calendar, Download, FileText, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { getSelection } from "@/lib/selection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyHub — Your study materials, organised" },
      { name: "description", content: "Pick your semester and subjects, then access every lecture slide, note, past paper and deadline in one beautiful place." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    setHasSelection(!!getSelection());
  }, []);

  const { data: semesters } = useQuery({
    queryKey: ["semesters", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semesters")
        .select("id, name, description")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero" />
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_60%,white_0,transparent_40%)]" />
        <div className="relative container mx-auto px-4 sm:px-6 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Built for students, organised by semester
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
              Every lecture slide and past paper, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200">one calm place</span>.
            </h1>
            <p className="mt-6 text-lg text-white/80 max-w-2xl leading-relaxed">
              StudyHub gives you instant, no-login access to lecture materials, notes, past papers and upcoming deadlines — sorted by your semester and subjects.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => navigate({ to: hasSelection ? "/dashboard" : "/select" })}
                className="bg-white text-navy hover:bg-white/90 shadow-glow font-semibold"
              >
                {hasSelection ? "Open dashboard" : "Start learning"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white">
                <Link to="/select">Choose semester</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 sm:px-6 -mt-12 relative z-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, title: "Lecture slides & notes", desc: "Download up-to-date material from every subject." },
            { icon: BookOpen, title: "Past papers archive", desc: "Browse past papers, organised by year." },
            { icon: Calendar, title: "Live deadlines", desc: "See assignments and exam dates at a glance." },
            { icon: MessageSquare, title: "Request & feedback", desc: "Ask for missing material or report issues." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-elevated transition-shadow">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AVAILABLE SEMESTERS */}
      <section className="container mx-auto px-4 sm:px-6 mt-24">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Available semesters</h2>
            <p className="mt-1 text-muted-foreground text-sm">Pick a semester to view its subjects and materials.</p>
          </div>
          <Button asChild variant="ghost"><Link to="/select">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {semesters && semesters.length > 0 ? (
            semesters.map((s) => (
              <Link key={s.id} to="/select" className="group rounded-2xl border border-border bg-card-soft p-6 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{s.name}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                {s.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
              </Link>
            ))
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Download className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">No semesters yet. An administrator will add them soon.</p>
            </div>
          )}
        </div>
      </section>

      <div className="flex-1" />
      <SiteFooter />
    </div>
  );
}
