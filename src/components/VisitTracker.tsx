import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const KEY = "sh_visitor_id";

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2)) as string;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/** Records one lightweight page-view row per route change (no personal data). */
export function VisitTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (path.startsWith("/api")) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (cancelled) return;
        await (supabase as any).from("site_visits").insert({
          visitor_id: getVisitorId(),
          user_id: sess.session?.user.id ?? null,
          path,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent.slice(0, 300),
        });
      } catch {
        /* analytics must never break the app */
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [path]);

  return null;
}
