import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/super")({
  head: () => ({ meta: [{ title: "Super Admin — StudyHub" }] }),
  component: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Super Admin dashboard coming next</h1>
        <p className="mt-2 text-muted-foreground max-w-md">Phase 3 will add analytics, admin management, and global controls.</p>
        <Button asChild className="mt-6"><Link to="/">Back to home</Link></Button>
      </div>
    </div>
  ),
});
