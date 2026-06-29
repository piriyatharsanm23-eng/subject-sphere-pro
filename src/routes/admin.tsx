import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — StudyHub" }] }),
  component: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Admin dashboard coming next</h1>
        <p className="mt-2 text-muted-foreground max-w-md">Phase 2 will add the full admin workspace (uploads, deadlines, requests, feedback).</p>
        <Button asChild className="mt-6"><Link to="/">Back to home</Link></Button>
      </div>
    </div>
  ),
});
