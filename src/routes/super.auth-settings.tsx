import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SuperShell } from "@/components/SuperShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/super/auth-settings")({
  head: () => ({ meta: [{ title: "Auth settings — StudyHub" }] }),
  component: AuthSettingsPage,
});

function AuthSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_auth_enabled")
        .maybeSingle();
      if (data) setGoogleEnabled(data.value === true || (data.value as unknown) === "true");
      setLoading(false);
    })();
  }, []);

  const save = async (next: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "google_auth_enabled", value: next as unknown as never, updated_at: new Date().toISOString() });
      if (error) throw error;
      setGoogleEnabled(next);
      toast.success(next ? "Google sign-in enabled" : "Google sign-in hidden");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update setting";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuperShell title="Auth settings" description="Control which sign-in methods appear on the sign-in page.">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft max-w-2xl">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Continue with Google</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                When turned off, the “Continue with Google” button is hidden on the sign-in page.
                Users can still sign in with email &amp; password.
              </p>
            </div>
            <Switch checked={googleEnabled} disabled={saving} onCheckedChange={save} />
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <Button variant="outline" disabled={saving} onClick={() => save(!googleEnabled)}>
            {googleEnabled ? "Disable Google sign-in" : "Enable Google sign-in"}
          </Button>
        </div>
      </div>
    </SuperShell>
  );
}
