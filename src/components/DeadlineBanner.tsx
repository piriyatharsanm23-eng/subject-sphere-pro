import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Clock, ListChecks, FileText, LayoutList, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  formatDistanceToNowStrict,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { Button } from "@/components/ui/button";

export type DeadlineItem = {
  id: string;
  title: string;
  description: string | null;
  deadline_at: string;
  subject_id: string;
};

type Subject = { id: string; name: string };

type Severity = "urgent" | "soon" | "upcoming";

function severityOf(date: Date): Severity {
  const diffMs = date.getTime() - Date.now();
  const hours = diffMs / 36e5;
  if (hours <= 24) return "urgent";
  if (hours <= 72) return "soon";
  return "upcoming";
}

const SEVERITY_STYLES: Record<Severity, { card: string; chip: string; icon: string; label: string; Icon: typeof AlertTriangle }> = {
  urgent: {
    card: "bg-gradient-to-br from-rose-500/20 via-orange-500/15 to-rose-500/10 border-rose-500/40",
    chip: "bg-rose-500/20 text-rose-200 border border-rose-400/40",
    icon: "bg-rose-500/20 text-rose-200",
    label: "Urgent",
    Icon: AlertTriangle,
  },
  soon: {
    card: "bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/10 border-amber-400/40",
    chip: "bg-amber-400/20 text-amber-100 border border-amber-300/40",
    icon: "bg-amber-400/20 text-amber-100",
    label: "Due Soon",
    Icon: Clock,
  },
  upcoming: {
    card: "bg-gradient-to-br from-sky-500/15 via-teal-500/10 to-emerald-500/10 border-sky-400/40",
    chip: "bg-sky-400/20 text-sky-100 border border-sky-300/40",
    icon: "bg-sky-400/20 text-sky-100",
    label: "Upcoming",
    Icon: CalendarClock,
  },
};

export function DeadlineBanner({
  deadlines,
  subjectsById,
}: {
  deadlines: DeadlineItem[];
  subjectsById: Record<string, Subject>;
}) {
  // sorted nearest first, hide expired (defensive — caller already filters)
  const now = Date.now();
  const active = deadlines
    .filter((d) => new Date(d.deadline_at).getTime() > now)
    .sort((a, b) => +new Date(a.deadline_at) - +new Date(b.deadline_at));

  if (active.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft text-center">
        <CalendarClock className="mx-auto h-7 w-7 text-muted-foreground" />
        <h3 className="mt-2 font-semibold">No upcoming deadlines</h3>
        <p className="mt-1 text-sm text-muted-foreground">You're all caught up for the subjects you selected.</p>
      </section>
    );
  }

  const top = active.slice(0, 3);

  return (
    <section aria-label="Upcoming deadlines">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold">Deadline reminders</h2>
        </div>
        <span className="text-xs text-muted-foreground">{active.length} active</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {top.map((d) => {
          const date = new Date(d.deadline_at);
          const sev = severityOf(date);
          const s = SEVERITY_STYLES[sev];
          const subject = subjectsById[d.subject_id]?.name ?? "";
          const remaining = formatDistanceToNowStrict(date);
          const msg =
            sev === "urgent" ? `Urgent: ${d.title} deadline ${remaining === "1 day" ? "tomorrow" : `in ${remaining}`}.` :
            sev === "soon" ? `${d.title} deadline in ${remaining}.` :
            `${d.title} deadline on ${format(date, "MMM d")}.`;
          return (
            <article key={d.id} className={`relative overflow-hidden rounded-2xl border p-5 shadow-soft hover:shadow-elevated transition-shadow ${s.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${s.icon}`}>
                  <s.Icon className="h-5 w-5" />
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${s.chip}`}>
                  {s.label}
                </span>
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-wider text-foreground/70">{subject}</div>
              <h3 className="mt-1 text-base font-semibold leading-snug">{d.title}</h3>
              <p className="mt-2 text-sm text-foreground/80 line-clamp-2">{msg}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="text-xs text-foreground/75">
                  <div className="font-medium">{format(date, "EEE, MMM d · h:mm a")}</div>
                  <div className="opacity-80">in {remaining}</div>
                </div>
                <Button asChild size="sm" variant="secondary" className="bg-background/40 hover:bg-background/60 border border-border/50 backdrop-blur">
                  <Link to="/subject/$id" params={{ id: d.subject_id }}>View details</Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function AllDeadlinesList({
  deadlines,
  subjectsById,
}: {
  deadlines: DeadlineItem[];
  subjectsById: Record<string, Subject>;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const active = deadlines
    .filter((d) => new Date(d.deadline_at).getTime() > Date.now())
    .sort((a, b) => +new Date(a.deadline_at) - +new Date(b.deadline_at));

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">All deadlines</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{active.length} active</span>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={view === "list"}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "calendar" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={view === "calendar"}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </button>
          </div>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing else scheduled.
        </div>
      ) : view === "list" ? (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          {active.map((d) => {
            const date = new Date(d.deadline_at);
            const sev = severityOf(date);
            const s = SEVERITY_STYLES[sev];
            return (
              <li key={d.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${s.icon} shrink-0`}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.chip}`}>{s.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{subjectsById[d.subject_id]?.name}</span>
                  </div>
                  <div className="font-medium truncate">{d.title}</div>
                </div>
                <div className="text-right text-xs whitespace-nowrap">
                  <div className="font-medium">{format(date, "MMM d, h:mm a")}</div>
                  <div className="text-muted-foreground">in {formatDistanceToNowStrict(date)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <DeadlineCalendar deadlines={active} subjectsById={subjectsById} />
      )}
    </section>
  );
}

function DeadlineCalendar({
  deadlines,
  subjectsById,
}: {
  deadlines: DeadlineItem[];
  subjectsById: Record<string, Subject>;
}) {
  const initial = deadlines.length > 0 ? startOfMonth(new Date(deadlines[0].deadline_at)) : startOfMonth(new Date());
  const [cursor, setCursor] = useState<Date>(initial);
  const [selected, setSelected] = useState<Date | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const byDay = new Map<string, DeadlineItem[]>();
  for (const d of deadlines) {
    const key = format(new Date(d.deadline_at), "yyyy-MM-dd");
    const list = byDay.get(key) ?? [];
    list.push(d);
    byDay.set(key, list);
  }

  const topSeverity = (items: DeadlineItem[]): Severity => {
    let best: Severity = "upcoming";
    for (const it of items) {
      const s = severityOf(new Date(it.deadline_at));
      if (s === "urgent") return "urgent";
      if (s === "soon") best = "soon";
    }
    return best;
  };

  const dayTint: Record<Severity, string> = {
    urgent: "bg-rose-500/15 border-rose-500/40",
    soon: "bg-amber-400/15 border-amber-400/40",
    upcoming: "bg-sky-400/10 border-sky-400/30",
  };

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const selectedItems = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="font-semibold">{format(cursor, "MMMM yyyy")}</div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => { setCursor(addMonths(cursor, -1)); setSelected(null); }} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCursor(startOfMonth(new Date())); setSelected(null); }}>
            Today
          </Button>
          <Button size="icon" variant="ghost" onClick={() => { setCursor(addMonths(cursor, 1)); setSelected(null); }} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/60">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isSel = selected ? isSameDay(day, selected) : false;
          const sev = items.length > 0 ? topSeverity(items) : null;
          const tint = sev ? dayTint[sev] : "";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(day)}
              className={`relative min-h-[72px] sm:min-h-[88px] bg-card p-1.5 text-left transition-colors hover:bg-muted/40 ${
                !inMonth ? "opacity-40" : ""
              } ${isSel ? "ring-2 ring-primary ring-inset" : ""} ${sev ? `border ${tint}` : "border border-transparent"}`}
            >
              <div className={`flex items-center justify-between text-xs ${isToday(day) ? "font-bold text-primary" : "text-foreground/80"}`}>
                <span>{format(day, "d")}</span>
                {items.length > 0 && (
                  <span className={`grid h-4 min-w-4 px-1 place-items-center rounded-full text-[10px] font-semibold ${SEVERITY_STYLES[sev!].chip}`}>
                    {items.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 2).map((it) => {
                  const s = SEVERITY_STYLES[severityOf(new Date(it.deadline_at))];
                  return (
                    <div key={it.id} className={`truncate rounded px-1 py-0.5 text-[10px] ${s.chip}`}>
                      {it.title}
                    </div>
                  );
                })}
                {items.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="border-t border-border p-4">
          <div className="mb-2 text-sm font-semibold">{format(selected, "EEEE, MMM d")}</div>
          {selectedItems.length === 0 ? (
            <div className="text-xs text-muted-foreground">No deadlines on this day.</div>
          ) : (
            <ul className="space-y-2">
              {selectedItems
                .sort((a, b) => +new Date(a.deadline_at) - +new Date(b.deadline_at))
                .map((d) => {
                  const date = new Date(d.deadline_at);
                  const s = SEVERITY_STYLES[severityOf(date)];
                  return (
                    <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-2.5">
                      <div className={`grid h-8 w-8 place-items-center rounded-md ${s.icon}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.chip}`}>{s.label}</span>
                          <span className="text-xs text-muted-foreground truncate">{subjectsById[d.subject_id]?.name}</span>
                        </div>
                        <div className="text-sm font-medium truncate">{d.title}</div>
                      </div>
                      <div className="text-right text-xs whitespace-nowrap text-muted-foreground">
                        {format(date, "h:mm a")}
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
