import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

let _sb: SupabaseClient<Database> | null = null;
function sb() {
  if (!_sb) {
    _sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  return res.json().catch(() => ({}));
}

function esc(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/api/public/telegram/notify-materials")({
  server: {
    handlers: {
      POST: async () => {
        if (!process.env.LOVABLE_API_KEY || !process.env.TELEGRAM_API_KEY) {
          return Response.json({ ok: false, error: "Bot not configured" }, { status: 500 });
        }

        const { data: materials, error } = await sb()
          .from("materials")
          .select("id,title,material_type,subject_id,subjects(name,code)")
          .is("telegram_notified_at", null)
          .eq("is_archived", false)
          .order("created_at", { ascending: true })
          .limit(50);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        if (!materials || materials.length === 0) {
          return Response.json({ ok: true, notified: 0 });
        }

        // Pull all subscribed users once, then filter by their subject_ids array in memory.
        const { data: subs } = await sb()
          .from("telegram_subscribers")
          .select("chat_id, subject_ids")
          .eq("is_subscribed", true);

        let sends = 0;
        const notifiedIds: string[] = [];

        for (const m of materials as any[]) {
          const chatIds = (subs ?? [])
            .filter((s: any) => Array.isArray(s.subject_ids) && s.subject_ids.includes(m.subject_id))
            .map((s: any) => s.chat_id as number);

          const subjectLabel = m.subjects?.code
            ? `${m.subjects.code} — ${m.subjects.name ?? ""}`
            : (m.subjects?.name ?? "");

          const text =
            `📢 <b>New ${esc(m.material_type)}</b>\n` +
            `<b>${esc(m.title)}</b>\n` +
            `${esc(subjectLabel)}\n\n` +
            `Use /materials to list, or /get to download.`;

          for (const chatId of chatIds) {
            await tg("sendMessage", {
              chat_id: chatId,
              text,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            });
            sends++;
          }
          notifiedIds.push(m.id);
        }

        if (notifiedIds.length > 0) {
          await sb()
            .from("materials")
            .update({ telegram_notified_at: new Date().toISOString() })
            .in("id", notifiedIds);
        }

        return Response.json({
          ok: true,
          materials: notifiedIds.length,
          messages_sent: sends,
        });
      },
      GET: async () =>
        Response.json({ ok: true, service: "telegram-notify-materials" }),
    },
  },
});
