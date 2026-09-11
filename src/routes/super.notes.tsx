import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { StudyNotesManager } from "@/components/StudyNotesManager";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super/notes")({
  head: () => ({ meta: [{ title: "Study Notes — Super Admin" }] }),
  component: SuperNotesPage,
});

function SuperNotesPage() {
  const [semesterId, setSemesterId] = useState<string>("");

  const semestersQ = useQuery({
    queryKey: ["super-all-semesters"],
    queryFn: async () => (await supabase.from("semesters").select("id,name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!semesterId && (semestersQ.data ?? []).length) setSemesterId(semestersQ.data![0].id);
  }, [semestersQ.data, semesterId]);

  return (
    <SuperShell title="Study Notes" description="Create, edit, publish and order web-based study notes for any semester.">
      {!semesterId ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <StudyNotesManager
          semesterId={semesterId}
          semesters={semestersQ.data ?? []}
          onSemesterChange={setSemesterId}
        />
      )}
    </SuperShell>
  );
}
