import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminShell, type AdminContext } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Admin" }] }),
  component: () => (
    <AdminShell title="Student feedback" description="Ratings and comments from students in your semester.">
      {(ctx) => <FeedbackPage ctx={ctx} />}
    </AdminShell>
  ),
});

type Fb = {
  id: string; feedback_text: string; rating: number | null;
  semester_id: string | null; subject_id: string | null; created_at: string;
};

function FeedbackPage({ ctx }: { ctx: AdminContext }) {
  const [q, setQ] = useState("");
  const [minRating, setMinRating] = useState("all");

  const subjectsQ = useQuery({
    queryKey: ["admin-subjects", ctx.semesterId],
    queryFn: async () => (await supabase.from("subjects").select("id,name").eq("semester_id", ctx.semesterId)).data ?? [],
  });

  const listQ = useQuery({
    queryKey: ["admin-feedback", ctx.semesterId, minRating],
    queryFn: async () => {
      let qb = supabase
        .from("feedback")
        .select("id,feedback_text,rating,semester_id,subject_id,created_at")
        .eq("semester_id", ctx.semesterId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (minRating !== "all") qb = qb.gte("rating", Number(minRating));
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as Fb[];
    },
  });

  const subById = useMemo(
    () => Object.fromEntries((subjectsQ.data ?? []).map((s) => [s.id, s])),
    [subjectsQ.data],
  );

  const rows = useMemo(() => {
    const list = listQ.data ?? [];
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter((f) => f.feedback_text.toLowerCase().includes(n));
  }, [listQ.data, q]);

  const avg = useMemo(() => {
    const ratings = (listQ.data ?? []).map((f) => f.rating).filter((r): r is number => typeof r === "number");
    if (!ratings.length) return null;
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
  }, [listQ.data]);

  return (
    <>
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
        <div className="grid gap-2 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
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
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Anonymous</span>
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
                {f.subject_id && <> · {subById[f.subject_id]?.name}</>}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
