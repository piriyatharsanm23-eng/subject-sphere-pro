import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/super")({
  head: () => ({ meta: [{ title: "Super Admin — StudyHub" }] }),
  component: SuperHome,
});

function SuperHome() {
  const cards = [
    { to: "/super/activity" as const, icon: Activity, title: "Activity Logs", desc: "Audit every upload, edit, delete, deadline and admin assignment.", live: true },
    { to: "/super" as const, icon: Users, title: "Admins & Semesters", desc: "Assign admins to semesters and manage roles.", live: false },
    { to: "/super" as const, icon: BarChart3, title: "Analytics", desc: "Downloads, popular materials, engagement.", live: false },
  ];
  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 py-10 flex-1 max-w-7xl w-full">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Super Admin</div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">Control center</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the platform end-to-end.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.title} to={c.to} className="group rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></div>
                {!c.live && <span className="text-[10px] uppercase tracking-wider rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Soon</span>}
              </div>
              <h3 className="mt-4 font-semibold group-hover:text-primary transition-colors">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              {c.live && <div className="mt-3 inline-flex items-center text-sm font-medium text-primary">Open <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" /></div>}
            </Link>
          ))}
        </div>
        <div className="mt-10">
          <Button asChild variant="outline"><Link to="/">Back to site</Link></Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
