import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { StudyNotesManager } from "@/components/StudyNotesManager";

export const Route = createFileRoute("/admin/notes")({
  head: () => ({ meta: [{ title: "Study Notes — Admin" }] }),
  component: AdminNotesRoute,
});

function AdminNotesRoute() {
  return (
    <AdminShell
      title="Study Notes"
      description="Write web-based notes students can read online — with headings, examples and equations."
    >
      {(ctx) => <StudyNotesManager semesterId={ctx.semesterId} />}
    </AdminShell>
  );
}
