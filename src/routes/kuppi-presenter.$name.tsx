import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Video, ExternalLink, BookOpen, GraduationCap } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { KUPPI_MEDIUMS, mediumLabel, toYoutubeEmbed } from "@/lib/kuppi";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/kuppi-presenter/$name")({
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.name)} — Kuppi presenter` },
      { name: "description", content: `All Kuppi sessions presented by ${decodeURIComponent(params.name)}.` },
    ],
  }),
  component: PresenterPage,
});

type Row = {
  id: string;
  title: string;
  description: string | null;
  sections_covered: string | null;
  medium: string;
  video_url: string;
  presenter_name: string;
  presenter_photo_url: string | null;
  semester_id: string;
  subject_id: string;
  created_at: string;
};

function PresenterPage() {
  const { name } = useParams({ from: "/kuppi-presenter/$name" });
  const decoded = decodeURIComponent(name);
  const [med, setMed] = useState<string>("all");
  const [playing, setPlaying] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["presenter-kuppi", decoded],
    queryFn: async () => {
      const [{ data: k }, { data: sems }, { data: subs }] = await Promise.all([
        (supabase as any)
          .from("kuppi_videos")
          .select("id,title,description,sections_covered,medium,video_url,presenter_name,presenter_photo_url,semester_id,subject_id,created_at").eq("pending_delete", false)
          .ilike("presenter_name", decoded)
          .order("created_at", { ascending: false }),
        supabase.from("semesters").select("id,name"),
        supabase.from("subjects").select("id,name,code"),
      ]);
      return {
        rows: (k ?? []) as Row[],
        semById: Object.fromEntries((sems ?? []).map((s: any) => [s.id, s])),
        subById: Object.fromEntries((subs ?? []).map((s: any) => [s.id, s])),
      };
    },
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];
  const filtered = med === "all" ? rows : rows.filter((r) => r.medium === med);
  const photo = rows.find((r) => r.presenter_photo_url)?.presenter_photo_url ?? null;

  const bySemester = new Map<string, Row[]>();
  for (const r of filtered) {
    const arr = bySemester.get(r.semester_id) ?? [];
    arr.push(r);
    bySemester.set(r.semester_id, arr);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/contributors"><ArrowLeft className="mr-2 h-4 w-4" /> Back to contributors</Link>
        </Button>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-elevated">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="relative flex items-start gap-5">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-primary/20">
              {photo ? <AvatarImage src={photo} alt={decoded} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {decoded.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <Video className="h-3 w-3" /> Kuppi presenter
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">{decoded}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {rows.length} kuppi session{rows.length === 1 ? "" : "s"} across{" "}
                {new Set(rows.map((r) => r.subject_id)).size} subject
                {new Set(rows.map((r) => r.subject_id)).size === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Medium:</span>
          <div className="inline-flex rounded-full border border-border bg-card p-0.5">
            <FilterChip active={med === "all"} onClick={() => setMed("all")}>All</FilterChip>
            {KUPPI_MEDIUMS.map((m) => (
              <FilterChip key={m.value} active={med === m.value} onClick={() => setMed(m.value)}>
                {m.short}
              </FilterChip>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} shown</span>
        </div>

        {isLoading ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[0,1,2,3].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No kuppi sessions for this filter.
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {Array.from(bySemester.entries()).map(([semId, list]) => (
              <section key={semId}>
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold">{data?.semById[semId]?.name ?? "Semester"}</h2>
                  <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {list.map((r) => {
                    const embed = toYoutubeEmbed(r.video_url);
                    const ytId = embed?.split("/embed/")[1]?.split(/[?&]/)[0];
                    const thumb = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;
                    const sub = data?.subById[r.subject_id];
                    return (
                      <div key={r.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated">
                        <button type="button" onClick={() => setPlaying(r)} className="relative block w-full aspect-video overflow-hidden bg-gradient-to-br from-primary/20 to-background">
                          {thumb ? (
                            <img src={thumb} alt={r.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                          ) : (
                            <div className="absolute inset-0 grid place-items-center text-muted-foreground"><Video className="h-10 w-10 opacity-40" /></div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/10 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
                            {mediumLabel(r.medium)}
                          </div>
                          <div className="absolute inset-0 grid place-items-center">
                            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-primary shadow-lg group-hover:scale-110 transition-transform">
                              <Video className="h-5 w-5 fill-current" />
                            </div>
                          </div>
                        </button>
                        <div className="p-4">
                          {sub && (
                            <Link to="/subject/$id" params={{ id: r.subject_id }} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline">
                              <BookOpen className="h-3 w-3" /> {sub.code ? `${sub.code} · ` : ""}{sub.name}
                            </Link>
                          )}
                          <h3 className="mt-1 font-semibold leading-snug line-clamp-2">{r.title}</h3>
                          {r.sections_covered && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              <span className="font-semibold text-foreground/80">Covered:</span> {r.sections_covered}
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={() => setPlaying(r)} className="h-8 px-3">
                                <Video className="mr-1.5 h-3.5 w-3.5" /> Watch
                              </Button>
                              <Button asChild size="sm" variant="outline" className="h-8 px-2">
                                <a href={r.video_url} target="_blank" rel="noopener" aria-label="Open external"><ExternalLink className="h-3.5 w-3.5" /></a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
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
                      <Button asChild size="sm" className="mt-3">
                        <a href={playing.video_url} target="_blank" rel="noopener"><ExternalLink className="mr-2 h-4 w-4" /> Open link</a>
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </main>
      <SiteFooter />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}
