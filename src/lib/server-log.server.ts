// Server-side edge log shipping. Writes to `public.server_logs` via the
// service_role client (bypasses RLS). 30-day retention is enforced by a
// pg_cron job (`purge-server-logs-30d`).
//
// Import from server-only modules — this file may not be pulled into the
// client bundle. In a route handler or server function, use:
//
//   const { logServer } = await import("@/lib/server-log.server");
//   await logServer("info", "stripe.checkout.completed", { route: "..." });

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  route?: string;
  requestId?: string;
  userId?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Ship one row to `server_logs`. Best-effort — never throws so callers
 * can `void logServer(...)` inside handlers without catching.
 */
export async function logServer(
  level: LogLevel,
  message: string,
  ctx: LogContext = {},
): Promise<void> {
  try {
    await supabaseAdmin.from("server_logs").insert({
      level,
      message: message.slice(0, 8000),
      route: ctx.route ?? null,
      request_id: ctx.requestId ?? null,
      user_id: ctx.userId ?? null,
      meta: ctx.meta ?? null,
    });
  } catch {
    // Logging must never break the request path.
  }
}
