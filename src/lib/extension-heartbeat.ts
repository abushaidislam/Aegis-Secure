/**
 * Extension heartbeat (Phase 10 stability).
 *
 * MV3 service workers evict after ~30 s of idleness, which wipes the
 * unlocked-vault state the web app pushed via SYNC_VAULT. Rather than
 * try to keep the SW alive (Chrome actively fights that), we do the
 * opposite: pretend the extension is disposable and auto-resync from
 * the web app whenever it's stale.
 *
 * Contract:
 *   - Runs only when a user is signed in AND the web vault is unlocked
 *     AND the extension is installed.
 *   - Every HEARTBEAT_MS: GET_STATE the extension.
 *     - Ext locked  → resync silently.
 *     - Ext unlocked but syncSeq lower than our local counter → resync.
 *     - Ext unlocked and seq matches → do nothing.
 *   - Also refires on tab focus / visibility change so returning to the
 *     tab after a long absence is instant.
 *
 * Failures are swallowed. This is opportunistic — the manual "Sync"
 * button in Security remains the fallback.
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVaultKey, isVaultUnlocked } from "@/lib/vault-session";
import { readCachedAccountsOnly, syncAccountsFromServer } from "@/lib/vault-accounts";
import {
  getLocalSyncSeq,
  isExtensionInstalled,
  pingExtensionState,
  syncVaultToExtension,
} from "@/lib/extension-bridge";

const HEARTBEAT_MS = 30_000;
const MIN_RESYNC_INTERVAL_MS = 5_000;

let lastResyncAt = 0;
let inFlight = false;

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function resyncIfPossible(): Promise<void> {
  if (inFlight) return;
  if (Date.now() - lastResyncAt < MIN_RESYNC_INTERVAL_MS) return;
  if (!isVaultUnlocked()) return;
  const dek = getVaultKey();
  if (!dek) return;
  const userId = await currentUserId();
  if (!userId) return;

  inFlight = true;
  try {
    let accounts = await readCachedAccountsOnly(dek, userId);
    if (!accounts || accounts.length === 0) {
      accounts = await syncAccountsFromServer(dek, userId);
    }
    if (!accounts || accounts.length === 0) return;
    await syncVaultToExtension({ userId, accounts });
    lastResyncAt = Date.now();
  } catch {
    /* swallow — heartbeat retries on next tick */
  } finally {
    inFlight = false;
  }
}

async function tick(): Promise<void> {
  if (!isExtensionInstalled()) return;
  if (!isVaultUnlocked()) return;

  const state = await pingExtensionState();
  if (!state.ok) return;

  const localSeq = getLocalSyncSeq();
  const needsResync = !state.unlocked || state.syncSeq < localSeq || state.syncSeq === 0;
  if (needsResync) await resyncIfPossible();
}

/**
 * Mount once inside the authenticated tabs layout. Safe no-op on SSR,
 * on browsers without Chrome APIs, and when the vault is locked.
 */
export function useExtensionHeartbeat(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const kick = () => {
      if (stopped) return;
      void tick();
    };

    // First tick shortly after mount so a freshly-opened tab picks up
    // an evicted SW without waiting a full heartbeat.
    const initial = setTimeout(kick, 1_500);
    timer = setInterval(kick, HEARTBEAT_MS);

    const onFocus = () => kick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") kick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      clearTimeout(initial);
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
