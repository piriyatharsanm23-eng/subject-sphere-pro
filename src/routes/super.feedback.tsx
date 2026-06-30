import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Super Admin" }] }),
  component: FeedbackPage,
});

type Fb = {
  id: string; feedback_text: string; rating: number | null;
  semester_id: string | null; subject_id: string | null; created_at: string;
};


function FeedbackPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sem, setSem] = useState("all");
  const [minRating, setMinRating] = useState("all");

  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => (await supabase.from("semesters").select("id,name").order("name")).data ?? [],
  });
  const subjectsQ = useQuery({
    queryKey: ["super-all-subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id,name")).data ?? [],
  });

  const listQ = useQuery({
    queryKey: ["super-feedback", sem, minRating],
    queryFn: async () => {
      let qb = supabase
        .from("feedback")
        .select("id,feedback_text,rating,semester_id,subject_id,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (sem !== "all") qb = qb.eq("semester_id", sem);
      if (minRating !== "all") qb = qb.gte("rating", Number(minRating));
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Fb[];
    },
  });

  const semById = useMemo(() => Object.fromEntries((semestersQ.data ?? []).map((s) => [s.id, s])), [semestersQ.data]);
  const subById = useMemo(() => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])), [subjectsQ.data]);

  const rows = useMemo(() => {
    const list = listQ.data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter((f) =>
      f.feedback_text.toLowerCase().includes(n) ||
      (f.student_name ?? "").toLowerCase().includes(n) ||
      (f.student_email ?? "").toLowerCase().includes(n),
    );
  }, [listQ.data, q]);

  const avg = useMemo(() => {
    const ratings = (listQ.data ?? []).map((f) => f.rating).filter((r): r is number => typeof r === "number");
    if (!ratings.length) return null;
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
  }, [listQ.data]);

  const remove = async (f: Fb) => {
    if (!confirm("Delete this feedback?")) return;
    const { error } = await supabase.from("feedback").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["super-feedback"] });
  };

  return (
    <SuperShell title="Student Feedback" description="Browse feedback and ratings from students.">
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total feedback</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{listQ.data?.length ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Average rating</div>
          <div className="mt-1 text-2xl font-bold tabular-nums inline-flex items-center gap-1">
            {avg ?? "—"} {avg && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">5-star</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {(listQ.data ?? []).filter((f) => f.rating === 5).length}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft mb-4">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={sem} onValueChange={setSem}>
            <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {(semestersQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={minRating} onValueChange={setMinRating}>
            <SelectTrigger><SelectValue placeholder="Min rating" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any rating</SelectItem>
              <SelectItem value="5">5 stars</SelectItem>
              <SelectItem value="4">4+ stars</SelectItem>
              <SelectItem value="3">3+ stars</SelectItem>
              <SelectItem value="1">1+ stars</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {listQ.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">No feedback yet.</div>
        ) : (
          rows.map((f) => (
            <div key={f.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{f.student_name || "Anonymous"}</span>
                    {f.student_email && <span className="text-muted-foreground text-xs">{f.student_email}</span>}
                    {typeof f.rating === "number" && (
                      <span className="inline-flex items-center gap-0.5 ml-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < (f.rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40"}`} />
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{f.feedback_text}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(f.created_at), "MMM d, yyyy")} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                    {f.semester_id && <> · {semById[f.semester_id]?.name}</>}
                    {f.subject_id && <> · {subById[f.subject_id]?.name}</>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => remove(f)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </SuperShell>
  );
}
