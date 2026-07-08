import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, CalendarClock, GraduationCap } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type Contributor = {
  id: string;
  role: string;
  assigned_semester_id: string | null;
  semester_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type MaterialRow = {
  id: string;
  title: string;
  material_type: string | null;
  week_or_module: string | null;
  created_at: string;
  subject: { id: string; name: string; code: string | null } | null;
};

type DeadlineRow = {
  id: string;
  title: string;
  deadline_at: string;
  status: string | null;
  created_at: string;
  subject: { id: string; name: string; code: string | null } | null;
};

export const Route = createFileRoute("/contributors_/$id")({
  head: () => ({
    meta: [
      { title: "Contributor — StudyHub" },
      { name: "description", content: "See what this StudyHub admin has uploaded and the semester they curate." },
    ],
  }),
  component: ContributorProfile,
});

function initials(name: string | null | undefined) {
  const src = (name || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatMaterialType(t: string | null) {
  if (!t) return "Material";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ContributorProfile() {
  const { id } = Route.useParams();

  const contributor = useQuery({
    queryKey: ["contributor", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_contributors")
        .select("id,role,assigned_semester_id,semester_name,full_name,avatar_url")
        .eq("id", id);
      if (error) throw error;
      const rows = (data ?? []) as Contributor[];
      return rows[0] ?? null;
    },
    staleTime: 60_000,
  });

  const materials = useQuery({
    queryKey: ["contributor-materials", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials").eq("pending_delete", false)
        .select("id,title,material_type,week_or_module,created_at,subject:subjects(id,name,code)")
        .eq("uploaded_by", id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as MaterialRow[];
    },
    staleTime: 60_000,
  });

  const deadlines = useQuery({
    queryKey: ["contributor-deadlines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines").eq("pending_delete", false)
        .select("id,title,deadline_at,status,created_at,subject:subjects(id,name,code)")
        .eq("created_by", id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DeadlineRow[];
    },
    staleTime: 60_000,
  });

  const c = contributor.data;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-10">
        <Link to="/contributors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> All contributors
        </Link>

        {contributor.isLoading ? (
          <div className="mt-6 h-40 rounded-2xl border border-border bg-card animate-pulse" />
        ) : !c ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Contributor not found.
          </div>
        ) : (
          <>
            <header className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <Avatar className="h-20 w-20 ring-4 ring-primary/10">
                  {c.avatar_url ? <AvatarImage src={c.avatar_url} alt={c.full_name ?? "Admin"} /> : null}
                  <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                    {initials(c.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold truncate">{c.full_name || "Unnamed admin"}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {c.semester_name ? `Handles ${c.semester_name}` : "Semester unassigned"}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:gap-6 text-center sm:text-right">
                  <Stat label="Materials" value={materials.data?.length ?? 0} />
                  <Stat label="Deadlines" value={deadlines.data?.length ?? 0} />
                </div>
              </div>
            </header>

            <section className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="font-semibold">Upload history</h2>
                <span className="text-xs text-muted-foreground">({materials.data?.length ?? 0})</span>
              </div>
              {materials.isLoading ? (
                <div className="h-24 rounded-2xl border border-border bg-card animate-pulse" />
              ) : (materials.data ?? []).length === 0 ? (
                <EmptyRow text="No materials uploaded yet." />
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {(materials.data ?? []).map((m) => (
                    <Link
                      key={m.id}
                      to="/subject/$id"
                      params={{ id: m.subject?.id ?? "" }}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition-all"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate group-hover:text-primary transition-colors">{m.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{formatMaterialType(m.material_type)}</Badge>
                          {m.subject && <span className="truncate">{m.subject.code ? `${m.subject.code} · ` : ""}{m.subject.name}</span>}
                          {m.week_or_module && <span>· {m.week_or_module}</span>}
                          <span>· {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <h2 className="font-semibold">Deadlines created</h2>
                <span className="text-xs text-muted-foreground">({deadlines.data?.length ?? 0})</span>
              </div>
              {deadlines.isLoading ? (
                <div className="h-20 rounded-2xl border border-border bg-card animate-pulse" />
              ) : (deadlines.data ?? []).length === 0 ? (
                <EmptyRow text="No deadlines created yet." />
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {(deadlines.data ?? []).map((d) => (
                    <Link
                      key={d.id}
                      to="/subject/$id"
                      params={{ id: d.subject?.id ?? "" }}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition-all"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate group-hover:text-primary transition-colors">{d.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {d.subject && <span className="truncate">{d.subject.code ? `${d.subject.code} · ` : ""}{d.subject.name}</span>}
                          <span>· Due {formatDistanceToNow(new Date(d.deadline_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
