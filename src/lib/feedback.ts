// User-facing "Report a problem" — writes a redacted feedback row to
// `client_errors`. The table's admin-only SELECT policy plus the
// `route = 'feedback:<category>'` tag lets support triage without any
// JSON-metadata schema.
//
// Zero-knowledge invariant: we never touch vault DEKs, TOTP secrets,
// account labels, or issuers. Only the user's message, category, path,
// UA, and viewport are captured.

import { supabase } from "@/integrations/supabase/client";

export type FeedbackCategory = "bug" | "idea" | "question" | "other";

const MAX_MESSAGE = 4000;

function redactMessage(raw: string): string {
  const clipped = raw.slice(0, MAX_MESSAGE);
  return clipped
    // e-mails
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    // long alphanumeric blobs (tokens, base32 secrets) — 20+ chars
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[token]")
    // uuids
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[uuid]",
    );
}

export async function submitFeedback(input: {
  category: FeedbackCategory;
  message: string;
}): Promise<void> {
  const message = redactMessage(input.message.trim());
  if (!message) throw new Error("Message is empty");

  const path =
    typeof window !== "undefined" ? window.location.pathname : "unknown";
  const viewport =
    typeof window !== "undefined"
      ? `${window.innerWidth}x${window.innerHeight}`
      : "0x0";
  const summary = `[${input.category}] ${message}\n\n— viewport=${viewport}`;

  const { error } = await supabase.from("client_errors").insert({
    message: summary,
    route: `feedback:${input.category}`,
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    stack_redacted: path,
  });
  if (error) throw error;
}
