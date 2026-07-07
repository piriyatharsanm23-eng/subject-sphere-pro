import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";
import type { Database } from "@/integrations/supabase/types";

// ---------- Telegram gateway ----------
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

async function tg(method: string, payload: unknown) {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const telegramApiKey = process.env.TELEGRAM_API_KEY;
  if (!lovableApiKey || !telegramApiKey) {
    throw new Error("Telegram gateway is not configured");
  }

  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": telegramApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) console.error("telegram error", method, res.status, data);
  return data;
}

async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

// ---------- Auth ----------
function deriveWebhookSecret(apiKey: string) {
  return createHash("sha256").update(`telegram-webhook:${apiKey}`).digest("base64url");
}
function safeEqual(a: string, b: string) {
  const l = Buffer.from(a);
  const r = Buffer.from(b);
  return l.length === r.length && timingSafeEqual(l, r);
}

// ---------- Supabase (service role, webhook only) ----------
let _sb: SupabaseClient<Database> | null = null;
function sb(): SupabaseClient<Database> {
  if (!_sb) {
    _sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _sb;
}

// ---------- Command handling ----------
const HELP = [
  "<b>📚 StudyHub bot</b>",
  "",
  "<b>Commands</b>",
  "/start – subscribe",
  "/stop – unsubscribe (no more messages)",
  "/semesters – list semesters",
  "/semester &lt;n&gt; – pick a semester by number",
  "/subjects – list subjects in your chosen semester",
"/enroll &lt;n&gt; – toggle enrollment for subject #n",
  "/enrollall – enroll every subject in the semester",
  "/mysubjects – show your enrolled subjects",
  "/materials – list available materials for your subjects",
  "/get &lt;n&gt; – download material #n from the last list",
  "/getall – download every available material (up to 20)",
  "/deadlines – upcoming deadlines",
  "/adminalerts on|off – receive bot health alerts (admins)",
  "/help – show this menu",
].join("\n");


async function ensureSubscriber(msg: any) {
  const chat = msg.chat;
  const from = msg.from ?? {};
  await sb()
    .from("telegram_subscribers")
    .upsert(
      {
        chat_id: chat.id,
        username: from.username ?? null,
        first_name: from.first_name ?? chat.first_name ?? null,
        is_subscribed: true,
      },
      { onConflict: "chat_id" },
    );
}

async function getSubscriber(chatId: number) {
  const { data } = await sb()
    .from("telegram_subscribers")
    .select("chat_id,is_subscribed,selected_semester_id,subject_ids")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data;
}

async function listSemesters() {
  const { data } = await sb()
    .from("semesters")
    .select("id,name,is_active")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

async function listSubjects(semesterId: string) {
  const { data } = await sb()
    .from("subjects")
    .select("id,name,code")
    .eq("semester_id", semesterId)
    .order("name");
  return data ?? [];
}

async function cmdStart(chatId: number, msg: any) {
  await ensureSubscriber(msg);
  await sendMessage(
    chatId,
    `👋 Welcome to <b>StudyHub</b>!\n\nYou're subscribed. Use /semesters to pick your semester, then /subjects to enroll.\n\n${HELP}`,
  );
}

async function cmdStop(chatId: number) {
  await sb().from("telegram_subscribers").update({ is_subscribed: false }).eq("chat_id", chatId);
  await sendMessage(chatId, "🔕 Unsubscribed. You won't receive messages. Send /start to resubscribe.");
}

async function cmdSemesters(chatId: number) {
  const sems = await listSemesters();
  if (sems.length === 0) return sendMessage(chatId, "No active semesters yet.");
  const lines = sems.map((s, i) => `<b>${i + 1}.</b> ${escape(s.name)}`);
  await sendMessage(
    chatId,
    `📅 <b>Active semesters</b>\n\n${lines.join("\n")}\n\nReply with <code>/semester &lt;number&gt;</code> to choose.`,
  );
}

async function cmdSemesterPick(chatId: number, arg: string) {
  const n = Number(arg);
  const sems = await listSemesters();
  if (!Number.isInteger(n) || n < 1 || n > sems.length) {
    return sendMessage(chatId, "Usage: /semester <number> — see /semesters for the list.");
  }
  const chosen = sems[n - 1];
  await sb()
    .from("telegram_subscribers")
    .update({ selected_semester_id: chosen.id, subject_ids: [] })
    .eq("chat_id", chatId);
  await sendMessage(
    chatId,
    `✅ Semester set to <b>${escape(chosen.name)}</b>.\n\nNow send /subjects to see subjects, then <code>/enroll &lt;n&gt;</code> to enroll.`,
  );
}

async function cmdSubjects(chatId: number) {
  const sub = await getSubscriber(chatId);
  if (!sub?.selected_semester_id) return sendMessage(chatId, "Pick a semester first with /semesters.");
  const subjects = await listSubjects(sub.selected_semester_id);
  if (subjects.length === 0) return sendMessage(chatId, "No subjects in your semester yet.");
  const enrolled = await getEnrolledIds(chatId);
  const lines = subjects.map(
    (s, i) => `${enrolled.has(s.id) ? "✅" : "▫️"} <b>${i + 1}.</b> ${escape(s.code)} — ${escape(s.name)}`,
  );
  await sendMessage(
    chatId,
    `📖 <b>Subjects</b>\n\n${lines.join("\n")}\n\nToggle with <code>/enroll &lt;n&gt;</code>, or /enrollall.`,
  );
}

async function getEnrolledIds(chatId: number) {
  const { data } = await sb()
    .from("telegram_subscribers")
    .select("subject_ids")
    .eq("chat_id", chatId)
    .maybeSingle();
  const arr = (data as any)?.subject_ids as string[] | null;
  return new Set(arr ?? []);
}

async function cmdEnroll(chatId: number, arg: string) {
  const sub = await getSubscriber(chatId);
  if (!sub?.selected_semester_id) return sendMessage(chatId, "Pick a semester first with /semesters.");
  const n = Number(arg);
  const subjects = await listSubjects(sub.selected_semester_id);
  if (!Number.isInteger(n) || n < 1 || n > subjects.length) {
    return sendMessage(chatId, "Usage: /enroll <number> — see /subjects for the list.");
  }
  const s = subjects[n - 1];
  const current = new Set(((sub as any).subject_ids as string[] | null) ?? []);
  let removed = false;
  if (current.has(s.id)) { current.delete(s.id); removed = true; } else current.add(s.id);
  await sb()
    .from("telegram_subscribers")
    .update({ subject_ids: Array.from(current) } as any)
    .eq("chat_id", chatId);
  await sendMessage(
    chatId,
    removed ? `➖ Unenrolled from <b>${escape(s.name)}</b>.` : `➕ Enrolled in <b>${escape(s.name)}</b>. Use /mysubjects to review.`,
  );
}

async function cmdEnrollAll(chatId: number) {
  const sub = await getSubscriber(chatId);
  if (!sub?.selected_semester_id) return sendMessage(chatId, "Pick a semester first with /semesters.");
  const subjects = await listSubjects(sub.selected_semester_id);
  if (subjects.length === 0) return sendMessage(chatId, "No subjects to enroll in.");
  await sb()
    .from("telegram_subscribers")
    .update({ subject_ids: subjects.map((s) => s.id) } as any)
    .eq("chat_id", chatId);
  await sendMessage(chatId, `✅ Enrolled in all <b>${subjects.length}</b> subjects.`);
}

async function cmdMySubjects(chatId: number) {
  const sub = await getSubscriber(chatId);
  if (!sub?.selected_semester_id) return sendMessage(chatId, "Pick a semester first with /semesters.");
  const enrolled = await getEnrolledIds(chatId);
  if (enrolled.size === 0) return sendMessage(chatId, "You aren't enrolled in any subjects. Use /subjects.");
  const subjects = (await listSubjects(sub.selected_semester_id)).filter((s) => enrolled.has(s.id));
  const lines = subjects.map((s) => `✅ ${escape(s.code)} — ${escape(s.name)}`);
  await sendMessage(chatId, `🎓 <b>Your subjects</b>\n\n${lines.join("\n")}`);
}

async function fetchMaterialsForChat(chatId: number, limit = 20) {
  const enrolled = await getEnrolledIds(chatId);
  if (enrolled.size === 0) return [];
  const { data } = await sb()
    .from("materials")
    .select("id,title,material_type,file_url,file_name,subject_id,subjects(name,code)")
    .in("subject_id", Array.from(enrolled))
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function cmdMaterials(chatId: number) {
  const enrolled = await getEnrolledIds(chatId);
  if (enrolled.size === 0) return sendMessage(chatId, "Enroll in subjects first — /subjects.");
  const data = await fetchMaterialsForChat(chatId, 20);
  if (data.length === 0) return sendMessage(chatId, "No materials yet for your subjects.");
  const lines = data.map(
    (m: any, i: number) =>
      `<b>${i + 1}.</b> ${escape(m.title)} <i>(${m.material_type})</i> — ${escape(m.subjects?.code ?? m.subjects?.name ?? "")}`,
  );
  await sendMessage(
    chatId,
    `📎 <b>Available materials</b>\n\n${lines.join("\n")}\n\nDownload one with <code>/get &lt;n&gt;</code> or all with /getall.`,
  );
}

async function signedUrlFor(path: string) {
  const { data, error } = await sb().storage
    .from("learning-materials")
    .createSignedUrl(path, 60 * 30);
  if (error || !data) throw error ?? new Error("signed url failed");
  return data.signedUrl;
}

async function sendMaterial(chatId: number, m: any) {
  try {
    const url = await signedUrlFor(m.file_url);
    const caption = `📄 <b>${escape(m.title)}</b>\n${escape(m.subjects?.name ?? "")}`;
    const res = await tg("sendDocument", {
      chat_id: chatId,
      document: url,
      caption,
      parse_mode: "HTML",
    });
    if (res?.ok) {
      return true;
    }
    // Fallback: send the link if Telegram couldn't fetch the file directly.
    await sendMessage(chatId, `⬇️ <b>${escape(m.title)}</b>\n<a href="${url}">Download link</a> (valid 30 min)`);
    return false;
  } catch (e) {
    console.error("sendMaterial failed", e);
    await sendMessage(chatId, `❌ Could not send <b>${escape(m.title)}</b>.`);
    return false;
  }
}

async function cmdGet(chatId: number, arg: string) {
  const data = await fetchMaterialsForChat(chatId, 20);
  if (data.length === 0) return sendMessage(chatId, "No materials available. Try /materials.");
  const n = Number(arg);
  if (!Number.isInteger(n) || n < 1 || n > data.length) {
    return sendMessage(chatId, `Usage: /get <number> (1–${data.length}). See /materials.`);
  }
  await sendMaterial(chatId, data[n - 1]);
}

async function cmdGetAll(chatId: number) {
  const data = await fetchMaterialsForChat(chatId, 20);
  if (data.length === 0) return sendMessage(chatId, "No materials available. Try /materials.");
  await sendMessage(chatId, `📦 Sending <b>${data.length}</b> materials…`);
  for (const m of data) {
    await sendMaterial(chatId, m);
  }
  await sendMessage(chatId, "✅ Done.");
}

async function cmdDeadlines(chatId: number) {
  const enrolled = await getEnrolledIds(chatId);
  if (enrolled.size === 0) return sendMessage(chatId, "Enroll in subjects first — /subjects.");
  const { data } = await sb()
    .from("deadlines")
    .select("title,deadline_at,subjects(name)")
    .in("subject_id", Array.from(enrolled))
    .eq("is_archived", false)
    .eq("status", "active")
    .gte("deadline_at", new Date().toISOString())
    .order("deadline_at", { ascending: true })
    .limit(15);
  if (!data || data.length === 0) return sendMessage(chatId, "🎉 No upcoming deadlines.");
  const lines = data.map(
    (d: any) => `⏰ <b>${escape(d.title)}</b> — ${escape(d.subjects?.name ?? "")}\n   ${new Date(d.deadline_at).toUTCString()}`,
  );
  await sendMessage(chatId, `📌 <b>Upcoming deadlines</b>\n\n${lines.join("\n\n")}`);
}

function escape(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleUpdate(update: any) {
  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id || typeof msg.text !== "string") return;
  const chatId: number = msg.chat.id;
  const text: string = msg.text.trim();

  // Respect unsubscribed users — only /start resubscribes.
  const sub = await getSubscriber(chatId);
  const isSubscribed = sub?.is_subscribed ?? false;

  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const arg = rest.join(" ");

  if (cmd === "/start") return cmdStart(chatId, msg);
  if (!sub && cmd !== "/help") {
    return sendMessage(chatId, "Please send /start first to subscribe to StudyHub.");
  }
  if (!isSubscribed && cmd !== "/help") return; // silent only after explicit unsubscribe

  switch (cmd) {
    case "/help":
      return sendMessage(chatId, HELP);
    case "/stop":
      return cmdStop(chatId);
    case "/semesters":
      return cmdSemesters(chatId);
    case "/semester":
      return cmdSemesterPick(chatId, arg);
    case "/subjects":
      return cmdSubjects(chatId);
    case "/enroll":
      return cmdEnroll(chatId, arg);
    case "/enrollall":
      return cmdEnrollAll(chatId);
    case "/mysubjects":
    case "/myenrollments":
      return cmdMySubjects(chatId);
    case "/materials":
      return cmdMaterials(chatId);
    case "/get":
      return cmdGet(chatId, arg);
    case "/getall":
    case "/downloadall":
      return cmdGetAll(chatId);
    case "/deadlines":
      return cmdDeadlines(chatId);
    case "/adminalerts": {
      const on = /^on$/i.test(arg.trim());
      const off = /^off$/i.test(arg.trim());
      if (!on && !off) {
        return sendMessage(chatId, "Usage: <code>/adminalerts on</code> or <code>/adminalerts off</code>.");
      }
      await sb()
        .from("telegram_subscribers")
        .update({ receive_admin_alerts: on })
        .eq("chat_id", chatId);
      return sendMessage(
        chatId,
        on ? "🔔 You'll now receive bot health alerts." : "🔕 Health alerts disabled.",
      );
    }
    default:
      return sendMessage(chatId, `Unknown command. Try /help.`);
  }
}


// ---------- Route ----------
export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.TELEGRAM_API_KEY;
        if (!apiKey) return new Response("Bot not configured", { status: 500 });

        const expected = deriveWebhookSecret(apiKey);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        if (!update) return new Response("Bad Request", { status: 400 });

        try {
          // Wait for the reply/send work to finish before acknowledging the webhook.
          // Serverless requests can stop background promises after the response is returned.
          await handleUpdate(update);
        } catch (e) {
          console.error("telegram handleUpdate error", e);
        }
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, service: "telegram-webhook" }),
    },
  },
});
