/**
 * Content script shell for Phase 10.1.
 *
 * Injected only into origins the user has explicitly granted host access
 * to (see `optional_host_permissions` + `chrome.permissions.request`).
 * The actual OTP-field detector and prompt UI land in Phase 10.2; this
 * file exists so the manifest, permissions dance, and message channel
 * are wired up and testable now.
 */

/// <reference types="chrome" />

async function ping(): Promise<boolean> {
  try {
    const res = await chrome.runtime.sendMessage({ type: "PING" });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

// Announce readiness without touching the page DOM. The SW can log or
// count these to sanity-check that host permissions were granted.
void ping();

export {};
