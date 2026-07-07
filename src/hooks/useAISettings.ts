import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AISettings = {
  enabled: boolean;
  chatgpt_enabled: boolean;
  gemini_enabled: boolean;
};

const DEFAULT: AISettings = {
  enabled: true,
  chatgpt_enabled: true,
  gemini_enabled: true,
};

export function useAISettings() {
  return useQuery({
    queryKey: ["ai-settings"],
    queryFn: async (): Promise<AISettings> => {
      const { data } = await (supabase as any)
        .from("ai_settings")
        .select("enabled,chatgpt_enabled,gemini_enabled")
        .eq("id", true)
        .maybeSingle();
      return (data as AISettings | null) ?? DEFAULT;
    },
    staleTime: 60_000,
  });
}
