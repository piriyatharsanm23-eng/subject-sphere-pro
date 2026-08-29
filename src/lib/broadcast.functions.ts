import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(1000),
  link: z.string().trim().max(300).optional(),
  audience: z.enum(["contributors", "admins", "everyone"]).default("contributors"),
});

/** Super Admin broadcast: in-app notification + device push (push worker picks up unpushed rows). */
export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSuper) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = new Set<string>();

    if (data.audience === "everyone") {
      const { data: rows } = await supabaseAdmin.from("profiles").select("id");
      for (const r of rows ?? []) ids.add(r.id as string);
    } else {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
      for (const r of (roles ?? []) as any[]) {
        if (r.role === "admin" || r.role === "super_admin") ids.add(r.user_id);
      }
      if (data.audience === "contributors") {
        const [mats, kuppi, dls] = await Promise.all([
          supabaseAdmin.from("materials").select("uploaded_by"),
          supabaseAdmin.from("kuppi_videos").select("uploaded_by"),
          supabaseAdmin.from("deadlines").select("created_by"),
        ]);
        for (const r of (mats.data ?? []) as any[]) if (r.uploaded_by) ids.add(r.uploaded_by);
        for (const r of (kuppi.data ?? []) as any[]) if (r.uploaded_by) ids.add(r.uploaded_by);
        for (const r of (dls.data ?? []) as any[]) if (r.created_by) ids.add(r.created_by);
      }
    }

    const recipients = [...ids];
    if (recipients.length === 0) return { ok: true, recipients: 0, emails: [] as string[] };

    const rows = recipients.map((uid) => ({
      user_id: uid,
      kind: "broadcast",
      title: data.title,
      body: data.message,
      link: data.link && data.link.length > 0 ? data.link : "/",
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabaseAdmin.from("notifications").insert(rows.slice(i, i + 200) as never);
      if (error) throw new Error(error.message);
    }

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .in("id", recipients);
    const emails = ((profs ?? []) as any[]).map((p) => p.email).filter(Boolean) as string[];

    return { ok: true, recipients: recipients.length, emails };
  });
