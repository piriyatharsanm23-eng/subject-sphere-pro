import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const TIME_ZONE = "Asia/Colombo";

function esc(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDeadline(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export const notifyDeadlineCreated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { deadlineId: string }) =>
    z.object({ deadlineId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load deadline (RLS ensures caller can read it — admin of that semester or super_admin)
    const { data: d, error } = await supabase
      .from("deadlines")
      .select("id,title,description,deadline_at,subject_id,semester_id,subjects(name,code)")
      .eq("id", data.deadlineId)
      .maybeSingle();
    if (error || !d) throw new Error("Deadline not found");

    // Verify caller is admin of the semester or super_admin
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("is_super_admin", { _user_id: userId }),
      supabase.rpc("is_admin_of", { _user_id: userId, _semester_id: d.semester_id }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    // Use service role for cross-subscriber fetch + sending
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: subs } = await supabaseAdmin
      .from("telegram_subscribers")
      .select("chat_id, subject_ids")
      .eq("is_subscribed", true);

    const chatIds: number[] = (subs ?? [])
      .filter((s: any) => Array.isArray(s.subject_ids) && s.subject_ids.includes(d.subject_id))
      .map((s: any) => Number(s.chat_id));

    if (chatIds.length === 0) return { ok: true, sent: 0 };

    if (!process.env.LOVABLE_API_KEY || !process.env.TELEGRAM_API_KEY) {
      throw new Error("Telegram gateway not configured");
    }

    const subjectLabel = (d as any).subjects?.code
      ? `${(d as any).subjects.code} — ${(d as any).subjects.name ?? ""}`
      : ((d as any).subjects?.name ?? "");

    const text =
      `⏰ <b>New deadline</b>\n` +
      `<b>${esc(d.title)}</b>\n` +
      `${esc(subjectLabel)}\n` +
      `📅 ${esc(formatDeadline(d.deadline_at as string))}` +
      (d.description ? `\n\n${esc(d.description)}` : "");

    let sent = 0;
    for (const chatId of chatIds) {
      const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": process.env.TELEGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) sent++;
    }

    return { ok: true, sent };
  });
