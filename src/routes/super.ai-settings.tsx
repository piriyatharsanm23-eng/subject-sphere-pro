import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Save, Sparkles } from "lucide-react";
import { SuperShell } from "@/components/SuperShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/super/ai-settings")({
  head: () => ({ meta: [{ title: "AI Study Helper — Super Admin" }] }),
  component: AISettingsPage,
});

function AISettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ai-settings", "super"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_settings")
        .select("enabled,chatgpt_enabled,gemini_enabled,updated_at")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return (
        data ?? { enabled: true, chatgpt_enabled: true, gemini_enabled: true }
      );
    },
  });

  const [enabled, setEnabled] = useState(true);
  const [chatgpt, setChatgpt] = useState(true);
  const [gemini, setGemini] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setChatgpt(q.data.chatgpt_enabled);
      setGemini(q.data.gemini_enabled);
    }
  }, [q.data]);

  async function save() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("ai_settings")
        .update({
          enabled,
          chatgpt_enabled: chatgpt,
          gemini_enabled: gemini,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq("id", true);
      if (error) throw error;
      toast.success("AI settings saved");
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SuperShell
      title="AI Study Helper"
      description="Control the ChatGPT and Gemini explanation buttons across the site."
    >
      <div className="max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-soft space-y-5">
        <Row
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          title="Enable AI Study Helper"
          desc="If off, all Explain with ChatGPT / Gemini buttons are hidden from students."
          checked={enabled}
          onChange={setEnabled}
        />
        <div className="border-t border-border pt-5 space-y-4 opacity-100">
          <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
            <Row
              icon={<Bot className="h-5 w-5 text-emerald-400" />}
              title="ChatGPT provider"
              desc="Explain materials using OpenAI models via Lovable AI Gateway."
              checked={chatgpt}
              onChange={setChatgpt}
            />
          </div>
          <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
            <Row
              icon={<Sparkles className="h-5 w-5 text-sky-400" />}
              title="Gemini provider"
              desc="Explain materials using Google Gemini models via Lovable AI Gateway."
              checked={gemini}
              onChange={setGemini}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </SuperShell>
  );
}

function Row({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
