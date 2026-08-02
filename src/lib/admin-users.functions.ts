import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes a user account. Super admins only. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isSuper, error: roleError } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!isSuper) throw new Error("Forbidden");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetIsSuper } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: data.userId,
    });
    if (targetIsSuper) throw new Error("Remove super-admin role before deleting this account");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("notifications").delete().eq("user_id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    return { ok: true };
  });
