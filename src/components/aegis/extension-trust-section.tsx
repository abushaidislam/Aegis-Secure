/**
 * "Extension trust" panel — user-facing runtime allowlist for the Aegis
 * browser extension (Phase 10.2 hardening UI).
 *
 * When the extension announces itself via `data-aegis-extension-id`, the
 * bridge only trusts the ID if it's in the hardcoded published list, the
 * build-time env list, or (this panel) the user's runtime trust store.
 *
 * Trust granted here persists in `localStorage` and requires an explicit
 * click, so it is functionally equivalent to Chrome's "Load unpacked"
 * toggle — intentional trust, not passive discovery from the DOM.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Puzzle, ShieldOff } from "lucide-react";

import { SectionLabel, SettingsGroup, SettingsRow } from "@/components/aegis/settings";
import { BORDER, CHARCOAL, MUTED } from "@/components/aegis/chrome";
import {
  discoverExtensionIdUnverified,
  isRuntimeTrusted,
  trustExtensionRuntime,
  untrustExtensionRuntime,
  isExtensionInstalled,
} from "@/lib/extension-bridge";

export function ExtensionTrustSection() {
  const [detectedId, setDetectedId] = useState<string | null>(() =>
    discoverExtensionIdUnverified(),
  );
  const [trusted, setTrusted] = useState<boolean>(() => isExtensionInstalled());
  const [busy, setBusy] = useState(false);

  // Keep detection fresh: the extension can attach after we mount.
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      const id = discoverExtensionIdUnverified();
      setDetectedId(id);
      setTrusted(isExtensionInstalled());
      if (++n > 20) clearInterval(t);
    }, 300);
    const onReady = () => {
      setDetectedId(discoverExtensionIdUnverified());
      setTrusted(isExtensionInstalled());
    };
    window.addEventListener("aegis:extension-ready", onReady);
    return () => {
      clearInterval(t);
      window.removeEventListener("aegis:extension-ready", onReady);
    };
  }, []);

  // Hide entirely when no extension is even announcing itself.
  if (!detectedId) return null;

  const runtimeTrusted = isRuntimeTrusted(detectedId);

  async function handleTrust() {
    if (!detectedId) return;
    setBusy(true);
    try {
      trustExtensionRuntime(detectedId);
      setTrusted(true);
      toast.success("Extension trusted on this device");
    } finally {
      setBusy(false);
    }
  }

  async function handleUntrust() {
    if (!detectedId) return;
    setBusy(true);
    try {
      untrustExtensionRuntime(detectedId);
      setTrusted(isExtensionInstalled());
      toast.success("Extension trust removed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionLabel>Extension trust</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          icon={
            trusted ? (
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} style={{ color: "#3c8c5a" }} />
            ) : (
              <AlertTriangle className="h-4 w-4" strokeWidth={1.8} style={{ color: "#b47a2d" }} />
            )
          }
          title={trusted ? "Extension trusted" : "Untrusted extension detected"}
          description={
            trusted
              ? "This device will sync your vault to the extension."
              : "Sync is blocked until you explicitly trust this extension ID."
          }
        />
        <SettingsRow
          icon={<Puzzle className="h-4 w-4" strokeWidth={1.8} />}
          title="Extension ID"
          description={detectedId}
        />
        {!runtimeTrusted && !trusted && (
          <SettingsRow
            icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />}
            title={busy ? "Trusting…" : "Trust this extension"}
            description="Only click if you installed the Aegis extension yourself."
            onClick={busy ? undefined : handleTrust}
          />
        )}
        {runtimeTrusted && (
          <SettingsRow
            icon={<ShieldOff className="h-4 w-4" strokeWidth={1.8} />}
            title={busy ? "Removing…" : "Remove trust"}
            description="Revoke this device's trust for the extension above."
            onClick={busy ? undefined : handleUntrust}
            danger
          />
        )}
      </SettingsGroup>
      {!trusted && (
        <div
          className="mx-1 mb-3 rounded-lg p-3 text-xs"
          style={{ background: "#faf3e6", border: `1px solid ${BORDER}`, color: MUTED }}
        >
          <div className="mb-1 font-medium" style={{ color: CHARCOAL }}>
            Why the extra step?
          </div>
          Any browser extension can stamp its ID into the page. Aegis only trusts IDs on
          the official published list, or ones you explicitly approve here — otherwise a
          malicious extension could impersonate Aegis and receive your vault secrets.
        </div>
      )}
    </>
  );
}
