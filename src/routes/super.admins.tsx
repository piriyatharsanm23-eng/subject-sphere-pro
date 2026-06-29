import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/super/admins")({
  head: () => ({ meta: [{ title: "Admins — Super Admin" }] }),
  component: AdminsPage,
});

type Role = "admin" | "super_admin";
type RoleRow = {
  id: string; user_id: string; role: Role; assigned_semester_id: string | null;
};
type Profile = { id: string; full_name: string | null; email: string | null };
type Semester = { id: string; name: string };

function AdminsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const rolesQ = useQuery({
    queryKey: ["super-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id,user_id,role,assigned_semester_id");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["super-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("semesters").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Semester[];
    },
  });

  const profileById = useMemo(
    () => Object.fromEntries((profilesQ.data ?? []).map((p) => [p.id, p])),
    [profilesQ.data],
  );
  const semById = useMemo(
    () => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])),
    [semestersQ.data],
  );

  const rows = useMemo(() => {
    const all = rolesQ.data ?? [];
    if (!q.trim()) return all;
    const n = q.toLowerCase();
    return all.filter((r) => {
      const p = profileById[r.user_id];
      return (p?.email ?? "").toLowerCase().includes(n) || (p?.full_name ?? "").toLowerCase().includes(n);
    });
  }, [rolesQ.data, q, profileById]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["super-roles"] });

  const removeRole = async (r: RoleRow) => {
    if (r.role === "super_admin" && !confirm("Remove super-admin privileges from this user?")) return;
    if (r.role === "admin" && !confirm("Remove admin role from this user?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    const p = profileById[r.user_id];
    await logActivity({
      action_type: "admin_assign",
      description: `Removed ${r.role} role from ${p?.email ?? r.user_id}`,
      target_type: "user_role", target_id: r.id,
      semester_id: r.assigned_semester_id,
    });
    toast.success("Role removed");
    refresh();
  };

  const changeSemester = async (r: RoleRow, newSemester: string) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ assigned_semester_id: newSemester })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    const p = profileById[r.user_id];
    await logActivity({
      action_type: "admin_assign",
      description: `Reassigned admin ${p?.email ?? r.user_id} to ${semById[newSemester]?.name ?? "semester"}`,
      target_type: "user_role", target_id: r.id, semester_id: newSemester,
    });
    toast.success("Semester reassigned");
    refresh();
  };

  return (
    <SuperShell title="Admins" description="Assign and remove admin roles per semester.">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" />Assign admin</Button>
          </DialogTrigger>
          <AssignDialog
            profiles={profilesQ.data ?? []}
            semesters={semestersQ.data ?? []}
            existing={rolesQ.data ?? []}
            onSaved={() => { setOpen(false); refresh(); }}
          />
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {rolesQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No admins yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">User</th>
                <th className="text-left font-medium px-4 py-3">Role</th>
                <th className="text-left font-medium px-4 py-3">Semester</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const p = profileById[r.user_id];
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p?.email ?? r.user_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                        r.role === "super_admin"
                          ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      }`}>
                        <ShieldCheck className="h-3 w-3" />
                        {r.role === "super_admin" ? "Super Admin" : "Admin"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.role === "admin" ? (
                        <Select
                          value={r.assigned_semester_id ?? ""}
                          onValueChange={(v) => changeSemester(r, v)}
                        >
                          <SelectTrigger className="w-56"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {(semestersQ.data ?? []).map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : <span className="text-muted-foreground">All semesters</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => removeRole(r)}>
                        <ShieldOff className="h-4 w-4 mr-1" />Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </SuperShell>
  );
}

function AssignDialog({
  profiles, semesters, existing, onSaved,
}: {
  profiles: Profile[]; semesters: Semester[]; existing: RoleRow[]; onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [semesterId, setSemesterId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const target = profiles.find((p) => (p.email ?? "").toLowerCase() === email.trim().toLowerCase());
    if (!target) return toast.error("No user with that email. Ask them to sign up at /auth first.");
    if (role === "admin" && !semesterId) return toast.error("Choose a semester for the admin");

    // remove any existing role of same kind to avoid unique constraint issues
    const dupes = existing.filter((r) => r.user_id === target.id && r.role === role);
    for (const d of dupes) {
      await supabase.from("user_roles").delete().eq("id", d.id);
    }

    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({
      user_id: target.id, role,
      assigned_semester_id: role === "admin" ? semesterId : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);

    await logActivity({
      action_type: "admin_assign",
      description: `Assigned ${role} to ${target.email}` + (role === "admin" ? ` for ${semesters.find((s) => s.id === semesterId)?.name}` : ""),
      target_type: "user_role", target_id: target.id,
      semester_id: role === "admin" ? semesterId : null,
    });
    toast.success("Role assigned");
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Assign admin role</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">User email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          <p className="text-xs text-muted-foreground mt-1">The user must have already signed up.</p>
        </div>
        <div>
          <label className="text-sm font-medium">Role</label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin (one semester)</SelectItem>
              <SelectItem value="super_admin">Super Admin (full access)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {role === "admin" && (
          <div>
            <label className="text-sm font-medium">Semester</label>
            <Select value={semesterId} onValueChange={setSemesterId}>
              <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
              <SelectContent>
                {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
