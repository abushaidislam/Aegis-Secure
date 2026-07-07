/**
 * Cross-device approval endpoint (Phase 10.3 UI).
 *
 * A push notification (or another device) opens `/approve?nonce=…`. This
 * page loads under `_authenticated/` so an unauthenticated visitor gets
 * bounced to sign-in first — the nonce is user-scoped and can only be
 * consumed by its owner (server-side `consumePushNonce` enforces).
 *
 * Two buttons:
 *   - Approve → calls `consumePushNonce` (marks consumed, signature verified server-side).
 *   - Reject  → also calls `consumePushNonce` but with a `deny` flag in local state;
 *               the nonce is still consumed so it can't be replayed by anyone else.
 *
 * If the nonce is expired / already used / forbidden, we render the reason
 * so the user knows what happened instead of showing a silent no-op.
 */

import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Check, ShieldCheck, X, AlertTriangle, ArrowLeft } from "lucide-react";

import { consumePushNonce } from "@/lib/push.functions";
import { BORDER, CHARCOAL, CREAM_SOFT, MUTED, PrimaryButton } from "@/components/aegis/chrome";

const searchSchema = z.object({
  nonce: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/approve")({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Approve request · Aegis" },
      {
        name: "description",
        content: "Confirm a cross-device sign-in or export request from your Aegis vault.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApprovePage,
  errorComponent: ({ error, reset }) => (
    <FramePanel>
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6" style={{ color: "#b47a2d" }} />
        <h1 className="mb-1 text-base font-medium" style={{ color: CHARCOAL }}>
          Something went wrong
        </h1>
        <p className="mb-4 text-sm" style={{ color: MUTED }}>
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <PrimaryButton onClick={() => reset()}>Try again</PrimaryButton>
      </div>
    </FramePanel>
  ),
  notFoundComponent: () => (
    <FramePanel>
      <p className="text-sm text-center" style={{ color: MUTED }}>
        This approval link is not valid.
      </p>
    </FramePanel>
  ),
});

function FramePanel({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-dvh flex items-center justify-center px-4 py-10"
      style={{ background: CREAM_SOFT }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#fff", border: `1px solid ${BORDER}` }}
      >
        {children}
      </div>
    </main>
  );
}

type Verdict =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "approved"; action: string; payload: Record<string, unknown> }
  | { kind: "denied" }
  | { kind: "error"; reason: string };

function humanReason(reason: string): string {
  switch (reason) {
    case "not_found":
      return "This approval request was not found. It may have been cancelled.";
    case "forbidden":
      return "This approval request belongs to a different account.";
    case "already_consumed":
      return "This request was already handled from another device.";
    case "expired":
      return "This approval request has expired. Please retry from the original device.";
    case "bad_signature":
      return "The approval token failed integrity verification. Please retry.";
    default:
      return `Couldn't process this request (${reason}).`;
  }
}

function humanAction(action: string): string {
  switch (action) {
    case "approve_login":
      return "Approve sign-in on another device";
    case "approve_export":
      return "Approve vault export";
    default:
      return `Approve action: ${action}`;
  }
}

function ApprovePage() {
  const { nonce } = useSearch({ from: "/_authenticated/approve" });
  const consume = useServerFn(consumePushNonce);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "idle" });

  const mutation = useMutation({
    mutationFn: async (opts: { deny: boolean }) => {
      if (!nonce) throw new Error("Missing nonce");
      const res = await consume({ data: { nonceId: nonce } });
      return { res, deny: opts.deny };
    },
    onMutate: () => setVerdict({ kind: "pending" }),
    onSuccess: ({ res, deny }) => {
      if (!res.ok) {
        setVerdict({ kind: "error", reason: res.reason });
        return;
      }
      if (deny) setVerdict({ kind: "denied" });
      else
        setVerdict({
          kind: "approved",
          action: res.action,
          payload: (res.payload as Record<string, unknown>) ?? {},
        });
    },
    onError: (err) =>
      setVerdict({ kind: "error", reason: err instanceof Error ? err.message : "unknown" }),
  });

  // If the URL has no nonce at all, short-circuit before showing buttons.
  useEffect(() => {
    if (!nonce) setVerdict({ kind: "error", reason: "not_found" });
  }, [nonce]);

  if (!nonce || verdict.kind === "error") {
    const reason = verdict.kind === "error" ? verdict.reason : "not_found";
    return (
      <FramePanel>
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6" style={{ color: "#b47a2d" }} />
          <h1 className="mb-1 text-base font-medium" style={{ color: CHARCOAL }}>
            Cannot approve this request
          </h1>
          <p className="mb-4 text-sm" style={{ color: MUTED }}>
            {humanReason(reason)}
          </p>
          <Link
            to="/security"
            className="inline-flex items-center gap-1 text-sm hover:underline"
            style={{ color: CHARCOAL }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Security
          </Link>
        </div>
      </FramePanel>
    );
  }

  if (verdict.kind === "approved") {
    return (
      <FramePanel>
        <div className="text-center">
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "#e6f4ea" }}
          >
            <Check className="h-5 w-5" style={{ color: "#2f7a44" }} />
          </div>
          <h1 className="mb-1 text-base font-medium" style={{ color: CHARCOAL }}>
            Approved
          </h1>
          <p className="mb-4 text-sm" style={{ color: MUTED }}>
            {humanAction(verdict.action)} was confirmed. You can close this tab.
          </p>
          <Link to="/security" className="text-sm hover:underline" style={{ color: CHARCOAL }}>
            Back to Security
          </Link>
        </div>
      </FramePanel>
    );
  }

  if (verdict.kind === "denied") {
    return (
      <FramePanel>
        <div className="text-center">
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "#fdecec" }}
          >
            <X className="h-5 w-5" style={{ color: "#b03a3a" }} />
          </div>
          <h1 className="mb-1 text-base font-medium" style={{ color: CHARCOAL }}>
            Rejected
          </h1>
          <p className="mb-4 text-sm" style={{ color: MUTED }}>
            The request has been denied. If you didn't initiate it, we recommend rotating
            your passphrase.
          </p>
          <Link to="/security" className="text-sm hover:underline" style={{ color: CHARCOAL }}>
            Back to Security
          </Link>
        </div>
      </FramePanel>
    );
  }

  const busy = verdict.kind === "pending";

  return (
    <FramePanel>
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "#f7f4ed" }}
          >
            <ShieldCheck className="h-5 w-5" style={{ color: CHARCOAL }} />
          </div>
          <div>
            <h1 className="text-base font-medium" style={{ color: CHARCOAL }}>
              Confirm this request
            </h1>
            <p className="text-xs" style={{ color: MUTED }}>
              A device is waiting for your approval.
            </p>
          </div>
        </div>

        <div
          className="mb-4 rounded-lg p-3 text-xs"
          style={{ background: CREAM_SOFT, border: `1px solid ${BORDER}`, color: MUTED }}
        >
          <div className="mb-1">
            <span style={{ color: CHARCOAL }}>Request ID: </span>
            <code className="break-all">{nonce}</code>
          </div>
          <div>
            Only approve if you initiated this action. Once approved, it cannot be undone
            from this page.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => mutation.mutate({ deny: true })}
            disabled={busy}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
            style={{ border: `1px solid ${BORDER}`, background: "#fff", color: CHARCOAL }}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate({ deny: false })}
            disabled={busy}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
            style={{ background: CHARCOAL, color: CREAM_SOFT }}
          >
            {busy ? "Working…" : "Approve"}
          </button>
        </div>
      </div>
    </FramePanel>
  );
}
