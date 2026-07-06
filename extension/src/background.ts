/**
 * MV3 service worker.
 *
 * Phase 10.1 responsibilities are intentionally narrow: keep the worker
 * warm, expose a health-check message channel, and validate the sender
 * origin against a strict allow-list. Autofill routing lands in 10.2.
 *
 * The worker runs in a sandboxed context — no DOM, no window. It shares
 * the vault modules with the popup via the extension bundler, and can
 * only reach the network endpoints listed in `connect-src`.
 */

/// <reference types="chrome" />

// Origins that are allowed to `chrome.runtime.sendMessage` INTO the
// extension (see manifest `externally_connectable.matches`). Duplicated
// here so the runtime can reject spoofed senders even if the manifest
// entry is widened in the future by mistake.
const ALLOWED_EXTERNAL_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/,
  /^http:\/\/localhost:8080$/,
];

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_EXTERNAL_ORIGINS.some((re) => re.test(origin));
}

// Keep the SW warm during active use so autofill (10.2) doesn't pay a
// cold-start on every keystroke. Chrome forcibly terminates after ~30s
// of idleness regardless; the alarm just prevents shorter idle kills.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("aegis-keepalive", { periodInMinutes: 1 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "aegis-keepalive") {
    // no-op: touching an API resets the idle timer
    void chrome.storage.local.get("__aegis_touch");
  }
});

type Message = { type: "PING" } | { type: "GET_VERSION" };
type Response = { ok: true; version?: string } | { ok: false; error: string };

function handle(msg: Message): Response {
  switch (msg.type) {
    case "PING":
      return { ok: true };
    case "GET_VERSION":
      return { ok: true, version: chrome.runtime.getManifest().version };
    default:
      return { ok: false, error: "unknown_message" };
  }
}

// Same-extension messages (popup → SW, content → SW).
chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  try {
    sendResponse(handle(msg));
  } catch (e) {
    sendResponse({ ok: false, error: e instanceof Error ? e.message : "error" });
  }
  return true; // keep the channel open for async responders added later
});

// Cross-origin messages (web app → SW). Reject anything not on the
// allow-list even though the manifest already filters — defence in depth.
chrome.runtime.onMessageExternal.addListener((msg: Message, sender, sendResponse) => {
  if (!originAllowed(sender.origin ?? sender.url)) {
    sendResponse({ ok: false, error: "forbidden_origin" });
    return;
  }
  sendResponse(handle(msg));
});

export {};
