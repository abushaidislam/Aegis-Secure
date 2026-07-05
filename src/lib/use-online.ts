import { useEffect, useState } from "react";

/**
 * React hook mirroring `navigator.onLine`. SSR-safe (defaults to `true`
 * on the server) and re-renders on `online` / `offline` window events.
 *
 * Note: `navigator.onLine` is best-effort — it flips only when the
 * browser has zero network interfaces, so a captive Wi-Fi or a dropped
 * Supabase connection can still fail while this returns `true`. Use it
 * as a UX signal, not as an authoritative reachability check; the real
 * source of truth is a failed fetch.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
