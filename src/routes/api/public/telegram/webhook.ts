import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";
import type { Database } from "@/integrations/supabase/types";

// ---------- Config ----------
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const SITE_URL = "https://subject-sphere-pro.lovable.app";
const PAGE_SIZE = 8;

const MATERIAL_TYPES: { key: string; label: string; emoji: string }[] = [
  { key: "lecture_slide", label: "Lecture Slides", emoji: "📘" },
  { key: "note", label: "Notes", emoji: "📝" },
  { key: "past_paper", label: "Past Papers", emoji: "📄" },
  { key: "assignment", label: "Tutorials / Assignments", emoji: "📌" },
];

function typeLabel(key: string) {
  return MATERIAL_TYPES.find((t) => t.key === key)?.label ?? key;
}

// ---------- Telegram helpers ----------
async function tg(method: string, payload: unknown) {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const telegramApiKey = process.env.TELEGRAM_API_KEY;
  if (!lovableApiKey || !telegramApiKey) throw new Error("Telegram gateway is not configured");

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

type Kb = { inline_keyboard: Array<Array<Record<string, unknown>>> };

async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function editMessage(chatId: number, messageId: number, text: string, kb?: Kb) {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(kb ? { reply_markup: kb } : {}),
  });
}

async function answerCallback(id: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
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

// ---------- Supabase ----------
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

// ---------- Utilities ----------
function escape(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildAIPrompt(m: any) {
  const subj = m.subjects?.name ?? "Unknown";
  const sem = m.semesters?.name ?? "Unknown";
  return `I am a university student. I want you to teach me this PDF/lecture material completely and clearly.

Material details:
Title: ${m.title}
Subject: ${subj}
Semester: ${sem}
Material type: ${typeLabel(m.material_type)}
File name: ${m.file_name ?? "Unknown"}
PDF/file link: ${m.file_url_public ?? "PDF/file link not available"}

Please explain the whole material without missing important content.

Use simple student-friendly English.

Follow this structure:
1. Short overview of the material.
2. Explain every major heading/topic in order.
3. Explain the theory clearly.
4. Explain all formulas with the meaning of each symbol.
5. Show substitution steps for calculations.
6. Give small easy examples.
7. Explain diagrams, graphs, tables, and flowcharts.
8. Mention important definitions.
9. Mention exam-important points.
10. Give viva questions with simple speaking-style answers.
11. Give possible short-answer questions.
12. Give possible long-answer questions.
13. Give final quick revision summary.
14. Do not skip important small points.
15. If you cannot access the PDF link, ask me to upload the PDF manually.

Teach me like I am preparing for a quiz or exam.`;
}

// ---------- Subscriber helpers ----------
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

async function listSubjectsBySemester(semesterId: string) {
  const { data } = await sb()
    .from("subjects")
    .select("id,name,code")
    .eq("semester_id", semesterId)
    .order("name");
  return data ?? [];
}

async function getEnrolledSubjects(chatId: number) {
  const sub = await getSubscriber(chatId);
  const ids = ((sub as any)?.subject_ids as string[] | null) ?? [];
  if (ids.length === 0) return [];
  const { data } = await sb()
    .from("subjects")
    .select("id,name,code,semester_id,semesters(name)")
    .in("id", ids)
    .order("name");
  return data ?? [];
}

async function signedUrlFor(path: string) {
  const { data, error } = await sb().storage
    .from("learning-materials")
    .createSignedUrl(path, 60 * 60 * 4);
  if (error || !data) throw error ?? new Error("signed url failed");
  return data.signedUrl;
}

// ---------- Main menu ----------
const MAIN_MENU_KB: Kb = {
  inline_keyboard: [
    [{ text: "📥 Download Materials", callback_data: "d" }],
    [{ text: "📚 Enroll / Change Subjects", callback_data: "en" }],
    [{ text: "⏰ View Deadlines", callback_data: "dl" }],
    [{ text: "📌 My Subjects", callback_data: "ms" }],
    [{ text: "❓ Help", callback_data: "hp" }],
  ],
};

const HELP_TEXT = [
  "<b>📚 StudyGeniusX Bot</b>",
  "",
  "<b>Commands</b>",
  "/start — main menu",
  "/download — download materials (same as /materials)",
  "/materials — download materials",
  "/enroll — enroll in subjects",
  "/change_subjects — change your enrolled subjects",
  "/my_subjects — show your enrolled subjects",
  "/deadlines — upcoming deadlines",
  "/stop — unsubscribe",
  "/help — this menu",
].join("\n");

async function showMainMenu(chatId: number) {
  await sendMessage(chatId, "<b>Welcome to StudyGeniusX Bot 🎓</b>\n\nPick an option below:", {
    reply_markup: MAIN_MENU_KB,
  });
}

// ---------- Download flow ----------
async function showDownloadSubjects(chatId: number, messageId?: number) {
  const subjects = await getEnrolledSubjects(chatId);
  if (subjects.length === 0) {
    const text = "❗ You are not enrolled yet.\nPlease select your semester and subjects first.";
    const kb: Kb = { inline_keyboard: [[{ text: "📚 Enroll Now", callback_data: "en" }]] };
    if (messageId) return editMessage(chatId, messageId, text, kb);
    return sendMessage(chatId, text, { reply_markup: kb });
  }

  const rows: Array<Array<Record<string, unknown>>> = subjects.map((s: any) => [
    { text: s.name, callback_data: `ds:${s.id}` },
  ]);
  rows.push([
    { text: "🔄 Change Subjects", callback_data: "cs" },
    { text: "❌ Cancel", callback_data: "x" },
  ]);
  const kb: Kb = { inline_keyboard: rows };
  const text = "<b>📥 Download Materials</b>\n\nSelect one of your enrolled subjects:";
  if (messageId) return editMessage(chatId, messageId, text, kb);
  return sendMessage(chatId, text, { reply_markup: kb });
}

async function showCategories(chatId: number, messageId: number, subjectId: string) {
  const { data: subject } = await sb()
    .from("subjects")
    .select("id,name,semester_id,semesters(name)")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) return editMessage(chatId, messageId, "This subject no longer exists.");

  const rows: Array<Array<Record<string, unknown>>> = MATERIAL_TYPES.map((t) => [
    { text: `${t.emoji} ${t.label}`, callback_data: `dc:${subjectId}:${t.key}:0` },
  ]);
  rows.push([{ text: "⏰ Deadlines", callback_data: `dd:${subjectId}` }]);
  rows.push([
    { text: "🔙 Back to Subjects", callback_data: "d" },
    { text: "❌ Cancel", callback_data: "x" },
  ]);
  const kb: Kb = { inline_keyboard: rows };
  const text = `<b>${escape((subject as any).name)}</b>\n${escape((subject as any).semesters?.name ?? "")}\n\nPick a category:`;
  return editMessage(chatId, messageId, text, kb);
}

async function showMaterialList(
  chatId: number,
  messageId: number,
  subjectId: string,
  type: string,
  page: number,
) {
  const { data: subject } = await sb()
    .from("subjects")
    .select("id,name")
    .eq("id", subjectId)
    .maybeSingle();

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: materials, count } = await sb()
    .from("materials")
    .select("id,title,material_type", { count: "exact" })
    .eq("subject_id", subjectId)
    .eq("material_type", type)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!materials || materials.length === 0) {
    const kb: Kb = {
      inline_keyboard: [
        [{ text: "🔙 Back to Categories", callback_data: `ds:${subjectId}` }],
        [{ text: "❌ Cancel", callback_data: "x" }],
      ],
    };
    return editMessage(
      chatId,
      messageId,
      `<b>${escape((subject as any)?.name ?? "")}</b> → ${escape(typeLabel(type))}\n\nNo materials uploaded for this category yet.`,
      kb,
    );
  }

  const rows: Array<Array<Record<string, unknown>>> = materials.map((m, i) => [
    { text: `${from + i + 1}. ${m.title}`.slice(0, 60), callback_data: `dm:${m.id}` },
  ]);

  const nav: Array<Record<string, unknown>> = [];
  if (page > 0) nav.push({ text: "⬅️ Previous", callback_data: `dc:${subjectId}:${type}:${page - 1}` });
  if ((count ?? 0) > to + 1) nav.push({ text: "➡️ Next", callback_data: `dc:${subjectId}:${type}:${page + 1}` });
  if (nav.length) rows.push(nav);

  rows.push([
    { text: "🔙 Back to Categories", callback_data: `ds:${subjectId}` },
    { text: "❌ Cancel", callback_data: "x" },
  ]);

  const kb: Kb = { inline_keyboard: rows };
  const header = `<b>${escape((subject as any)?.name ?? "")}</b> → ${escape(typeLabel(type))}\n\nAvailable materials:`;
  return editMessage(chatId, messageId, header, kb);
}

async function sendMaterial(chatId: number, materialId: string) {
  const { data: m } = await sb()
    .from("materials")
    .select("id,title,material_type,file_url,file_name,created_at,subject_id,semester_id,subjects(name),semesters(name)")
    .eq("id", materialId)
    .maybeSingle();

  if (!m) {
    return sendMessage(chatId, "This material is no longer available.");
  }
  if (!m.file_url) {
    return sendMessage(chatId, "This material file is not available right now.");
  }

  let signed = "";
  try {
    signed = await signedUrlFor(m.file_url);
  } catch (e) {
    console.error("signed url failed", e);
    return sendMessage(chatId, "This material file is not available right now.");
  }

  const uploaded = new Date(m.created_at as string).toISOString().slice(0, 10);
  const caption = [
    `📘 <b>${escape(m.title)}</b>`,
    "",
    `Subject: ${escape((m as any).subjects?.name ?? "")}`,
    `Semester: ${escape((m as any).semesters?.name ?? "")}`,
    `Type: ${escape(typeLabel(m.material_type))}`,
    `Uploaded: ${uploaded}`,
  ].join("\n");

  const prompt = buildAIPrompt({ ...m, file_url_public: signed });
  const encoded = encodeURIComponent(prompt).slice(0, 1800); // keep url button under limit
  const websiteUrl = `${SITE_URL}/material/${m.id}`;
  const chatgptUrl = `https://chatgpt.com/?q=${encoded}`;
  const geminiUrl = `https://gemini.google.com/app?prompt=${encoded}`;

  const buttonsKb: Kb = {
    inline_keyboard: [
      [
        { text: "⬇️ Download PDF", url: signed },
        { text: "🌐 Open in Website", url: websiteUrl },
      ],
      [
        { text: "🤖 Open in ChatGPT", url: chatgptUrl },
        { text: "✨ Open in Gemini", url: geminiUrl },
      ],
    ],
  };

  // Try direct document send with caption + buttons
  const res = await tg("sendDocument", {
    chat_id: chatId,
    document: signed,
    caption,
    parse_mode: "HTML",
    reply_markup: buttonsKb,
  });

  if (res?.ok) return;

  // Fallback: message with link buttons
  await sendMessage(
    chatId,
    `${caption}\n\n<i>Telegram could not send this PDF directly. Please use the buttons below.</i>`,
    { reply_markup: buttonsKb },
  );
}

async function showSubjectDeadlines(chatId: number, messageId: number, subjectId: string) {
  const { data: subject } = await sb()
    .from("subjects")
    .select("id,name")
    .eq("id", subjectId)
    .maybeSingle();
  const { data } = await sb()
    .from("deadlines")
    .select("title,description,deadline_at")
    .eq("subject_id", subjectId)
    .eq("is_archived", false)
    .eq("status", "active")
    .gte("deadline_at", new Date().toISOString())
    .order("deadline_at", { ascending: true })
    .limit(30);

  const kb: Kb = {
    inline_keyboard: [
      [{ text: "🔙 Back to Categories", callback_data: `ds:${subjectId}` }],
      [{ text: "❌ Cancel", callback_data: "x" }],
    ],
  };

  if (!data || data.length === 0) {
    return editMessage(
      chatId,
      messageId,
      `<b>${escape((subject as any)?.name ?? "")}</b> → ⏰ Deadlines\n\n🎉 No upcoming deadlines.`,
      kb,
    );
  }

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const buckets: Record<string, string[]> = { today: [], tomorrow: [], week: [], later: [] };
  for (const d of data) {
    const t = new Date(d.deadline_at as string).getTime();
    const diff = t - now;
    const days = Math.floor(diff / DAY);
    const hours = Math.floor((diff % DAY) / (60 * 60 * 1000));
    const remaining = diff < DAY ? `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))}h left` : `${days}d ${hours}h left`;
    const when = new Date(d.deadline_at as string).toUTCString();
    const line = `• <b>${escape(d.title)}</b>\n  ${when} — ${remaining}${d.description ? `\n  ${escape(d.description)}` : ""}`;
    if (diff < DAY) buckets.today.push(line);
    else if (diff < 2 * DAY) buckets.tomorrow.push(line);
    else if (diff < 7 * DAY) buckets.week.push(line);
    else buckets.later.push(line);
  }

  const sections: string[] = [];
  if (buckets.today.length) sections.push(`🔴 <b>Due Today</b>\n${buckets.today.join("\n")}`);
  if (buckets.tomorrow.length) sections.push(`🟠 <b>Due Tomorrow</b>\n${buckets.tomorrow.join("\n")}`);
  if (buckets.week.length) sections.push(`🟡 <b>Due This Week</b>\n${buckets.week.join("\n")}`);
  if (buckets.later.length) sections.push(`⚪ <b>Later</b>\n${buckets.later.join("\n")}`);

  const text = `<b>${escape((subject as any)?.name ?? "")}</b> → ⏰ Deadlines\n\n${sections.join("\n\n")}`;
  return editMessage(chatId, messageId, text, kb);
}

// ---------- Enrollment (inline buttons) ----------
async function showEnrollSemesters(chatId: number, messageId?: number, mode: "enroll" | "change" = "enroll") {
  const sems = await listSemesters();
  if (sems.length === 0) {
    const t = "No active semesters yet.";
    return messageId ? editMessage(chatId, messageId, t) : sendMessage(chatId, t);
  }
  const rows: Array<Array<Record<string, unknown>>> = sems.map((s) => [
    { text: s.name, callback_data: `esp:${s.id}` },
  ]);
  rows.push([{ text: "❌ Cancel", callback_data: "x" }]);
  const kb: Kb = { inline_keyboard: rows };
  const title = mode === "change" ? "🔄 <b>Change subjects</b>" : "📚 <b>Enrollment</b>";
  const text = `${title}\n\nStep 1 — pick your semester:`;
  if (messageId) return editMessage(chatId, messageId, text, kb);
  return sendMessage(chatId, text, { reply_markup: kb });
}

async function showEnrollSubjects(chatId: number, messageId: number, semesterId: string) {
  // Set selected semester if changing (only reset subjects when switching semester)
  const sub = await getSubscriber(chatId);
  if (sub?.selected_semester_id !== semesterId) {
    await sb()
      .from("telegram_subscribers")
      .update({ selected_semester_id: semesterId, subject_ids: [] })
      .eq("chat_id", chatId);
  }

  const subjects = await listSubjectsBySemester(semesterId);
  if (subjects.length === 0) {
    return editMessage(chatId, messageId, "No subjects in this semester yet.");
  }
  const enrolled = new Set(((sub as any)?.subject_ids as string[] | null) ?? []);
  // If we just switched semesters, enrolled is empty
  const effective = sub?.selected_semester_id === semesterId ? enrolled : new Set<string>();

  const rows: Array<Array<Record<string, unknown>>> = subjects.map((s) => [
    { text: `${effective.has(s.id) ? "✅" : "▫️"} ${s.name}`, callback_data: `est:${s.id}` },
  ]);
  rows.push([
    { text: "✅ Enroll All", callback_data: `esa:${semesterId}` },
    { text: "🧹 Clear All", callback_data: `esc:${semesterId}` },
  ]);
  rows.push([
    { text: "🔙 Change Semester", callback_data: "en" },
    { text: "✔️ Done", callback_data: "edn" },
  ]);
  const kb: Kb = { inline_keyboard: rows };
  await editMessage(
    chatId,
    messageId,
    "📚 <b>Toggle your subjects</b>\n\nTap a subject to enroll/unenroll.",
    kb,
  );
}

async function toggleEnrollSubject(chatId: number, messageId: number, subjectId: string) {
  const sub = await getSubscriber(chatId);
  if (!sub?.selected_semester_id) return showEnrollSemesters(chatId, messageId);
  const current = new Set(((sub as any).subject_ids as string[] | null) ?? []);
  if (current.has(subjectId)) current.delete(subjectId);
  else current.add(subjectId);
  await sb()
    .from("telegram_subscribers")
    .update({ subject_ids: Array.from(current) } as any)
    .eq("chat_id", chatId);
  return showEnrollSubjects(chatId, messageId, sub.selected_semester_id);
}

async function enrollAllInSemester(chatId: number, messageId: number, semesterId: string) {
  const subjects = await listSubjectsBySemester(semesterId);
  await sb()
    .from("telegram_subscribers")
    .update({ selected_semester_id: semesterId, subject_ids: subjects.map((s) => s.id) } as any)
    .eq("chat_id", chatId);
  return showEnrollSubjects(chatId, messageId, semesterId);
}

async function clearEnrolledInSemester(chatId: number, messageId: number, semesterId: string) {
  await sb()
    .from("telegram_subscribers")
    .update({ selected_semester_id: semesterId, subject_ids: [] } as any)
    .eq("chat_id", chatId);
  return showEnrollSubjects(chatId, messageId, semesterId);
}

async function enrollDone(chatId: number, messageId: number) {
  const subjects = await getEnrolledSubjects(chatId);
  const text =
    subjects.length === 0
      ? "You have not selected any subjects. Send /enroll to try again."
      : `✅ <b>Enrollment saved</b>\n\n${subjects.map((s: any) => `• ${escape(s.name)}`).join("\n")}\n\nUse /download to grab materials.`;
  return editMessage(chatId, messageId, text);
}

async function cmdMySubjects(chatId: number) {
  const subjects = await getEnrolledSubjects(chatId);
  if (subjects.length === 0) {
    return sendMessage(chatId, "You have not selected subjects yet. Please enroll first with /enroll.");
  }
  const lines = subjects.map((s: any) => `✅ ${escape(s.code ?? "")} — ${escape(s.name)}`);
  await sendMessage(chatId, `🎓 <b>Your subjects</b>\n\n${lines.join("\n")}`);
}

async function cmdMySubjects(chatId: number) {
  const subjects = await getEnrolledSubjects(chatId);
  if (subjects.length === 0) {
    return sendMessage(chatId, "You have not selected subjects yet. Please enroll first with /enroll.");
  }
  const lines = subjects.map((s: any) => `✅ ${escape(s.code ?? "")} — ${escape(s.name)}`);
  await sendMessage(chatId, `🎓 <b>Your subjects</b>\n\n${lines.join("\n")}`);
}

async function cmdDeadlines(chatId: number) {
  const subjects = await getEnrolledSubjects(chatId);
  if (subjects.length === 0) return sendMessage(chatId, "Enroll in subjects first — /enroll.");
  const ids = subjects.map((s: any) => s.id);
  const { data } = await sb()
    .from("deadlines")
    .select("title,deadline_at,subjects(name)")
    .in("subject_id", ids)
    .eq("is_archived", false)
    .eq("status", "active")
    .gte("deadline_at", new Date().toISOString())
    .order("deadline_at", { ascending: true })
    .limit(20);
  if (!data || data.length === 0) return sendMessage(chatId, "🎉 No upcoming deadlines.");
  const lines = data.map(
    (d: any) => `⏰ <b>${escape(d.title)}</b> — ${escape(d.subjects?.name ?? "")}\n   ${new Date(d.deadline_at).toUTCString()}`,
  );
  await sendMessage(chatId, `📌 <b>Upcoming deadlines</b>\n\n${lines.join("\n\n")}`);
}

async function cmdStop(chatId: number) {
  await sb().from("telegram_subscribers").update({ is_subscribed: false }).eq("chat_id", chatId);
  await sendMessage(chatId, "🔕 Unsubscribed. Send /start to resubscribe.");
}

// ---------- Update dispatchers ----------
async function handleMessage(msg: any) {
  const chatId: number = msg.chat.id;
  const text: string = (msg.text ?? "").trim();
  if (!text) return;

  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const arg = rest.join(" ");

  if (cmd === "/start") {
    await ensureSubscriber(msg);
    return showMainMenu(chatId);
  }

  const sub = await getSubscriber(chatId);
  if (!sub) return sendMessage(chatId, "Please send /start first.");
  if (!sub.is_subscribed && cmd !== "/help") return;

  switch (cmd) {
    case "/help":
      return sendMessage(chatId, HELP_TEXT);
    case "/download":
    case "/materials":
      return showDownloadSubjects(chatId);
    case "/enroll":
      if (arg) return cmdEnrollToggle(chatId, arg);
      return cmdEnrollStart(chatId);
    case "/change_subjects":
      return cmdChangeSubjects(chatId);
    case "/my_subjects":
    case "/mysubjects":
    case "/myenrollments":
      return cmdMySubjects(chatId);
    case "/deadlines":
      return cmdDeadlines(chatId);
    case "/semesters":
      return cmdSemesters(chatId);
    case "/semester":
      return cmdSemesterPick(chatId, arg);
    case "/subjects":
      return cmdSubjectsList(chatId);
    case "/enrollall":
      return cmdEnrollAll(chatId);
    case "/stop":
      return cmdStop(chatId);
    case "/adminalerts": {
      const on = /^on$/i.test(arg.trim());
      const off = /^off$/i.test(arg.trim());
      if (!on && !off) return sendMessage(chatId, "Usage: <code>/adminalerts on|off</code>.");
      await sb()
        .from("telegram_subscribers")
        .update({ receive_admin_alerts: on })
        .eq("chat_id", chatId);
      return sendMessage(chatId, on ? "🔔 Admin alerts enabled." : "🔕 Admin alerts disabled.");
    }
    default:
      return sendMessage(chatId, "Unknown command. Try /help.");
  }
}

async function handleCallback(cb: any) {
  const chatId: number = cb.message?.chat?.id;
  const messageId: number = cb.message?.message_id;
  const data: string = cb.data ?? "";
  if (!chatId || !messageId) {
    await answerCallback(cb.id);
    return;
  }

  const [action, ...parts] = data.split(":");

  try {
    switch (action) {
      case "m":
        await answerCallback(cb.id);
        await editMessage(chatId, messageId, "<b>Welcome to StudyGeniusX Bot 🎓</b>\n\nPick an option below:", MAIN_MENU_KB);
        return;
      case "d":
        await answerCallback(cb.id);
        return showDownloadSubjects(chatId, messageId);
      case "ds":
        await answerCallback(cb.id);
        return showCategories(chatId, messageId, parts[0]);
      case "dc":
        await answerCallback(cb.id);
        return showMaterialList(chatId, messageId, parts[0], parts[1], Number(parts[2] ?? 0));
      case "dd":
        await answerCallback(cb.id);
        return showSubjectDeadlines(chatId, messageId, parts[0]);
      case "dm":
        await answerCallback(cb.id, "Sending…");
        return sendMaterial(chatId, parts[0]);
      case "en":
        await answerCallback(cb.id);
        await cmdEnrollStart(chatId);
        return;
      case "cs":
        await answerCallback(cb.id);
        await cmdChangeSubjects(chatId);
        return;
      case "ms":
        await answerCallback(cb.id);
        await cmdMySubjects(chatId);
        return;
      case "dl":
        await answerCallback(cb.id);
        await cmdDeadlines(chatId);
        return;
      case "hp":
        await answerCallback(cb.id);
        await sendMessage(chatId, HELP_TEXT);
        return;
      case "x":
        await answerCallback(cb.id, "Cancelled");
        await tg("deleteMessage", { chat_id: chatId, message_id: messageId }).catch(() => {});
        return;
      default:
        await answerCallback(cb.id, "This menu is outdated. Please type /download again.");
        return;
    }
  } catch (e) {
    console.error("callback error", action, e);
    await answerCallback(cb.id, "Something went wrong.");
  }
}

async function handleUpdate(update: any) {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id) return;
  return handleMessage(msg);
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
