import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, LogOut, Mail, MessageCircle, ShieldCheck, Loader2, HelpCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/pending")({
  head: () => ({
    meta: [
      { title: "Awaiting access — StudyHub" },
      { name: "description", content: "Your account is waiting for a super admin to assign a semester." },
    ],
  }),
  component: PendingPage,
});

type SuperContact = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

function digits(s: string | null | undefined) {
  return (s ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function PendingPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<{ id: string; email: string | null; name: string | null } | null>(null);
  const [check, setCheck] = useState<"checking" | "ready" | "has-role">("checking");

  // Guard: must be signed in; if already assigned a role, bounce to the right place.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const u = sess.session?.user;
      if (!u) { navigate({ to: "/auth" }); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id);
      if (!mounted) return;
      const isSuper = roles?.some((r) => r.role === "super_admin");
      const isAdmin = roles?.some((r) => r.role === "admin");
      if (isSuper) { navigate({ to: "/super" }); return; }
      if (isAdmin) { navigate({ to: "/admin" }); return; }
      setMe({
        id: u.id,
        email: u.email ?? null,
        name: (u.user_metadata?.full_name as string) ?? null,
      });
      setCheck("ready");
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const superQ = useQuery({
    enabled: check === "ready",
    queryKey: ["pending-super-contacts"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      if (error) throw error;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [] as SuperContact[];
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id,full_name,email,phone,avatar_url")
        .in("id", ids);
      if (pErr) throw pErr;
      return (profs ?? []) as SuperContact[];
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  if (check === "checking") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const supers = superQ.data ?? [];
  const waMessage = encodeURIComponent(
    `Hi, I just signed up on StudyHub as ${me?.name || me?.email || "a new user"}. Could you assign my semester so I can access the admin workspace? Thanks!`,
  );

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <SiteHeader />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 max-w-7xl w-full">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Minimal sidebar with just one item */}
          <aside className="lg:sticky lg:top-20 lg:self-start min-w-0">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-soft">
              <div className="px-3 py-2 hidden lg:block">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Your account</div>
              </div>
              <nav className="flex lg:flex-col gap-1">
                <span className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-primary/10 text-primary font-medium">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Awaiting access</span>
                </span>
              </nav>
              <div className="hidden lg:block px-2 pt-2 mt-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </Button>
              </div>
            </div>
          </aside>

          {/* Main panel */}
          <section className="min-w-0 space-y-6">
            <div className="rounded-2xl border border-border bg-card shadow-soft p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500/15 text-amber-400 shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    A super admin needs to assign your semester
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                    Thanks for signing up{me?.name ? `, ${me.name}` : ""}! Your account
                    <span className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {me?.email}
                    </span>
                    is ready — but a super admin still needs to assign you to a semester before you can open the admin workspace.
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    The fastest way to get set up is to message a super admin on WhatsApp with your signup email. You'll receive an in-app notification (and email if configured) as soon as your semester is assigned.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Contact a super admin</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  {supers.length} available
                </span>
              </div>

              {superQ.isLoading ? (
                <div className="p-10 text-center text-muted-foreground">
                  <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading contacts…
                </div>
              ) : supers.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  No super admins have been set up yet. Please contact your institution.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {supers.map((s) => {
                    const wa = digits(s.phone);
                    return (
                      <li key={s.id} className="p-4 sm:p-6 flex flex-wrap items-center gap-4">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-muted grid place-items-center text-sm font-medium">
                            {(s.full_name || s.email || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{s.full_name || "Super Admin"}</div>
                          <div className="text-xs text-muted-foreground break-all">{s.email ?? "—"}</div>
                          {s.phone && (
                            <div className="text-xs text-muted-foreground mt-0.5">{s.phone}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {wa && (
                            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                              <a
                                href={`https://wa.me/${wa}?text=${waMessage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MessageCircle className="h-4 w-4 mr-1.5" />
                                WhatsApp
                              </a>
                            </Button>
                          )}
                          {s.email && (
                            <Button asChild size="sm" variant="outline">
                              <a href={`mailto:${s.email}?subject=StudyHub%20semester%20assignment&body=${waMessage}`}>
                                <Mail className="h-4 w-4 mr-1.5" />
                                Email
                              </a>
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 flex gap-3 items-start">
              <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">What happens next?</div>
                Once a super admin assigns your semester, refresh this page or return to <Link to="/" className="text-primary hover:underline">home</Link> — your admin dashboard will unlock automatically.
              </div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
