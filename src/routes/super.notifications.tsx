import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { Bell, Check, CheckCheck, ExternalLink, Filter, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/super/notifications")({
  head: () => ({ meta: [{ title: "Notifications — StudyHub" }] }),
  component: NotificationsPage,
});

type Notif = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const KIND_LABELS: Record<string, string> = {
  student_request: "Student request",
  feedback: "Feedback",
  module_request: "Module request",
  role_assigned: "Role assigned",
  change_requested: "Change requested",
  report_submitted: "Material report",
};

const KIND_BADGE: Record<string, string> = {
  student_request: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  feedback: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  module_request: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  role_assigned: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  change_requested: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  report_submitted: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
};

function NotificationsPage() {
  return (
    <SuperShell title="Notifications" description="All alerts sent to your account.">
      <NotificationsView />
    </SuperShell>
  );
}

function NotificationsView() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");

  useMemo(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
  }, []);

  const notifsQ = useQuery({
    queryKey: ["super-notifications", uid, kindFilter, statusFilter],
    enabled: !!uid,
    queryFn: async () => {
      let qb = supabase
        .from("notifications")
        .select("id,user_id,kind,title,body,link,read_at,created_at")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (kindFilter !== "all") qb = qb.eq("kind", kindFilter);
      if (statusFilter === "unread") qb = qb.is("read_at", null);
      if (statusFilter === "read") qb = qb.not("read_at", "is", null);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  const kinds = useMemo(() => {
    const set = new Set<string>();
    (notifsQ.data ?? []).forEach((n) => set.add(n.kind));
    Object.keys(KIND_LABELS).forEach((k) => set.add(k));
    return Array.from(set);
  }, [notifsQ.data]);

  const filtered = useMemo(() => {
    const list = notifsQ.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(needle) ||
        (n.body ?? "").toLowerCase().includes(needle),
    );
  }, [notifsQ.data, q]);

  const unreadCount = (notifsQ.data ?? []).filter((n) => !n.read_at).length;

  const markRead = async (id: string, read: boolean) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["super-notifications"] });
  };

  const markAllRead = async () => {
    if (!uid) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", uid)
      .is("read_at", null);
    if (error) return toast.error(error.message);
    toast.success("All notifications marked as read");
    qc.invalidateQueries({ queryKey: ["super-notifications"] });
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search notifications…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>{KIND_LABELS[k] ?? k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" />
            {filtered.length} shown · {unreadCount} unread
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {notifsQ.isLoading ? (
          <div className="py-14 text-center text-muted-foreground">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-muted-foreground">
            <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
            No notifications match these filters.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((n) => {
              const unread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className={`p-4 flex items-start gap-3 transition-colors ${
                    unread ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="mt-1">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        unread ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          KIND_BADGE[n.kind] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {KIND_LABELS[n.kind] ?? n.kind}
                      </span>
                      <div className="font-medium truncate">{n.title}</div>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{n.body}</p>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(n.created_at), "MMM d, h:mm a")} ·{" "}
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      {n.read_at && (
                        <> · read {formatDistanceToNow(new Date(n.read_at), { addSuffix: true })}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.link && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={n.link}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead(n.id, unread)}
                      title={unread ? "Mark as read" : "Mark as unread"}
                    >
                      <Check className={`h-4 w-4 ${unread ? "" : "opacity-40"}`} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
