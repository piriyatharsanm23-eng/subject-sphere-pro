import { createFileRoute } from "@tanstack/react-router";
import {
  pushDb,
  sendPush,
  targetsForSubject,
  targetsForUsers,
  type PushTarget,
} from "@/lib/push.server";

const TIME_ZONE = "Asia/Colombo";

function fmtDeadline(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

async function dispatch() {
  if (!process.env["VAPID_PUBLIC_KEY"] || !process.env["VAPID_PRIVATE_KEY"]) {
    return Response.json({ ok: false, error: "Push not configured" }, { status: 500 });
  }
  const db = pushDb();
  const now = new Date().toISOString();
  let sent = 0;

  // 1. Per-account alerts (admins, super admins, assigned users)
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const { data: notifs } = await db
    .from("notifications")
    .select("id,user_id,kind,title,body,link")
    .is("pushed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);

  const notifRows = (notifs ?? []) as any[];
  if (notifRows.length > 0) {
    const byUser = await targetsForUsers([...new Set(notifRows.map((n) => n.user_id))]);
    for (const n of notifRows) {
      const targets = byUser.get(n.user_id);
      if (targets?.length) {
        const r = await sendPush(targets, {
          title: n.title,
          body: n.body ?? "",
          url: n.link ?? "/",
          tag: `notif-${n.kind}`,
        });
        sent += r.sent;
      }
    }
    await db
      .from("notifications")
      .update({ pushed_at: now } as never)
      .in("id", notifRows.map((n) => n.id));
  }

  // 2. New materials -> everyone following that subject (guests included)
  const { data: materials } = await db
    .from("materials")
    .select("id,title,material_type,subject_id,subjects(name,code)")
    .is("push_notified_at", null)
    .eq("is_archived", false)
    .eq("pending_delete", false)
    .order("created_at", { ascending: true })
    .limit(30);

  const matRows = (materials ?? []) as any[];
  const subjectCache = new Map<string, PushTarget[]>();
  for (const m of matRows) {
    let targets = subjectCache.get(m.subject_id);
    if (!targets) {
      targets = await targetsForSubject(m.subject_id);
      subjectCache.set(m.subject_id, targets);
    }
    const label = m.subjects?.code
      ? `${m.subjects.code} — ${m.subjects.name ?? ""}`
      : (m.subjects?.name ?? "New material");
    const r = await sendPush(targets, {
      title: `New ${m.material_type}: ${m.title}`,
      body: label,
      url: `/material/${m.id}`,
      tag: `material-${m.id}`,
    });
    sent += r.sent;
  }
  if (matRows.length > 0) {
    await db
      .from("materials")
      .update({ push_notified_at: now } as never)
      .in("id", matRows.map((m) => m.id));
  }

  // 3. New deadlines -> everyone following that subject
  const { data: deadlines } = await db
    .from("deadlines")
    .select("id,title,deadline_at,subject_id,subjects(name,code)")
    .is("push_notified_at", null)
    .eq("is_archived", false)
    .eq("pending_delete", false)
    .order("created_at", { ascending: true })
    .limit(30);

  const dlRows = (deadlines ?? []) as any[];
  for (const d of dlRows) {
    let targets = subjectCache.get(d.subject_id);
    if (!targets) {
      targets = await targetsForSubject(d.subject_id);
      subjectCache.set(d.subject_id, targets);
    }
    const label = d.subjects?.code
      ? `${d.subjects.code} — ${d.subjects.name ?? ""}`
      : (d.subjects?.name ?? "");
    const r = await sendPush(targets, {
      title: `⏰ Deadline: ${d.title}`,
      body: `${label} · due ${fmtDeadline(d.deadline_at)}`,
      url: `/subject/${d.subject_id}`,
      tag: `deadline-${d.id}`,
    });
    sent += r.sent;
  }
  if (dlRows.length > 0) {
    await db
      .from("deadlines")
      .update({ push_notified_at: now } as never)
      .in("id", dlRows.map((d) => d.id));
  }

  return Response.json({
    ok: true,
    messages_sent: sent,
    alerts: notifRows.length,
    materials: matRows.length,
    deadlines: dlRows.length,
  });
}

/** Public: delivers queued push messages. Safe to call repeatedly — rows are marked once sent. */
export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: dispatch,
      GET: dispatch,
    },
  },
});
