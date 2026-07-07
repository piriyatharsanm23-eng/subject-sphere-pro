import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { supabase } from "@/integrations/supabase/client";
import { ProfileForm } from "./admin.profile";

export const Route = createFileRoute("/super/profile")({
  head: () => ({ meta: [{ title: "Your profile — Super Admin" }] }),
  component: SuperProfilePage,
});

function SuperProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  return (
    <SuperShell title="Your profile" description="Your name and photo appear next to every material and deadline you publish.">
      {userId ? (
        <ProfileForm userId={userId} />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </SuperShell>
  );
}
