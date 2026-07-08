import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EntityType = z.enum(["material", "deadline", "kuppi"]);

const TABLE_BY_ENTITY = {
  material: "materials",
  deadline: "deadlines",
  kuppi: "kuppi_videos",
} as const;

type Entity = keyof typeof TABLE_BY_ENTITY;

async function assertAdminOfSemester(supabase: any, userId: string, semesterId: string) {
  const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_super_admin", { _user_id: userId }),
    supabase.rpc("is_admin_of", { _user_id: userId, _semester_id: semesterId }),
  ]);
  if (!isSuper && !isAdmin) throw new Error("Forbidden");
  return { isSuper: !!isSuper };
}

/**
 * Admin proposes an update to a material / deadline / kuppi row.
 * Super admins bypass the queue and apply immediately.
 */
export const requestUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entityType: Entity; entityId: string; proposedData: Record<string, unknown> }) =>
    z
      .object({
        entityType: EntityType,
        entityId: z.string().uuid(),
        proposedData: z.record(z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const table = TABLE_BY_ENTITY[data.entityType];

    const { data: row, error } = await supabase.from(table).select("*").eq("id", data.entityId).maybeSingle();
    if (error || !row) throw new Error("Item not found");

    const { isSuper } = await assertAdminOfSemester(supabase, userId, (row as any).semester_id);

    // Super admin applies immediately.
    if (isSuper) {
      const { error: upErr } = await (supabase.from(table) as any).update(data.proposedData).eq("id", data.entityId);
      if (upErr) throw new Error(upErr.message);
      return { queued: false };
    }

    // Semester admin: queue for approval, live row untouched.
    const { error: qErr } = await supabase.from("pending_changes").insert({
      entity_type: data.entityType,
      entity_id: data.entityId,
      action: "update",
      proposed_data: data.proposedData as any,
      snapshot: row as any,
      requested_by: userId,
      semester_id: (row as any).semester_id,
    });
    if (qErr) throw new Error(qErr.message);
    return { queued: true };
  });

/**
 * Admin proposes deletion. Live row is hidden immediately from students via
 * `pending_delete = true`. Super admin approval performs the hard delete.
 */
export const requestDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entityType: Entity; entityId: string }) =>
    z.object({ entityType: EntityType, entityId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const table = TABLE_BY_ENTITY[data.entityType];

    const { data: row, error } = await supabase.from(table).select("*").eq("id", data.entityId).maybeSingle();
    if (error || !row) throw new Error("Item not found");

    const { isSuper } = await assertAdminOfSemester(supabase, userId, (row as any).semester_id);

    if (isSuper) {
      const { error: delErr } = await supabase.from(table).delete().eq("id", data.entityId);
      if (delErr) throw new Error(delErr.message);
      return { queued: false };
    }

    const { error: hideErr } = await supabase
      .from(table)
      .update({ pending_delete: true })
      .eq("id", data.entityId);
    if (hideErr) throw new Error(hideErr.message);

    const { error: qErr } = await supabase.from("pending_changes").insert({
      entity_type: data.entityType,
      entity_id: data.entityId,
      action: "delete",
      proposed_data: null,
      snapshot: row as any,
      requested_by: userId,
      semester_id: (row as any).semester_id,
    });
    if (qErr) throw new Error(qErr.message);
    return { queued: true };
  });

/** Super admin approves a pending change. */
export const approveChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pendingId: string }) => z.object({ pendingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSuper) throw new Error("Forbidden");

    const { data: p, error } = await supabase
      .from("pending_changes")
      .select("*")
      .eq("id", data.pendingId)
      .maybeSingle();
    if (error || !p) throw new Error("Pending change not found");
    if ((p as any).status !== "pending") throw new Error("Already reviewed");

    const table = TABLE_BY_ENTITY[(p as any).entity_type as Entity];

    if ((p as any).action === "update") {
      const { error: upErr } = await (supabase.from(table) as any)
        .update((p as any).proposed_data ?? {})
        .eq("id", (p as any).entity_id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: delErr } = await supabase.from(table).delete().eq("id", (p as any).entity_id);
      if (delErr) throw new Error(delErr.message);
    }

    await supabase
      .from("pending_changes")
      .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.pendingId);

    return { ok: true };
  });

/** Super admin rejects a pending change. Restores the live row for deletes. */
export const rejectChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pendingId: string; reason?: string }) =>
    z.object({ pendingId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSuper) throw new Error("Forbidden");

    const { data: p, error } = await supabase
      .from("pending_changes")
      .select("*")
      .eq("id", data.pendingId)
      .maybeSingle();
    if (error || !p) throw new Error("Pending change not found");
    if ((p as any).status !== "pending") throw new Error("Already reviewed");

    if ((p as any).action === "delete") {
      const table = TABLE_BY_ENTITY[(p as any).entity_type as Entity];
      await supabase.from(table).update({ pending_delete: false }).eq("id", (p as any).entity_id);
    }

    await supabase
      .from("pending_changes")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        reject_reason: data.reason ?? null,
      })
      .eq("id", data.pendingId);

    return { ok: true };
  });
