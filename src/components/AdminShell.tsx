import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock, FileText, LayoutDashboard, Loader2,
  LogOut, MessageSquare, ShieldAlert, Star, UserCircle2, Check, ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


export type AdminSemester = { id: string; name: string };
export type AdminContext = {
  userId: string;
  semesterId: string;
  semesterName: string;
  isSuper: boolean;
  semesters: AdminSemester[];
  setSemesterId: (id: string) => void;
};

type NavItem = { to: string; label: string; icon: typeof FileText; exact?: boolean };

const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/materials", label: "Materials", icon: FileText },
  { to: "/admin/deadlines", label: "Deadlines", icon: CalendarClock },
  { to: "/admin/requests", label: "Requests", icon: MessageSquare },
  { to: "/admin/feedback", label: "Feedback", icon: Star },
  { to: "/admin/profile", label: "Profile", icon: UserCircle2 },
];

export function AdminShell({
  title, description, children,
}: {
  title: string;
  description?: string;
  children: (ctx: AdminContext) => ReactNode;
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<"checking" | "denied" | "no-semester" | "ok">("checking");
  const [ctx, setCtx] = useState<AdminContext | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) { navigate({ to: "/auth" }); return; }

      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: uid });
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, assigned_semester_id")
        .eq("user_id", uid);

      if (!mounted) return;
      const adminRow = (roles ?? []).find((r) => r.role === "admin");
      const superRow = (roles ?? []).find((r) => r.role === "super_admin");

      if (!adminRow && !superRow && !isSuper) {
        setState("denied");
        return;
      }

      let semesterId = adminRow?.assigned_semester_id ?? null;
      // Super admins without an assignment fall back to the newest active semester
      if (!semesterId) {
        const { data: sem } = await supabase
          .from("semesters")
          .select("id")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        semesterId = sem?.id ?? null;
      }
      if (!semesterId) { setState("no-semester"); return; }

      const { data: semRow } = await supabase
        .from("semesters").select("id,name").eq("id", semesterId).maybeSingle();

      setCtx({
        userId: uid,
        semesterId,
        semesterName: semRow?.name ?? "Semester",
        isSuper: !!isSuper,
      });
      setState("ok");
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

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
          <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Signed in. An administrator must assign you a role and semester before you can access this workspace.
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <Button asChild variant="outline"><Link to="/">Back home</Link></Button>
            <Button variant="ghost" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "no-semester" || !ctx) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-4 text-xl font-semibold">No semester assigned</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            You don't have an assigned semester yet. Ask a super admin to assign one.
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <Button asChild variant="outline"><Link to="/">Back home</Link></Button>
            <Button variant="ghost" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <SiteHeader />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 max-w-7xl w-full">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:self-start min-w-0">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-soft">
              <div className="px-3 py-2 hidden lg:block">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Admin</div>
                <div className="mt-0.5 text-sm font-semibold truncate">{ctx.semesterName}</div>
              </div>
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible scrollbar-thin">
                {NAV.map((item) => {
                  const active = item.exact ? path === item.to : path.startsWith(item.to);
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
                    </Link>
                  );
                })}
              </nav>
              <div className="hidden lg:block px-2 pt-2 mt-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </Button>
              </div>
            </div>
          </aside>
          <section className="min-w-0">
            <div className="mb-4 sm:mb-6 flex flex-wrap items-end gap-3 justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </div>
              <div className="text-xs text-muted-foreground rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1">
                {ctx.isSuper ? "Super admin" : "Admin"} · {ctx.semesterName}
              </div>
            </div>
            {children(ctx)}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
