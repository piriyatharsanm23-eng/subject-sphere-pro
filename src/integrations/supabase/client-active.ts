// Backend switch — do NOT edit the auto-generated client.ts.
// When VITE_BACKEND === "external", the app talks to your own Supabase
// project (VITE_EXTERNAL_SUPABASE_URL / VITE_EXTERNAL_SUPABASE_PUBLISHABLE_KEY).
// Otherwise it falls through to the Lovable Cloud client.
//
// vite.config.ts aliases "@/integrations/supabase/client" to this file so
// every existing import in the app resolves here transparently.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase as cloudSupabase } from "./client";

const backend = (import.meta.env.VITE_BACKEND ?? "cloud").toLowerCase();

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createExternalClient() {
  const url = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || process.env.EXTERNAL_SUPABASE_URL;
  const key =
    import.meta.env.VITE_EXTERNAL_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXTERNAL_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "VITE_BACKEND=external but VITE_EXTERNAL_SUPABASE_URL / VITE_EXTERNAL_SUPABASE_PUBLISHABLE_KEY are missing in .env",
    );
  }
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      // Isolate the external session from the Cloud session so switching
      // backends does not stomp the other's stored auth.
      storageKey: "sb-external-auth",
    },
  });
}

let _external: ReturnType<typeof createExternalClient> | undefined;

// Lazy proxy so a missing env var only throws when the client is actually used.
const externalSupabase = new Proxy({} as ReturnType<typeof createExternalClient>, {
  get(_, prop, receiver) {
    if (!_external) _external = createExternalClient();
    return Reflect.get(_external, prop, receiver);
  },
});

export const supabase = backend === "external" ? externalSupabase : cloudSupabase;
