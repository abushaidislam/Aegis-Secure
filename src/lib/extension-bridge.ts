/**
 * Web-app → browser-extension bridge (Phase 10.2 handoff).
 *
 * When the vault is unlocked in the web app, this helper can push the
 * decrypted account list to the Aegis extension's service worker via
 * `chrome.runtime.sendMessage` (works cross-origin because the
 * extension's manifest lists this app's origin in `externally_connectable`).
 *
 * The SW keeps the accounts in memory for at most `ttlMs` (capped at
 * 5 min server-side); after that the extension is locked again and the
 * user must resync from the web app.
 *
 * This module intentionally has NO side effects at import time. It's a
 * pure function that returns `{ ok: false, reason: 'no_extension' }`
 * when Chrome APIs aren't present, so it's safe to call from any
 * environment (SSR, sandbox preview, tests).
 */

import type { DecryptedAccount } from "@/lib/vault-accounts";

/**
 * Read the extension's runtime ID from the DOM. The Aegis extension's
 * `announce.js` content script stamps `data-aegis-extension-id` on
 * <html> at document_start when it's installed, so any user who has
 * the extension gets auto-detected — no hardcoded ID, no config.
 */
function discoverExtensionId(): string | null {
  if (typeof document === "undefined") return null;
  const id = document.documentElement?.dataset?.aegisExtensionId;
  return id && id.length > 0 ? id : null;
}

export function isExtensionInstalled(): boolean {
  return discoverExtensionId() !== null;
}

type SendResult =
  | { ok: true; accountCount: number; syncSeq: number }
  | { ok: false; reason: "no_extension" | "no_id" | "send_failed"; detail?: string };

export type ExtensionState =
  | { ok: true; unlocked: boolean; accountCount: number; expiresAt: number; syncSeq: number; syncedAt: number; userId: string }
  | { ok: false; reason: "no_extension" | "no_id" | "send_failed"; detail?: string };

interface ChromeRuntimeLike {
  sendMessage: (
    id: string,
    msg: unknown,
    cb: (res: Record<string, unknown> | undefined) => void,
  ) => void;
  lastError?: { message?: string };
}

function getRuntime(): ChromeRuntimeLike | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as { chrome?: { runtime?: ChromeRuntimeLike } };
  return g.chrome?.runtime ?? null;
}

function stripToExtShape(a: DecryptedAccount) {
  return {
    id: a.id,
    issuer: a.issuer,
    label: a.label,
    secret: a.secret,
    algorithm: a.algorithm,
    digits: a.digits,
    period: a.period,
    otp_type: a.otp_type,
  };
}

/**
 * Module-local monotonic sync counter. Bumped on every successful
 * `syncVaultToExtension` so the heartbeat can detect that the extension
 * is running with a stale vault (SW restart, TTL expiry, another tab
 * pushed a newer copy).
 */
let LOCAL_SYNC_SEQ = 0;

export function getLocalSyncSeq(): number {
  return LOCAL_SYNC_SEQ;
}


export async function syncVaultToExtension(params: {
  userId: string;
  accounts: DecryptedAccount[];
  ttlMs?: number;
  /** Override the extension ID list (test seams). */
  extensionIds?: readonly string[];
}): Promise<SendResult> {
  const runtime = getRuntime();
  if (!runtime) return { ok: false, reason: "no_extension" };

  const discovered = discoverExtensionId();
  const ids = params.extensionIds ?? (discovered ? [discovered] : []);
  if (ids.length === 0) return { ok: false, reason: "no_id" };

  const totp = params.accounts
    .filter((a) => a.otp_type !== "hotp")
    .map(stripToExtShape);

  const nextSeq = LOCAL_SYNC_SEQ + 1;

  for (const id of ids) {
    const result: SendResult = await new Promise((resolve) => {
      try {
        runtime.sendMessage(
          id,
          {
            type: "SYNC_VAULT",
            userId: params.userId,
            accounts: totp,
            ttlMs: params.ttlMs,
            syncSeq: nextSeq,
          },
          (res) => {
            const err = runtime.lastError?.message;
            if (err) {
              resolve({ ok: false, reason: "send_failed", detail: err });
              return;
            }
            if (res?.ok) {
              const count = typeof res.accountCount === "number" ? res.accountCount : totp.length;
              const seq = typeof res.syncSeq === "number" ? res.syncSeq : nextSeq;
              resolve({ ok: true, accountCount: count, syncSeq: seq });
            } else {
              const detail = typeof res?.error === "string" ? res.error : "unknown";
              resolve({ ok: false, reason: "send_failed", detail });
            }
          },
        );
      } catch (e) {
        resolve({
          ok: false,
          reason: "send_failed",
          detail: e instanceof Error ? e.message : "throw",
        });
      }
    });
    if (result.ok) {
      LOCAL_SYNC_SEQ = nextSeq;
      return result;
    }
  }
  return { ok: false, reason: "send_failed" };
}

/**
 * Cheap read-only ping: asks the extension SW for current state (unlocked
 * flag, account count, sync counter). Used by the heartbeat to detect SW
 * eviction / TTL expiry without shipping any vault contents.
 */
export async function pingExtensionState(extensionIds?: readonly string[]): Promise<ExtensionState> {
  const runtime = getRuntime();
  if (!runtime) return { ok: false, reason: "no_extension" };

  const discovered = discoverExtensionId();
  const ids = extensionIds ?? (discovered ? [discovered] : []);
  if (ids.length === 0) return { ok: false, reason: "no_id" };

  for (const id of ids) {
    const result: ExtensionState = await new Promise((resolve) => {
      try {
        runtime.sendMessage(id, { type: "GET_STATE" }, (res) => {
          const err = runtime.lastError?.message;
          if (err) {
            resolve({ ok: false, reason: "send_failed", detail: err });
            return;
          }
          if (!res?.ok) {
            const detail = typeof res?.error === "string" ? res.error : "unknown";
            resolve({ ok: false, reason: "send_failed", detail });
            return;
          }
          resolve({
            ok: true,
            unlocked: !!res.unlocked,
            accountCount: typeof res.accountCount === "number" ? res.accountCount : 0,
            expiresAt: typeof res.expiresAt === "number" ? res.expiresAt : 0,
            syncSeq: typeof res.syncSeq === "number" ? res.syncSeq : 0,
            syncedAt: typeof res.syncedAt === "number" ? res.syncedAt : 0,
            userId: typeof res.userId === "string" ? res.userId : "",
          });
        });
      } catch (e) {
        resolve({
          ok: false,
          reason: "send_failed",
          detail: e instanceof Error ? e.message : "throw",
        });
      }
    });
    if (result.ok) return result;
  }
  return { ok: false, reason: "send_failed" };
}

