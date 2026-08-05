import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";

/** Server-only helpers for sending Web Push messages. */

let _sb: SupabaseClient<Database> | null = null;
export function pushDb() {
  if (!_sb) {
    _sb = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _sb;
}

let _keys: ApplicationServerKeys | null = null;
async function keys() {
  if (!_keys) {
    _keys = await ApplicationServerKeys.fromJSON({
      publicKey: process.env["VAPID_PUBLIC_KEY"]!,
      privateKey: process.env["VAPID_PRIVATE_KEY"]!,
    });
  }
  return _keys;
}

export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

/** Sends one payload to many devices; prunes subscriptions the browser has expired. */
export async function sendPush(targets: PushTarget[], payload: PushPayload) {
  if (targets.length === 0) return { sent: 0, removed: 0 };
  const asKeys = await keys();
  const contact = process.env["VAPID_SUBJECT"] || "mailto:admin@studyhub.app";
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    targets.map(async (t) => {
      try {
        const { headers, body, endpoint } = await generatePushHTTPRequest({
          applicationServerKeys: asKeys,
          payload: JSON.stringify(payload),
          target: { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          adminContact: contact,
          ttl: 60 * 60 * 24,
          urgency: "normal",
        });
        const res = await fetch(endpoint, { method: "POST", headers, body });
        if (res.ok) sent++;
        else if (res.status === 404 || res.status === 410) dead.push(t.id);
      } catch {
        /* one bad device must never abort the batch */
      }
    }),
  );

  if (dead.length > 0) {
    await pushDb().from("push_subscriptions").delete().in("id", dead);
  }
  return { sent, removed: dead.length };
}

export async function targetsForUsers(userIds: string[]): Promise<Map<string, PushTarget[]>> {
  const map = new Map<string, PushTarget[]>();
  if (userIds.length === 0) return map;
  const { data } = await pushDb()
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,user_id")
    .in("user_id", userIds);
  for (const row of (data ?? []) as any[]) {
    const list = map.get(row.user_id) ?? [];
    list.push({ id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    map.set(row.user_id, list);
  }
  return map;
}

export async function targetsForSubject(subjectId: string): Promise<PushTarget[]> {
  const { data } = await pushDb()
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,subject_ids")
    .contains("subject_ids", [subjectId]);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
  }));
}
