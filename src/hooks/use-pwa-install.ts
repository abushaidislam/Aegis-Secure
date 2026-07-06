// Phase 6.1: Install-prompt gating for Aegis.
//
// Three gates must all pass before we surface the "Install Aegis" pill:
//   1. The browser fired `beforeinstallprompt` and handed us a deferred
//      prompt (Chrome/Edge/Samsung on Android; some desktop Chromiums).
//      iOS Safari never fires it — we rely on the manifest-only path
//      there and the pill simply never appears.
//   2. The user has visited the vault at least three times (localStorage
//      counter `aegis:vault_visits`). Counted on mount, once per session.
//   3. The user hasn't dismissed the pill in a prior session, AND the
//      `pwa_install_prompt` feature_flag row is enabled server-side.
//
// The hook is deliberately quiet if any gate fails — no UI, no logs.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VISITS_KEY = "aegis:vault_visits";
const DISMISSED_KEY = "aegis:install_prompt_dismissed";
const VISITS_THRESHOLD = 3;

// Chromium's beforeinstallprompt event shape (not in lib.dom yet).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function bumpVisitCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(VISITS_KEY);
    const next = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
    window.localStorage.setItem(VISITS_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return true;
  }
}

function alreadyInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

export function usePwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [flagEnabled, setFlagEnabled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());
  const [installed, setInstalled] = useState<boolean>(() => alreadyInstalled());
  const [visits] = useState<number>(() => bumpVisitCount());

  useEffect(() => {
    if (installed || dismissed) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed, dismissed]);

  useEffect(() => {
    // Fetch the flag once per mount. Failure = silently off, no toast.
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("feature_flags")
          .select("enabled")
          .eq("key", "pwa_install_prompt")
          .maybeSingle();
        if (!cancelled) setFlagEnabled(Boolean(data?.enabled));
      } catch {
        if (!cancelled) setFlagEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canPrompt = useMemo(
    () =>
      !installed &&
      !dismissed &&
      flagEnabled === true &&
      visits >= VISITS_THRESHOLD &&
      deferred !== null,
    [installed, dismissed, flagEnabled, visits, deferred],
  );

  async function prompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferred) return "unavailable";
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "dismissed") dismiss();
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }

  function dismiss(): void {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage disabled — the in-memory state alone still hides the pill.
    }
  }

  return { canPrompt, prompt, dismiss };
}
