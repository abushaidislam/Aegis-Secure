// Real-User Monitoring — lightweight LCP/INP/CLS collector.
//
// Uses the browser's PerformanceObserver directly (no dependencies) and
// ships one telemetry row per page-visit to `client_errors`
// (route = `rum:<pathname>`) when the tab becomes hidden or the page is
// unloaded. Sampled to 10% by default so the table doesn't grow without
// bound.
//
// Values are Google's Core Web Vitals definitions:
//  • LCP — largest-contentful-paint entry, `renderTime || loadTime`, ms
//  • INP — max event-timing `duration` for interactions ≥ 40ms, ms
//  • CLS — sum of layout-shift entries excluding those with recent input
//
// Zero-knowledge safe: never touches vault or plaintext credentials.

import { supabase } from "@/integrations/supabase/client";

interface Metrics {
  lcp?: number;
  inp?: number;
  cls: number;
}

const SAMPLE_RATE = 0.1;

let initialized = false;

export function initRum(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!("PerformanceObserver" in window)) return;
  if (Math.random() > SAMPLE_RATE) return;
  initialized = true;

  const metrics: Metrics = { cls: 0 };

  // Largest Contentful Paint — take the last (largest) entry.
  safeObserve("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1] as PerformanceEntry & {
      renderTime?: number;
      loadTime?: number;
    };
    if (last) metrics.lcp = last.renderTime || last.loadTime || last.startTime;
  });

  // Interaction to Next Paint — track worst interaction duration ≥ 40ms.
  safeObserve(
    "event",
    (entries) => {
      for (const entry of entries) {
        const e = entry as PerformanceEntry & {
          interactionId?: number;
          duration: number;
        };
        if (!e.interactionId) continue;
        if (e.duration < 40) continue;
        if (!metrics.inp || e.duration > metrics.inp) metrics.inp = e.duration;
      }
    },
    { durationThreshold: 40 } as PerformanceObserverInit,
  );

  // Cumulative Layout Shift — sum shifts without recent user input.
  safeObserve("layout-shift", (entries) => {
    for (const entry of entries) {
      const e = entry as PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      };
      if (!e.hadRecentInput) metrics.cls += e.value;
    }
  });

  const flush = () => {
    void ship(metrics);
  };
  // `visibilitychange` is the recommended flush signal for web vitals.
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") flush();
    },
    { once: false },
  );
  window.addEventListener("pagehide", flush, { once: true });
}

function safeObserve(
  type: string,
  cb: (entries: PerformanceEntry[]) => void,
  extra?: PerformanceObserverInit,
): void {
  try {
    const po = new PerformanceObserver((list) => cb(list.getEntries()));
    po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
  } catch {
    // Some entry types aren't supported on every browser; ignore.
  }
}

let shipped = false;
async function ship(m: Metrics): Promise<void> {
  if (shipped) return;
  if (m.lcp === undefined && m.inp === undefined && m.cls === 0) return;
  shipped = true;
  const path = window.location.pathname;
  const summary = [
    `lcp=${m.lcp ? Math.round(m.lcp) : "n/a"}ms`,
    `inp=${m.inp ? Math.round(m.inp) : "n/a"}ms`,
    `cls=${m.cls.toFixed(3)}`,
    `viewport=${window.innerWidth}x${window.innerHeight}`,
  ].join(" · ");
  try {
    await supabase.from("client_errors").insert({
      message: summary,
      route: `rum:${path}`,
      user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch {
    // Telemetry is best-effort; never surface to user.
  }
}
