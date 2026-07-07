import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarClock, FileText, Layers, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { materialTypeLabel } from "@/lib/materials";

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const searchQ = useQuery({
    queryKey: ["global-search", q],
    enabled: open,
    queryFn: async () => {
      const like = q.trim() ? `%${q.trim()}%` : "%";
      const [sem, sub, mat, dead] = await Promise.all([
        supabase.from("semesters").select("id,name").ilike("name", like).limit(6),
        supabase.from("subjects").select("id,name,code").or(`name.ilike.${like},code.ilike.${like}`).limit(8),
        supabase
          .from("materials")
          .select("id,title,material_type,year,subject_id,semester_id")
          .eq("is_archived", false)
          .or(`title.ilike.${like},year.ilike.${like}`)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("deadlines")
          .select("id,title,subject_id,semester_id,deadline_at")
          .eq("is_archived", false)
          .eq("status", "active")
          .ilike("title", like)
          .gte("deadline_at", new Date().toISOString())
          .limit(6),
      ]);
      return {
        semesters: sem.data ?? [],
        subjects: sub.data ?? [],
        materials: mat.data ?? [],
        deadlines: dead.data ?? [],
      };
    },
  });

  const go = (path: string) => {
    onOpenChange(false);
    setQ("");
    navigate({ to: path });
  };

  const r = searchQ.data;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search semesters, subjects, materials, deadlines…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{searchQ.isLoading ? "Searching…" : "No results."}</CommandEmpty>

        {r?.semesters.length ? (
          <CommandGroup heading="Semesters">
            {r.semesters.map((s) => (
              <CommandItem key={s.id} value={`sem-${s.id}-${s.name}`} onSelect={() => go(`/semester/${s.id}`)}>
                <BookOpen className="mr-2 h-4 w-4 text-sky-500" />
                <span>{s.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {r?.subjects.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Subjects">
              {r.subjects.map((s) => (
                <CommandItem key={s.id} value={`sub-${s.id}-${s.name}`} onSelect={() => go(`/subject/${s.id}`)}>
                  <Layers className="mr-2 h-4 w-4 text-emerald-500" />
                  <span>{s.name}</span>
                  {s.code && <span className="ml-2 text-xs text-muted-foreground">{s.code}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {r?.materials.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Materials">
              {r.materials.map((m) => (
                <CommandItem key={m.id} value={`mat-${m.id}-${m.title}`} onSelect={() => go(`/material/${m.id}`)}>
                  <FileText className="mr-2 h-4 w-4 text-violet-500" />
                  <span className="truncate">{m.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{materialTypeLabel(m.material_type)}{m.year ? ` · ${m.year}` : ""}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {r?.deadlines.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Deadlines">
              {r.deadlines.map((d) => (
                <CommandItem key={d.id} value={`dl-${d.id}-${d.title}`} onSelect={() => go(`/subject/${d.subject_id}`)}>
                  <CalendarClock className="mr-2 h-4 w-4 text-rose-500" />
                  <span className="truncate">{d.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

export function SearchTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors ${className ?? ""}`}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search…</span>
      <kbd className="hidden md:inline ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
    </button>
  );
}
