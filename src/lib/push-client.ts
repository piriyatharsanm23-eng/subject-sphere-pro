import { supabase } from "@/integrations/supabase/client";
import { getSelection } from "@/lib/selection";

/** Browser-side Web Push helpers (registration, subscribe, unsubscribe). */

const SW_URL = "/push-sw.js";

/** Public VAPID key (safe to ship to the browser) used when the config call is unavailable. */
const FALLBACK_VAPID_PUBLIC_KEY =
  "BFq54VGtW-vA-jRbXsnsL_wNhfKmQXHgz9Zvs_FupOGwxv21LmqXqXOQHVmx2PxGLo3jxGHpgqsOnAYVxglvfms";

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/public/push/config", { headers: { accept: "application/json" } });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("application/json")) {
      const cfg = (await res.json()) as { enabled?: boolean; publicKey?: string | null };
      if (cfg?.publicKey) return cfg.publicKey;
    }
  } catch {
    /* fall through to the built-in key */
  }
  return FALLBACK_VAPID_PUBLIC_KEY || null;
}


export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function isPushEnabled() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  return Boolean(await currentSubscription());
}

async function followedSubjectIds(): Promise<string[]> {
  const sel = getSelection();
  if (sel?.subjectIds?.length) return sel.subjectIds;
  return [];
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/public/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userId: data.session?.user.id ?? null,
      subjectIds: await followedSubjectIds(),
      userAgent: navigator.userAgent.slice(0, 300),
    }),
  });
  if (!res.ok) throw new Error("Could not save this device");
}

/** Asks permission (if needed) and registers this device. Returns true when active. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) throw new Error("This browser does not support notifications");

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return false;

  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    throw new Error(
      "Notifications aren't available on this address yet. Open the app from the main site and try again.",
    );
  }


  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await saveSubscription(sub);
  return true;
}

/** Removes this device from push alerts. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  await fetch("/api/public/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
}

/**
 * Keeps the stored device record in sync (followed subjects / signed-in account)
 * without prompting. No-op when the user has not opted in.
 */
export async function syncPushSubscription() {
  try {
    if (!(await isPushEnabled())) return;
    const sub = await currentSubscription();
    if (sub) await saveSubscription(sub);
  } catch {
    /* never break the page over notifications */
  }
}
