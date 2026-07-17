import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/users")({
  head: () => ({ meta: [{ title: "All accounts — Super Admin" }] }),
  component: UsersPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
};
type RoleRow = { user_id: string; role: "admin" | "super_admin"; assigned_semester_id: string | null };

function UsersPage() {
  const [q, setQ] = useState("");

  const profilesQ = useQuery({
    queryKey: ["super-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["super-all-roles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id,role,assigned_semester_id");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const rolesByUser = useMemo(() => {
    const map: Record<string, RoleRow[]> = {};
    for (const r of rolesQ.data ?? []) (map[r.user_id] ??= []).push(r);
    return map;
  }, [rolesQ.data]);

  const rows = useMemo(() => {
    const all = profilesQ.data ?? [];
    if (!q.trim()) return all;
    const n = q.toLowerCase();
    return all.filter(
      (p) =>
        (p.email ?? "").toLowerCase().includes(n) ||
        (p.full_name ?? "").toLowerCase().includes(n),
    );
  }, [profilesQ.data, q]);

  return (
    <SuperShell title="All accounts" description="Every user who has signed up, with their email and current role.">
      <div className="mb-4 relative w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {profilesQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">User</th>
                  <th className="text-left font-medium px-4 py-3">Email</th>
                  <th className="text-left font-medium px-4 py-3">Role</th>
                  <th className="text-left font-medium px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => {
                  const roles = rolesByUser[p.id] ?? [];
                  const isSuper = roles.some((r) => r.role === "super_admin");
                  const adminCount = roles.filter((r) => r.role === "admin").length;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-xs font-medium">
                              {(p.full_name || p.email || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="font-medium">{p.full_name || "—"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 break-all text-muted-foreground">{p.email ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border bg-violet-500/15 text-violet-300 border-violet-500/30">
                            <ShieldCheck className="h-3 w-3" />Super Admin
                          </span>
                        ) : adminCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                            <ShieldCheck className="h-3 w-3" />Admin · {adminCount} sem
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Student / no role</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SuperShell>
  );
}
