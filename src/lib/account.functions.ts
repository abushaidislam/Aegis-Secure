import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the signed-in user's account:
 * - Wipes every row they own in public tables (vault_accounts, vault_meta, profiles).
 * - Deletes the auth.users row via the Admin API so the email can be reused.
 *
 * Auth is enforced by `requireSupabaseAuth`; the destructive step uses the
 * service-role client but only against the caller's own userId.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Order matters only for readability — there are no FKs between these
    // tables, and the admin client bypasses RLS.
    const wipes = await Promise.all([
      supabaseAdmin.from("vault_accounts").delete().eq("user_id", userId),
      supabaseAdmin.from("vault_meta").delete().eq("user_id", userId),
      supabaseAdmin.from("profiles").delete().eq("id", userId),
    ]);
    for (const w of wipes) {
      if (w.error) throw new Error(w.error.message);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
