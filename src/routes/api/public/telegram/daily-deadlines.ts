import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const TIME_ZONE = "Asia/Colombo";

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

function fmt(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function daysLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(ms / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

async function run() {
  if (!process.env.LOVABLE_API_KEY || !process.env.TELEGRAM_API_KEY) {
    return { ok: false, error: "Bot not configured" };
  }

  const now = new Date();
  const until = new Date(now.getTime() + 7 * 86_400_000);

  const { data: deadlines, error } = await sb()
    .from("deadlines")
    .select("id,title,deadline_at,subject_id,subjects(name,code)")
    .gte("deadline_at", now.toISOString())
    .lte("deadline_at", until.toISOString())
    .order("deadline_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  if (!deadlines || deadlines.length === 0) return { ok: true, sent: 0, deadlines: 0 };

  const { data: subs } = await sb()
    .from("telegram_subscribers")
    .select("chat_id, subject_ids")
    .eq("is_subscribed", true);

  let sent = 0;
  for (const s of (subs ?? []) as any[]) {
    const ids: string[] = Array.isArray(s.subject_ids) ? s.subject_ids : [];
    const mine = (deadlines as any[]).filter((d) => ids.includes(d.subject_id));
    if (mine.length === 0) continue;

    const lines = mine.map((d) => {
      const label = d.subjects?.code ?? d.subjects?.name ?? "";
      return `• <b>${esc(d.title)}</b>${label ? ` — ${esc(label)}` : ""}\n   📅 ${esc(fmt(d.deadline_at))} (${daysLeft(d.deadline_at)})`;
    });

    const ok = await tg("sendMessage", {
      chat_id: s.chat_id,
      text: `🗓 <b>Your deadlines this week</b>\n\n${lines.join("\n")}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (ok) sent++;
  }

  return { ok: true, deadlines: deadlines.length, sent };
}

export const Route = createFileRoute("/api/public/telegram/daily-deadlines")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(await run());
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, service: "telegram-daily-deadlines" }),
    },
  },
});
