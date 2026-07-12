// Public connectivity/diagnostics endpoint. Verifies that the deployed
// build has the Supabase env vars baked in AND that the edge worker can
// actually reach the Supabase Data API. No PII, no secrets in the
// response — only presence flags, URL host, key prefix, and a short
// round-trip status. Safe to call from a browser or curl.

import { createFileRoute } from "@tanstack/react-router";

function keyPrefix(v: string | undefined): string | null {
  if (!v) return null;
  return v.slice(0, 12) + "…";
}

async function runCheck() {
  const startedAt = Date.now();

  // Server-side env (what the worker sees).
  const serverUrl = process.env.SUPABASE_URL;
  const serverKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  const env = {
    server: {
      SUPABASE_URL: Boolean(serverUrl),
      SUPABASE_PUBLISHABLE_KEY: Boolean(serverKey),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    urlHost: (() => {
      try {
        return serverUrl ? new URL(serverUrl).host : null;
      } catch {
        return null;
      }
    })(),
    publishableKeyPrefix: keyPrefix(serverKey),
  };

  let reach: {
    ok: boolean;
    status?: number;
    ms?: number;
    error?: string;
  } = { ok: false };

  if (serverUrl && serverKey) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${serverUrl.replace(/\/$/, "")}/auth/v1/health`, {
        method: "GET",
        headers: { apikey: serverKey },
      });
      reach = { ok: res.ok, status: res.status, ms: Date.now() - t0 };
    } catch (e) {
      reach = { ok: false, error: (e as Error).message };
    }
  } else {
    reach = { ok: false, error: "missing_env" };
  }

  return {
    ok: env.server.SUPABASE_URL && env.server.SUPABASE_PUBLISHABLE_KEY && reach.ok,
    at: new Date().toISOString(),
    totalMs: Date.now() - startedAt,
    env,
    reach,
  };
}

export const Route = createFileRoute("/api/public/supabase-check")({
  server: {
    handlers: {
      GET: async () => {
        const body = await runCheck();
        // Log to worker console so it also shows up in server-function-logs.
        console.log("[supabase-check]", JSON.stringify(body));
        return new Response(JSON.stringify(body, null, 2), {
          status: body.ok ? 200 : 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
