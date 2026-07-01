import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UploaderInfo } from "@/components/UploaderBadge";

/**
 * Fetch uploader profile info (name + avatar only, no email) for a set of user ids.
 * Reads from the public `public_profile_info` mirror so it works for logged-out students.
 */
export function useUploaders(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter((v): v is string => !!v))).sort();
  const key = unique.join(",");

  return useQuery<Record<string, UploaderInfo>>({
    queryKey: ["uploaders", key],
    enabled: unique.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profile_info")
        .select("id,full_name,avatar_url")
        .in("id", unique);
      if (error) throw error;
      const map: Record<string, UploaderInfo> = {};
      for (const row of data ?? []) map[row.id] = row;
      return map;
    },
  });
}
