import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, ChevronRight, Clock, Download, Eye, FileText, List, NotebookPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { supabase } from "@/integrations/supabase/client";
import { NoteMarkdown } from "@/components/NoteMarkdown";
import { MaterialPreviewDialog, type PreviewableMaterial } from "@/components/MaterialPreview";
import { useMaterialDownload } from "@/hooks/useMaterialDownload";
import { extractToc, readingTime, slugify, type StudyNote } from "@/lib/notes";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/notes/$subject/$slug")({
  head: () => ({
    meta: [
      { title: "Study Note — StudyHub" },
      { name: "description", content: "Read this study note online — headings, worked examples and equations rendered for comfortable study." },
      { property: "og:title", content: "Study Note — StudyHub" },
      { property: "og:description", content: "Web-based study notes with beautifully rendered mathematics." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NoteReaderPage,
});

type NoteWithRefs = StudyNote & {
  subject: { id: string; name: string; code: string | null; semester_id: string } | null;
  material: PreviewableMaterial | null;
};

function NoteReaderPage() {
  const { subject: subjectSlug, slug } = useParams({ from: "/notes/$subject/$slug" });

  const noteQ = useQuery({
    queryKey: ["study-note", slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("study_notes")
        .select(
          "id,title,slug,chapter,description,content,order_index,published,subject_id,semester_id,material_id,created_at,updated_at, subject:subjects(id,name,code,semester_id), material:materials(id,title,file_url,file_name,file_type)",
        )
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as NoteWithRefs | null;
    },
  });

  const note = noteQ.data ?? null;
  const semesterId = note?.subject?.semester_id ?? null;

  // Sidebar: every published note in this semester, grouped by subject.
  const siblingsQ = useQuery({
    queryKey: ["study-notes-nav", semesterId],
    enabled: !!semesterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("study_notes")
        .select("id,title,slug,subject_id,chapter,order_index, subject:subjects(id,name)")
        .eq("published", true)
        .eq("semester_id", semesterId)
        .order("order_index", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; title: string; slug: string; subject_id: string; chapter: string | null;
        order_index: number; subject: { id: string; name: string } | null;
      }>;
    },
  });

  const toc = useMemo(() => extractToc(note?.content ?? ""), [note?.content]);
  const activeId = useActiveHeading(toc.map((t) => t.id));

  const sameSubject = (siblingsQ.data ?? []).filter((n) => n.subject_id === note?.subject_id);
  const idx = sameSubject.findIndex((n) => n.slug === slug);
  const prev = idx > 0 ? sameSubject[idx - 1] : null;
  const next = idx >= 0 && idx < sameSubject.length - 1 ? sameSubject[idx + 1] : null;

  const bySubject = useMemo(() => {
    const map = new Map<string, { name: string; items: typeof sameSubject }>();
    for (const n of siblingsQ.data ?? []) {
      const name = n.subject?.name ?? "Other";
      const g = map.get(n.subject_id) ?? { name, items: [] };
      g.items.push(n);
      map.set(n.subject_id, g);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [siblingsQ.data]);

  useEffect(() => {
    if (note?.title) document.title = `${note.title} — Study Notes | StudyHub`;
  }, [note?.title]);

  const sidebar = (onNavigate?: () => void) => (
    <nav aria-label="Study notes" className="space-y-5 text-sm">
      {bySubject.map((g) => (
        <div key={g.name}>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</div>
          <ul className="mt-1 space-y-0.5">
            {g.items.map((n) => {
              const current = n.slug === slug;
              return (
                <li key={n.id}>
                  <Link
                    to="/notes/$subject/$slug"
                    params={{ subject: slugify(g.name), slug: n.slug }}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={`block truncate rounded-lg px-2 py-1.5 transition-colors ${
                      current
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                    }`}
                  >
                    {n.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {bySubject.length === 0 && <p className="px-2 text-muted-foreground">No other notes yet.</p>}
    </nav>
  );

  return (
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />

      <main className="container mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {noteQ.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : noteQ.isError ? (
          <ErrorState title="We couldn't load this note" error={noteQ.error} onRetry={() => noteQ.refetch()} />
        ) : !note ? (
          <EmptyState
            icon={NotebookPen}
            title="Note not found"
            description="This study note may have been unpublished or removed."
            action={<Button asChild size="sm"><Link to="/notes">Browse study notes</Link></Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_14rem]">
            {/* LEFT: navigation */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
                <Link to="/notes" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All study notes
                </Link>
                {sidebar()}
              </div>
            </aside>

            {/* CENTER: content */}
            <article className="min-w-0">
              <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <Link to="/notes" className="hover:text-foreground">Study Notes</Link>
                <ChevronRight className="h-3 w-3 opacity-60" aria-hidden="true" />
                {note.subject && (
                  <>
                    <Link to="/subject/$id" params={{ id: note.subject.id }} className="hover:text-foreground">
                      {note.subject.name}
                    </Link>
                    <ChevronRight className="h-3 w-3 opacity-60" aria-hidden="true" />
                  </>
                )}
                <span className="text-foreground/80">{note.title}</span>
              </nav>

              <div className="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
                <MobileSheet title="Study notes" icon={List} label="Notes">{sidebar(() => undefined)}</MobileSheet>
                {toc.length > 0 && (
                  <MobileSheet title="On this page" icon={NotebookPen} label="On this page">
                    <TocList items={toc} activeId={activeId} />
                  </MobileSheet>
                )}
              </div>

              <header className="mb-6">
                {note.chapter && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{note.chapter}</div>
                )}
                <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{note.title}</h1>
                {note.description && <p className="mt-2 text-muted-foreground">{note.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{readingTime(note.content)} min read</span>
                  <span>Updated {formatRelative(note.updated_at)}</span>
                </div>
              </header>

              <NoteMarkdown content={note.content} />

              {note.material && <RelatedResource material={note.material} />}

              <div className="mt-10 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
                {prev ? (
                  <Link
                    to="/notes/$subject/$slug"
                    params={{ subject: subjectSlug, slug: prev.slug }}
                    className="rounded-xl border border-border bg-card p-4 text-sm hover:shadow-elevated transition-shadow"
                  >
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Previous</span>
                    <span className="mt-1 block font-semibold">{prev.title}</span>
                  </Link>
                ) : <div className="hidden sm:block" />}
                {next && (
                  <Link
                    to="/notes/$subject/$slug"
                    params={{ subject: subjectSlug, slug: next.slug }}
                    className="rounded-xl border border-border bg-card p-4 text-right text-sm hover:shadow-elevated transition-shadow"
                  >
                    <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Next<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <span className="mt-1 block font-semibold">{next.title}</span>
                  </Link>
                )}
              </div>
            </article>

            {/* RIGHT: on this page */}
            <aside className="hidden xl:block">
              {toc.length > 0 && (
                <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">On this page</div>
                  <TocList items={toc} activeId={activeId} className="mt-2" />
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function TocList({
  items, activeId, className,
}: { items: ReturnType<typeof extractToc>; activeId: string | null; className?: string }) {
  return (
    <ul className={`space-y-1 text-sm ${className ?? ""}`}>
      {items.map((t) => (
        <li key={t.id} style={{ paddingLeft: t.level === 3 ? 12 : 0 }}>
          <a
            href={`#${t.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `#${t.id}`);
            }}
            className={`block rounded px-2 py-1 transition-colors ${
              activeId === t.id ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

function MobileSheet({
  title, icon: Icon, label, children,
}: { title: string; icon: typeof List; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon className="mr-2 h-4 w-4" aria-hidden="true" />{label}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <div className="mt-4" onClick={() => setOpen(false)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function RelatedResource({ material }: { material: PreviewableMaterial }) {
  const [preview, setPreview] = useState<PreviewableMaterial | null>(null);
  const dl = useMaterialDownload();
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Related resource</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">{material.title}</span>
        <Button size="sm" variant="outline" onClick={() => setPreview(material)}>
          <Eye className="mr-2 h-4 w-4" aria-hidden="true" />View PDF
        </Button>
        <Button size="sm" onClick={() => dl.download(material as never)}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />Download PDF
        </Button>
      </div>
      <MaterialPreviewDialog material={preview} onClose={() => setPreview(null)} />
    </section>
  );
}

/** Highlights the heading currently in view. */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    for (const id of list) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return active;
}
