import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Contributor = {
  id: string;
  role: string;
  assigned_semester_id: string | null;
  semester_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export const Route = createFileRoute("/contributors")({
  head: () => ({
    meta: [
      { title: "Contributors — StudyHub" },
      { name: "description", content: "Meet the admins who curate and upload learning materials for each semester on StudyHub." },
      { property: "og:title", content: "Contributors — StudyHub" },
      { property: "og:description", content: "Meet the admins who curate and upload learning materials on StudyHub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContributorsPage,
});

function initials(name: string | null | undefined) {
  const src = (name || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function ContributorsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["contributors"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_contributors")
        .select("id,role,assigned_semester_id,semester_name,full_name,avatar_url")
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Contributor[];
    },
    staleTime: 60_000,
  });

  const admins = (data ?? []).filter((c) => c.role === "admin");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Users className="h-3.5 w-3.5" /> StudyHub team
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Contributors</h1>
          <p className="mt-2 text-muted-foreground">
            The admins behind the semesters — tap anyone to see their upload history.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {admins.length > 0 && (
              <Section title="Semester admins" icon={<GraduationCap className="h-4 w-4" />} items={admins} />
            )}
            {admins.length === 0 && (
              <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                No contributors yet.
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, icon, items }: { title: string; icon: React.ReactNode; items: Contributor[] }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Link
            key={`${c.id}-${c.role}`}
            to="/contributors/$id"
            params={{ id: c.id }}
            className="group rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-primary/40 hover:shadow-elevated transition-all"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                {c.avatar_url ? <AvatarImage src={c.avatar_url} alt={c.full_name ?? "Admin"} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials(c.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold truncate group-hover:text-primary transition-colors">
                  {c.full_name || "Unnamed admin"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {c.role === "super_admin" ? (
                    <Badge variant="secondary" className="text-[10px]">Super admin</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {c.semester_name ? c.semester_name : "Unassigned"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
