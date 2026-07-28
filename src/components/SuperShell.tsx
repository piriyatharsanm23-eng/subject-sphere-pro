import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity, BarChart3, BookOpen, CalendarClock, ClipboardCheck, FileText,
  LayoutDashboard, Library, Loader2, MessageSquare, ShieldAlert,
  Star, User, Users, BookPlus, KeyRound, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

type NavItem = { to: string; label: string; icon: typeof Activity; exact?: boolean };
function useSuperNav(): NavItem[] {
  const { t } = useT();
  return [
    { to: "/super", label: t("super.overview"), icon: LayoutDashboard, exact: true },
    { to: "/super/notifications", label: t("super.notifications"), icon: Bell },
    { to: "/super/semesters", label: t("super.semesters"), icon: BookOpen },
    { to: "/super/subjects", label: t("super.subjects"), icon: Library },
    { to: "/super/modules", label: t("super.moduleRequests"), icon: BookPlus },
    { to: "/super/admins", label: t("super.admins"), icon: Users },
    { to: "/super/users", label: t("super.users"), icon: Users },
    { to: "/super/materials", label: t("super.materials"), icon: FileText },
    { to: "/super/deadlines", label: t("super.deadlines"), icon: CalendarClock },
    { to: "/super/requests", label: t("super.requests"), icon: MessageSquare },
    { to: "/super/pending", label: t("super.pending"), icon: ClipboardCheck },
    { to: "/super/feedback", label: t("super.feedback"), icon: Star },
    { to: "/super/analytics", label: t("super.analytics"), icon: BarChart3 },
    { to: "/super/activity", label: t("super.activity"), icon: Activity },
    { to: "/super/auth-settings", label: t("super.authSettings"), icon: KeyRound },
    { to: "/super/profile", label: t("super.profile"), icon: User },
  ];
}

export function SuperShell({
  title, description, children,
}: { title: string; description?: string; children: ReactNode }) {
  const { t } = useT();
  const NAV = useSuperNav();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking");
  const [uid, setUid] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const u = sess.session?.user.id;
      if (!u) { navigate({ to: "/auth" }); return; }
      const { data, error } = await supabase.rpc("is_super_admin", { _user_id: u });
      if (!mounted) return;
      if (error || !data) { setState("denied"); return; }
      setUid(u);
      setState("ok");
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // Poll unread notifications grouped by kind.
  useEffect(() => {
    if (!uid) return;
    let stopped = false;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("notifications")
        .select("kind")
        .eq("user_id", uid)
        .is("read_at", null);
      if (stopped) return;
      const counts: Record<string, number> = {};
      for (const r of (data ?? []) as { kind: string }[]) {
        counts[r.kind] = (counts[r.kind] ?? 0) + 1;
      }
      setUnread(counts);
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { stopped = true; clearInterval(iv); };
  }, [uid]);

  // Clear a badge when viewing its page.
  useEffect(() => {
    if (!uid) return;
    const map: Record<string, string> = {
      "/super/requests": "student_request",
      "/super/feedback": "feedback",
      "/super/modules": "module_request",
    };
    const kind = Object.entries(map).find(([p]) => path.startsWith(p))?.[1];
    if (!kind) return;
    (async () => {
      await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("kind", kind)
        .is("read_at", null);
      setUnread((prev) => ({ ...prev, [kind]: 0 }));
    })();
  }, [path, uid]);


  if (state === "checking") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-4 text-xl font-semibold">Super Admin access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">You don't have permission to view this page.</p>
          <Button asChild className="mt-6"><Link to="/">Back home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <SiteHeader />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 max-w-7xl w-full">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-20 lg:self-start min-w-0">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-soft">
              <div className="px-3 py-2 hidden lg:block">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Super Admin</div>
              </div>
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible scrollbar-thin">
                {NAV.map((item) => {
                  const active = item.exact ? path === item.to : path.startsWith(item.to);
                  const badgeKind =
                    item.to === "/super/requests" ? "student_request" :
                    item.to === "/super/feedback" ? "feedback" :
                    item.to === "/super/modules" ? "module_request" : null;
                  const count = badgeKind ? (unread[badgeKind] ?? 0) : 0;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors shrink-0 lg:shrink ${
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                      {count > 0 && (
                        <span className="ml-auto rounded-full bg-rose-500 text-white text-[10px] font-semibold px-1.5 min-w-[18px] text-center tabular-nums">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
          {/* Content */}
          <section className="min-w-0">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {children}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
