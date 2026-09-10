import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, NotebookPen } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/notes";

export const Route = createFileRoute("/notes/")({
  head: () => ({
    meta: [
      { title: "Study Notes — StudyHub" },
      { name: "description", content: "Read web-based study notes with equations, examples and questions — no PDF needed." },
      { property: "og:title", content: "Study Notes — StudyHub" },
      { property: "og:description", content: "Web-based academic notes for every subject, with maths rendered beautifully." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotesIndexPage,
});

type Row = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  subject_id: string;
  order_index: number;
  subject: { id: string; name: string; code: string | null; semester_id: string } | null;
};

function NotesIndexPage() {
  const notesQ = useQuery({
    queryKey: ["study-notes-index"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("study_notes")
        .select("id,title,slug,description,subject_id,order_index, subject:subjects(id,name,code,semester_id)")
        .eq("published", true)
        .order("order_index", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const grouped = (() => {
    const map = new Map<string, { name: string; code: string | null; notes: Row[] }>();
    for (const n of notesQ.data ?? []) {
      if (!n.subject) continue;
      const g = map.get(n.subject.id) ?? { name: n.subject.name, code: n.subject.code, notes: [] };
      g.notes.push(n);
      map.set(n.subject.id, g);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  })();

  return (
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />
      <PageContainer>
        <PageHeader
          breadcrumbs={[{ label: "Home", to: "/" }, { label: "Study Notes" }]}
          eyebrow="Read online"
          title="Study Notes"
          description="Web-based notes you can read right here — equations, worked examples and questions, no download needed."
        />

        {notesQ.isLoading ? (
          <CardGridSkeleton count={4} height="h-32" />
        ) : notesQ.isError ? (
          <ErrorState title="We couldn't load the notes" error={notesQ.error} onRetry={() => notesQ.refetch()} />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="No study notes yet"
            description="Once an admin publishes a study note it will appear here."
          />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 stagger-children">
            {grouped.map(([subjectId, g]) => (
              <section key={subjectId} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2 className="text-base font-semibold">{g.name}</h2>
                  {g.code && <span className="text-xs text-muted-foreground">{g.code}</span>}
                </div>
                <ul className="mt-3 space-y-1">
                  {g.notes.map((n) => (
                    <li key={n.id}>
                      <Link
                        to="/notes/$subject/$slug"
                        params={{ subject: slugify(g.name), slug: n.slug }}
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {n.title}
                        {n.description && (
                          <span className="block truncate text-xs text-muted-foreground">{n.description}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
