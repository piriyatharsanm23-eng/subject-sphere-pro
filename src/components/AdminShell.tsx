import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock, FileText, LayoutDashboard, Loader2,
  LogOut, MessageSquare, ShieldAlert, Star, UserCircle2, Check, ChevronsUpDown,
  BookPlus, LifeBuoy, Video,
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
  { to: "/admin/kuppi", label: "Kuppi videos", icon: Video },
  { to: "/admin/deadlines", label: "Deadlines", icon: CalendarClock },
  { to: "/admin/modules", label: "Module requests", icon: BookPlus },
  { to: "/admin/requests", label: "Student requests", icon: MessageSquare },
  { to: "/admin/feedback", label: "Feedback", icon: Star },
  { to: "/admin/guide", label: "Guide", icon: LifeBuoy },
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
  

  const [semesterId, setSemesterIdState] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<AdminSemester[]>([]);
  const [meta, setMeta] = useState<{ userId: string; isSuper: boolean } | null>(null);
  const [unreadRequests, setUnreadRequests] = useState(0);

  // Poll unread student-request notifications every 60s.
  useEffect(() => {
    if (!meta?.userId) return;
    let stopped = false;
    const load = async () => {
      const { count } = await (supabase as any)
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", meta.userId)
        .eq("kind", "student_request")
        .is("read_at", null);
      if (!stopped) setUnreadRequests(count ?? 0);
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { stopped = true; clearInterval(iv); };
  }, [meta?.userId]);

  // Clear the badge when viewing the requests page.
  useEffect(() => {
    if (!meta?.userId) return;
    if (!path.startsWith("/admin/requests")) return;
    (async () => {
      await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", meta.userId)
        .eq("kind", "student_request")
        .is("read_at", null);
      setUnreadRequests(0);
    })();
  }, [path, meta?.userId]);

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
      const adminRows = (roles ?? []).filter((r) => r.role === "admin" && r.assigned_semester_id);
      const superRow = (roles ?? []).find((r) => r.role === "super_admin");

      if (adminRows.length === 0 && !superRow && !isSuper) {
        setState("denied");
        return;
      }

      let list: AdminSemester[] = [];
      if (isSuper || superRow) {
        const { data: all } = await supabase.from("semesters").select("id,name").order("name");
        list = all ?? [];
      } else {
        const ids = adminRows.map((r) => r.assigned_semester_id!).filter(Boolean);
        if (ids.length > 0) {
          const { data: sems } = await supabase.from("semesters").select("id,name").in("id", ids).order("name");
          list = sems ?? [];
        }
      }
      if (!mounted) return;
      if (list.length === 0) { setState("no-semester"); return; }

      const saved = typeof window !== "undefined" ? localStorage.getItem("admin.semesterId") : null;
      const initial = list.find((s) => s.id === saved)?.id ?? list[0].id;

      setSemesters(list);
      setSemesterIdState(initial);
      setMeta({ userId: uid, isSuper: !!isSuper });
      setState("ok");
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const setSemesterId = (id: string) => {
    setSemesterIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("admin.semesterId", id);
  };

  const ctx: AdminContext | null = meta && semesterId
    ? {
        userId: meta.userId,
        semesterId,
        semesterName: semesters.find((s) => s.id === semesterId)?.name ?? "Semester",
        isSuper: meta.isSuper,
        semesters,
        setSemesterId,
      }
    : null;


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
    if (typeof window !== "undefined") {
      navigate({ to: "/pending" });
    }
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <div className="px-2 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 hidden lg:block">Current semester</div>
                <SemesterPicker
                  semesters={ctx.semesters}
                  value={ctx.semesterId}
                  onChange={ctx.setSemesterId}
                />
              </div>

              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible scrollbar-thin">
                {NAV.map((item) => {
                  const active = item.exact ? path === item.to : path.startsWith(item.to);
                  const showBadge = item.to === "/admin/requests" && unreadRequests > 0;
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
                      {showBadge && (
                        <span className="ml-auto rounded-full bg-rose-500 text-white text-[10px] font-semibold px-1.5 min-w-[18px] text-center tabular-nums">
                          {unreadRequests > 99 ? "99+" : unreadRequests}
                        </span>
                      )}
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

function SemesterPicker({
  semesters,
  value,
  onChange,
}: {
  semesters: AdminSemester[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = semesters.find((s) => s.id === value);
  if (semesters.length <= 1) {
    return (
      <div className="mt-1 text-sm font-semibold truncate px-1">{current?.name ?? "Semester"}</div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-1 w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent/40 transition-colors"
        >
          <span className="truncate">{current?.name ?? "Select semester"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
          {semesters.length} semesters
        </div>
        <div className="max-h-64 overflow-auto">
          {semesters.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-accent/40 ${
                s.id === value ? "font-semibold text-primary" : ""
              }`}
            >
              <Check className={`h-4 w-4 ${s.id === value ? "opacity-100" : "opacity-0"}`} />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

