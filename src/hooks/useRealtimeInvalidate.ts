import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TableSub = {
  table: string;
  /** Query keys to invalidate when a change is observed. */
  keys: (readonly unknown[])[];
  /** Optional PostgREST filter, e.g. `subject_id=in.(a,b)`. */
  filter?: string;
  /** Postgres change event; defaults to `*`. */
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
};

/**
 * Subscribes to Supabase realtime changes on the given tables and
 * invalidates the specified React Query keys when they change.
 * A single channel is opened per hook instance.
 */
export function useRealtimeInvalidate(channelName: string, subs: TableSub[]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (subs.length === 0) return;
    let cancelled = false;
    const channel = supabase.channel(channelName);

    for (const s of subs) {
      channel.on(
        // @ts-expect-error - supabase-js types are narrow but this is the documented shape
        "postgres_changes",
        {
          event: s.event ?? "*",
          schema: "public",
          table: s.table,
          ...(s.filter ? { filter: s.filter } : {}),
        },
        () => {
          if (cancelled) return;
          for (const key of s.keys) qc.invalidateQueries({ queryKey: key });
        },
      );
    }

    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(subs), qc]);
}
