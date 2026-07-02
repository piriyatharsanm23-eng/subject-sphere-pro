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

async function tg(method: string, payload: unknown = {}) {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": process.env.TELEGRAM_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function alertAdmins(text: string) {
  const { data } = await sb()
    .from("telegram_subscribers")
    .select("chat_id")
    .eq("receive_admin_alerts", true)
    .eq("is_subscribed", true);
  for (const row of data ?? []) {
    await tg("sendMessage", {
      chat_id: row.chat_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}

async function runHealthCheck(alertOnFailure: boolean) {
  const missingKeys = !process.env.LOVABLE_API_KEY || !process.env.TELEGRAM_API_KEY;
  if (missingKeys) {
    return {
      status: "misconfigured",
      error: "Missing LOVABLE_API_KEY or TELEGRAM_API_KEY",
    };
  }

  const info = await tg("getWebhookInfo");
  const result = info.data?.result ?? {};
  const pending: number = result.pending_update_count ?? 0;
  const lastErrorMessage: string | null = result.last_error_message ?? null;
  const lastErrorDate: number | null = result.last_error_date ?? null;
  const webhookUrl: string | null = result.url ?? null;

  const errorFresh =
    lastErrorDate && Date.now() / 1000 - lastErrorDate < 60 * 60; // within last hour
  const unhealthy = !info.ok || !webhookUrl || pending > 50 || errorFresh;
  const status = !info.ok
    ? "gateway_error"
    : !webhookUrl
      ? "no_webhook"
      : unhealthy
        ? "degraded"
        : "healthy";

  await sb()
    .from("telegram_health_logs")
    .insert({
      status,
      pending_update_count: pending,
      last_error_message: lastErrorMessage,
      last_error_at: lastErrorDate ? new Date(lastErrorDate * 1000).toISOString() : null,
      webhook_url: webhookUrl,
      raw: info.data ?? {},
    });

  if (alertOnFailure && unhealthy) {
    const lines = [
      "🚨 <b>StudyHub Telegram bot health alert</b>",
      `Status: <b>${status}</b>`,
      `Pending updates: ${pending}`,
      lastErrorMessage ? `Last error: ${lastErrorMessage}` : null,
      lastErrorDate
        ? `Last error at: ${new Date(lastErrorDate * 1000).toUTCString()}`
        : null,
      webhookUrl ? `Webhook: ${webhookUrl}` : "Webhook: (not set)",
    ].filter(Boolean);
    await alertAdmins(lines.join("\n"));
  }

  return {
    status,
    pending_update_count: pending,
    last_error_message: lastErrorMessage,
    last_error_at: lastErrorDate ? new Date(lastErrorDate * 1000).toISOString() : null,
    webhook_url: webhookUrl,
  };
}

export const Route = createFileRoute("/api/public/telegram/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await runHealthCheck(false);
          const httpStatus = result.status === "healthy" ? 200 : 503;
          return Response.json(
            { ok: result.status === "healthy", ...result },
            { status: httpStatus },
          );
        } catch (e: any) {
          return Response.json(
            { ok: false, status: "error", error: e?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
      // Cron endpoint: runs the check AND sends alerts to admin chats if unhealthy.
      POST: async () => {
        try {
          const result = await runHealthCheck(true);
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
