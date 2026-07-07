import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Puzzle,
  Chrome,
  Globe,
  Flame,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Activity,
  KeyRound,
  Keyboard,
} from "lucide-react";
import { SectionLabel, SettingsGroup, SettingsRow } from "@/components/aegis/settings";
import { supabase } from "@/integrations/supabase/client";
import { getVaultKey, isVaultUnlocked, useVaultUnlocked } from "@/lib/vault-session";
import { readCachedAccountsOnly, syncAccountsFromServer } from "@/lib/vault-accounts";
import {
  syncVaultToExtension,
  isExtensionInstalled,
  pingExtensionState,
  clearExtensionPairing,
  getLocalSyncSeq,
  type ExtensionState,
} from "@/lib/extension-bridge";
import { MUTED, CHARCOAL, BORDER } from "@/components/aegis/chrome";

/**
 * Extension section for the Security page.
 *
 * Before the extension is detected: shows three enabled install actions —
 * Chrome, Edge (both use the Chrome zip), and Firefox — plus a
 * collapsible "How to install" panel with the load-unpacked steps.
 *
 * After detection: shows a single "Sync to browser extension" row that
 * pushes the unlocked vault via `syncVaultToExtension`.
 */

const CHROME_ZIP = "/aegis-extension-chrome.zip";
const FIREFOX_ZIP = "/aegis-extension-firefox.zip";

async function downloadZip(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1_000);
}

type BrowserKey = "chrome" | "edge" | "firefox";

const BROWSERS: Array<{
  key: BrowserKey;
  label: string;
  hint: string;
  zip: string;
  filename: string;
  extensionsUrl: string;
  icon: React.ReactNode;
}> = [
  {
    key: "chrome",
    label: "Install for Chrome",
    hint: "Also works in Brave, Arc, Opera",
    zip: CHROME_ZIP,
    filename: "aegis-extension-chrome.zip",
    extensionsUrl: "chrome://extensions",
    icon: <Chrome className="h-4 w-4" strokeWidth={1.8} />,
  },
  {
    key: "edge",
    label: "Install for Microsoft Edge",
    hint: "Uses the Chromium build",
    zip: CHROME_ZIP,
    filename: "aegis-extension-chrome.zip",
    extensionsUrl: "edge://extensions",
    icon: <Globe className="h-4 w-4" strokeWidth={1.8} />,
  },
  {
    key: "firefox",
    label: "Install for Firefox",
    hint: "MV3 build, Firefox 128+",
    zip: FIREFOX_ZIP,
    filename: "aegis-extension-firefox.zip",
    extensionsUrl: "about:debugging#/runtime/this-firefox",
    icon: <Flame className="h-4 w-4" strokeWidth={1.8} />,
  },
];

export function ExtensionSyncSection() {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<BrowserKey | null>(null);
  const [downloadedFor, setDownloadedFor] = useState<Set<BrowserKey>>(new Set());
  const [installed, setInstalled] = useState<boolean>(() => isExtensionInstalled());
  const [showHelp, setShowHelp] = useState(false);
  const unlocked = useVaultUnlocked();

  useEffect(() => {
    if (installed) return;
    let n = 0;
    const t = setInterval(() => {
      if (isExtensionInstalled()) {
        setInstalled(true);
        clearInterval(t);
      } else if (++n > 20) {
        clearInterval(t);
      }
    }, 250);
    const onReady = () => setInstalled(true);
    window.addEventListener("aegis:extension-ready", onReady);
    return () => {
      clearInterval(t);
      window.removeEventListener("aegis:extension-ready", onReady);
    };
  }, [installed]);

  async function handleDownload(browser: (typeof BROWSERS)[number]) {
    if (downloading) return;
    setDownloading(browser.key);
    try {
      await downloadZip(browser.zip, browser.filename);
      setDownloadedFor((prev) => new Set(prev).add(browser.key));
      setShowHelp(true);
      toast.success(`Downloaded ${browser.filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  async function handleSync() {
    if (!isVaultUnlocked()) {
      toast.error("Unlock your vault first");
      return;
    }
    const dek = getVaultKey();
    if (!dek) {
      toast.error("Vault key unavailable — unlock again");
      return;
    }
    setBusy(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Not signed in");
      const userId = userRes.user.id;

      let accounts = await readCachedAccountsOnly(dek, userId);
      if (!accounts || accounts.length === 0) {
        accounts = await syncAccountsFromServer(dek, userId);
      }
      if (!accounts || accounts.length === 0) {
        toast.error("No accounts to sync");
        return;
      }

      const res = await syncVaultToExtension({ userId, accounts });
      if (res.ok) {
        toast.success(
          `Synced ${res.accountCount} account${res.accountCount === 1 ? "" : "s"} to extension`,
        );
      } else if (res.reason === "no_extension") {
        toast.error("Browser extension APIs unavailable here");
      } else if (res.reason === "no_id") {
        toast.error("Aegis extension not detected — install it first");
      } else {
        toast.error(`Sync failed: ${res.detail ?? "unknown"}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionLabel>Browser extension</SectionLabel>
      <SettingsGroup>
        {installed ? (
          <SettingsRow
            icon={
              busy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <Puzzle className="h-4 w-4" strokeWidth={1.8} />
              )
            }
            title="Sync to browser extension"
            description={
              !unlocked
                ? "Unlock your vault first, then sync accounts to the extension."
                : "Send unlocked accounts to the Aegis extension so it can autofill codes. Auto-clears after 5 min of inactivity."
            }
            badge="Detected"
            onClick={busy || !unlocked ? undefined : handleSync}
            disabled={busy || !unlocked}
            chevron
          />
        ) : (
          BROWSERS.map((b) => {
            const isBusy = downloading === b.key;
            const done = downloadedFor.has(b.key);
            return (
              <SettingsRow
                key={b.key}
                icon={
                  isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                  ) : done ? (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    b.icon
                  )
                }
                title={b.label}
                description={done ? `Downloaded — now load unpacked in ${b.extensionsUrl}` : b.hint}
                badge={done ? "Downloaded" : undefined}
                onClick={downloading ? undefined : () => void handleDownload(b)}
                disabled={!!downloading && !isBusy}
                chevron
              />
            );
          })
        )}
      </SettingsGroup>

      {installed && <ExtensionHealthGroup unlocked={unlocked} />}



      {!installed && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px]"
            style={{ color: MUTED }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform"
                style={{ transform: showHelp ? "rotate(0deg)" : "rotate(-90deg)" }}
                strokeWidth={2}
              />
              How to install
            </span>
            <ExternalLink className="h-3 w-3" strokeWidth={2} />
          </button>
          {showHelp && (
            <ol
              className="mt-1 space-y-1.5 rounded-lg border px-4 py-3 text-[12.5px] leading-relaxed"
              style={{ borderColor: BORDER, color: CHARCOAL }}
            >
              <li>1. Download the zip above for your browser.</li>
              <li>2. Unzip the file to a folder you'll keep.</li>
              <li>
                3. Open <code className="rounded bg-black/5 px-1 py-0.5 text-[11.5px]">chrome://extensions</code>{" "}
                (or <code className="rounded bg-black/5 px-1 py-0.5 text-[11.5px]">edge://extensions</code>,{" "}
                <code className="rounded bg-black/5 px-1 py-0.5 text-[11.5px]">about:debugging</code> for Firefox).
              </li>
              <li>4. Enable <strong style={{ color: CHARCOAL }}>Developer mode</strong> (top-right).</li>
              <li>
                5. Click <strong style={{ color: CHARCOAL }}>Load unpacked</strong> (Chrome/Edge) or{" "}
                <strong style={{ color: CHARCOAL }}>Load Temporary Add-on</strong> (Firefox) and select the unzipped folder.
              </li>
              <li>6. Return to this page — the sync option will appear automatically.</li>
            </ol>
          )}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------- */
/*  Extension health card                                                */
/* -------------------------------------------------------------------- */

function relTime(ts: number): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function ExtensionHealthGroup({ unlocked }: { unlocked: boolean }) {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const s = await pingExtensionState();
      if (alive) setState(s);
    };
    void load();
    const iv = setInterval(load, 10_000);
    // Re-render every 15s so "relative time" strings stay fresh even when
    // the underlying state hasn't changed.
    const clock = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => {
      alive = false;
      clearInterval(iv);
      clearInterval(clock);
    };
  }, []);

  void tick; // referenced for eslint

  const localSeq = getLocalSyncSeq();
  const remoteSeq = state?.ok ? state.syncSeq : 0;
  const stale = state?.ok && state.unlocked && remoteSeq < localSeq;

  async function handleRepair() {
    setRepairing(true);
    try {
      const cleared = clearExtensionPairing();
      if (!cleared) {
        toast.error("Extension not detected");
        return;
      }
      toast.success("Pairing key cleared — next sync will re-pair");
      // Force an immediate state refresh so the UI reflects the reset.
      const s = await pingExtensionState();
      setState(s);
    } finally {
      setRepairing(false);
    }
  }

  const extUnlocked = state?.ok ? state.unlocked : false;
  const accountCount = state?.ok ? state.accountCount : 0;
  const syncedAt = state?.ok ? state.syncedAt : 0;

  return (
    <div className="mt-4">
      <SectionLabel>Extension health</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          icon={<Activity className="h-4 w-4" strokeWidth={1.8} />}
          title="Extension status"
          description={
            !state
              ? "Checking…"
              : !state.ok
                ? "Couldn't reach extension"
                : extUnlocked
                  ? `Unlocked · ${accountCount} account${accountCount === 1 ? "" : "s"} · synced ${relTime(syncedAt)}`
                  : "Locked — sync from this page to unlock it"
          }
          badge={extUnlocked ? "Unlocked" : "Locked"}
        />
        <SettingsRow
          icon={<KeyRound className="h-4 w-4" strokeWidth={1.8} />}
          title={stale ? "Sync counter (stale)" : "Sync counter"}
          description={
            stale
              ? `Extension has seq ${remoteSeq}, this tab has ${localSeq}. A resync will bring it up to date.`
              : `local seq ${localSeq} · extension seq ${remoteSeq}`
          }
          badge={stale ? "Stale" : undefined}
        />
        <SettingsRow
          icon={
            repairing ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <KeyRound className="h-4 w-4" strokeWidth={1.8} />
            )
          }
          title="Re-pair extension"
          description="Wipe the cached pairing key and reissue a handshake on the next sync. Use this only if syncs fail with signature errors."
          onClick={repairing ? undefined : handleRepair}
          disabled={repairing || !unlocked}
          chevron
        />
        <SettingsRow
          icon={<Keyboard className="h-4 w-4" strokeWidth={1.8} />}
          title="Keyboard shortcut"
          description="Ctrl + Shift + L (⌘ + Shift + L on Mac) autofills the top-matched OTP into the focused input on any tab."
        />
      </SettingsGroup>
    </div>
  );
}

