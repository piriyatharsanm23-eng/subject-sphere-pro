import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

let _sb: SupabaseClient<Database> | null = null;
function sb() {
  if (!_sb) {
    _sb = createClient<Database>(
      (process.env.EXTERNAL_SUPABASE_URL || process.env.SUPABASE_URL)!,
      (process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _sb;
}

async function tg(method: string, payload: unknown) {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": process.env.TELEGRAM_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

function esc(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function run() {
  if (!process.env.LOVABLE_API_KEY || !process.env.TELEGRAM_API_KEY) {
    return { ok: false, error: "Bot not configured" };
  }

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: materials }, { data: kuppi }, { data: subs }] = await Promise.all([
    sb()
      .from("materials")
      .select("id,title,material_type,subject_id,subjects(name,code)")
      .gte("created_at", since)
      .eq("is_archived", false)
      .eq("pending_delete", false),
    sb()
      .from("kuppi_videos")
      .select("id,title,subject_id")
      .gte("created_at", since)
      .eq("pending_delete", false),
    sb().from("telegram_subscribers").select("chat_id, subject_ids").eq("is_subscribed", true),
  ]);

  let sent = 0;
  for (const s of (subs ?? []) as any[]) {
    const ids: string[] = Array.isArray(s.subject_ids) ? s.subject_ids : [];
    const mats = (materials ?? []).filter((m: any) => ids.includes(m.subject_id));
    const vids = (kuppi ?? []).filter((k: any) => ids.includes(k.subject_id));
    if (mats.length === 0 && vids.length === 0) continue;

    const parts: string[] = ["📚 <b>This week on StudyHub</b>", ""];

    if (mats.length > 0) {
      parts.push(`<b>${mats.length} new material${mats.length === 1 ? "" : "s"}</b>`);
      for (const m of mats.slice(0, 15) as any[]) {
        const label = m.subjects?.code ?? m.subjects?.name ?? "";
        parts.push(`• ${esc(m.title)}${label ? ` — ${esc(label)}` : ""}`);
      }
      if (mats.length > 15) parts.push(`…and ${mats.length - 15} more`);
      parts.push("");
    }

    if (vids.length > 0) {
      parts.push(`<b>${vids.length} new kuppi video${vids.length === 1 ? "" : "s"}</b>`);
      for (const k of vids.slice(0, 10) as any[]) parts.push(`• ${esc(k.title)}`);
      parts.push("");
    }

    parts.push("Use /materials to browse or /download to get files.");

    const ok = await tg("sendMessage", {
      chat_id: s.chat_id,
      text: parts.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (ok) sent++;
  }

  return { ok: true, materials: materials?.length ?? 0, kuppi: kuppi?.length ?? 0, sent };
}

export const Route = createFileRoute("/api/public/telegram/weekly-summary")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(await run());
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, service: "telegram-weekly-summary" }),
    },
  },
});
