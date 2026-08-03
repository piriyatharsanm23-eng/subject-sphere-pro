import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calculator, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader, SectionHeading } from "@/components/ui/page";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/gpa")({
  head: () => ({
    meta: [
      { title: "GPA Calculator — UoM Engineering | StudyHub" },
      {
        name: "description",
        content:
          "Free semester GPA and overall CGPA calculator for University of Moratuwa Faculty of Engineering students. No account needed.",
      },
      { property: "og:title", content: "GPA Calculator — UoM Engineering | StudyHub" },
      {
        property: "og:description",
        content:
          "Calculate your semester GPA and cumulative GPA using the University of Moratuwa engineering grade point scale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GpaPage,
});

/** University of Moratuwa — Faculty of Engineering grade point scale. */
const GRADES: { label: string; points: number }[] = [
  { label: "A+", points: 4.0 },
  { label: "A", points: 4.0 },
  { label: "A-", points: 3.7 },
  { label: "B+", points: 3.3 },
  { label: "B", points: 3.0 },
  { label: "B-", points: 2.7 },
  { label: "C+", points: 2.3 },
  { label: "C", points: 2.0 },
  { label: "C-", points: 1.7 },
  { label: "D+", points: 1.3 },
  { label: "D", points: 1.0 },
  { label: "E", points: 0.0 },
];

const GRADE_POINTS: Record<string, number> = Object.fromEntries(GRADES.map((g) => [g.label, g.points]));

type Course = { id: string; name: string; credits: string; grade: string };
type Semester = { id: string; name: string; courses: Course[] };

const STORAGE_KEY = "studyhub.gpa.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

const newCourse = (): Course => ({ id: uid(), name: "", credits: "3", grade: "A" });
const newSemester = (n: number): Semester => ({
  id: uid(),
  name: `Semester ${n}`,
  courses: [newCourse(), newCourse(), newCourse()],
});

function gpaOf(courses: Course[]) {
  let credits = 0;
  let points = 0;
  for (const c of courses) {
    const cr = parseFloat(c.credits);
    const gp = GRADE_POINTS[c.grade];
    if (!Number.isFinite(cr) || cr <= 0 || gp === undefined) continue;
    credits += cr;
    points += cr * gp;
  }
  return { credits, points, gpa: credits > 0 ? points / credits : 0 };
}

function classOf(gpa: number, credits: number) {
  if (credits === 0) return "—";
  if (gpa >= 3.7) return "First Class";
  if (gpa >= 3.3) return "Second Class (Upper)";
  if (gpa >= 3.0) return "Second Class (Lower)";
  if (gpa >= 2.0) return "Pass";
  return "Below pass level";
}

function GpaPage() {
  const [semesters, setSemesters] = useState<Semester[]>([newSemester(1)]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Semester[];
        if (Array.isArray(parsed) && parsed.length) setSemesters(parsed);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(semesters));
    } catch {
      /* ignore */
    }
  }, [semesters, loaded]);

  const perSemester = useMemo(() => semesters.map((s) => ({ ...s, ...gpaOf(s.courses) })), [semesters]);
  const overall = useMemo(() => {
    const credits = perSemester.reduce((a, s) => a + s.credits, 0);
    const points = perSemester.reduce((a, s) => a + s.points, 0);
    return { credits, gpa: credits > 0 ? points / credits : 0 };
  }, [perSemester]);

  const update = (semId: string, fn: (s: Semester) => Semester) =>
    setSemesters((prev) => prev.map((s) => (s.id === semId ? fn(s) : s)));

  return (
    <div className="min-h-dvh flex flex-col bg-muted/40">
      <SiteHeader />
      <PageContainer>
        <PageHeader
          breadcrumbs={[{ label: "Home", to: "/" }, { label: "GPA calculator" }]}
          eyebrow="Tools"
          title="GPA Calculator"
          description="Work out your semester GPA and overall CGPA using the University of Moratuwa, Faculty of Engineering grade point scale. Everything stays on your device — no account needed."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSemesters([newSemester(1)])}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reset all
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Summary label="Overall CGPA" value={overall.gpa.toFixed(2)} tone="text-primary" />
            <Summary label="Total credits" value={String(overall.credits)} tone="text-emerald-500" />
            <Summary label="Semesters" value={String(semesters.length)} tone="text-sky-500" />
            <Summary label="Class" value={classOf(overall.gpa, overall.credits)} tone="text-amber-500" small />
          </div>
        </PageHeader>

        <SectionHeading title="Your semesters" description="Add each module with its credit value and grade." />

        <div className="space-y-5">
          {perSemester.map((sem, si) => (
            <section key={sem.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={sem.name}
                  onChange={(e) => update(sem.id, (s) => ({ ...s, name: e.target.value }))}
                  aria-label="Semester name"
                  className="h-9 w-48 font-semibold"
                />
                <div className="ml-auto flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Credits <strong className="text-foreground tabular-nums">{sem.credits}</strong>
                  </span>
                  <span className="rounded-lg bg-primary/10 px-3 py-1 font-semibold text-primary tabular-nums">
                    GPA {sem.gpa.toFixed(2)}
                  </span>
                  {semesters.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${sem.name}`}
                      onClick={() => setSemesters((prev) => prev.filter((s) => s.id !== sem.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="hidden sm:grid grid-cols-[1fr_7rem_8rem_2.5rem] gap-2 px-1 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  <span>Module</span>
                  <span>Credits</span>
                  <span>Grade</span>
                  <span className="sr-only">Remove</span>
                </div>
                {sem.courses.map((c, ci) => (
                  <div key={c.id} className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_8rem_2.5rem] gap-2">
                    <Input
                      className="col-span-2 sm:col-span-1"
                      placeholder={`Module ${ci + 1}`}
                      value={c.name}
                      aria-label="Module name"
                      onChange={(e) =>
                        update(sem.id, (s) => ({
                          ...s,
                          courses: s.courses.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)),
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={c.credits}
                      aria-label="Credits"
                      onChange={(e) =>
                        update(sem.id, (s) => ({
                          ...s,
                          courses: s.courses.map((x) => (x.id === c.id ? { ...x, credits: e.target.value } : x)),
                        }))
                      }
                    />
                    <Select
                      value={c.grade}
                      onValueChange={(v) =>
                        update(sem.id, (s) => ({
                          ...s,
                          courses: s.courses.map((x) => (x.id === c.id ? { ...x, grade: v } : x)),
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Grade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map((g) => (
                          <SelectItem key={g.label} value={g.label}>
                            {g.label} · {g.points.toFixed(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove module"
                      disabled={sem.courses.length === 1}
                      onClick={() =>
                        update(sem.id, (s) => ({ ...s, courses: s.courses.filter((x) => x.id !== c.id) }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => update(sem.id, (s) => ({ ...s, courses: [...s.courses, newCourse()] }))}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add module
              </Button>
              <span className="ml-3 text-xs text-muted-foreground">
                {classOf(sem.gpa, sem.credits) !== "—" ? `Semester ${si + 1}: ${classOf(sem.gpa, sem.credits)}` : ""}
              </span>
            </section>
          ))}
        </div>

        <Button
          className="mt-5"
          onClick={() => setSemesters((prev) => [...prev, newSemester(prev.length + 1)])}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add semester
        </Button>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Calculator className="h-4 w-4 text-primary" aria-hidden="true" /> Grade point scale (UoM Engineering)
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {GRADES.map((g) => (
              <div key={g.label} className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                <div className="text-sm font-semibold">{g.label}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{g.points.toFixed(1)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            GPA = Σ (credits × grade point) ÷ Σ credits. Always confirm final results with your faculty transcript.
          </p>
        </section>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}

function Summary({ label, value, tone, small }: { label: string; value: string; tone: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-1 font-bold tabular-nums ${small ? "text-base" : "text-2xl"} ${tone}`}>{value}</div>
    </div>
  );
}
