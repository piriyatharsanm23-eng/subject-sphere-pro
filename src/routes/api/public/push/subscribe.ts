import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { pushDb } from "@/lib/push.server";

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(10).max(300),
  auth: z.string().min(5).max(300),
  userId: z.string().uuid().nullable().optional(),
  subjectIds: z.array(z.string().uuid()).max(60).optional(),
  userAgent: z.string().max(300).optional(),
});

/** Public: registers or updates a device for push alerts (guests included). */
export const Route = createFileRoute("/api/public/push/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = subSchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
        }

        const { error } = await pushDb()
          .from("push_subscriptions")
          .upsert(
            {
              endpoint: parsed.endpoint,
              p256dh: parsed.p256dh,
              auth: parsed.auth,
              user_id: parsed.userId ?? null,
              subject_ids: parsed.subjectIds ?? [],
              user_agent: parsed.userAgent ?? null,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "endpoint" },
          );

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },

      DELETE: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
        if (!endpoint) return Response.json({ ok: false }, { status: 400 });
        await pushDb().from("push_subscriptions").delete().eq("endpoint", endpoint);
        return Response.json({ ok: true });
      },
    },
  },
});
