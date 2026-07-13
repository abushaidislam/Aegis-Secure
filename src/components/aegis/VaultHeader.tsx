import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { BORDER, CHARCOAL, CREAM_SOFT, MUTED, soft } from "./chrome";

/**
 * Vault page header — Android-native "expressive" surface inspired by the
 * Material 3 Expressive language used in Google Wallet / the new Google
 * Authenticator: a floating glass strip with a brand chip and trailing
 * actions, a large weighted title, and a live sync-status pill sitting
 * inline with the counter.
 *
 * Kept API-close to LargeTitle so the vault page can swap it in without
 * restructuring surrounding notices.
 */
export function VaultHeader({
  title,
  count,
  countLabel,
  emptyLabel,
  online = true,
  syncing = false,
  trailing,
}: {
  title: string;
  count?: number;
  /** Label used when count > 0, e.g. "3 accounts synced". Should already be pluralised. */
  countLabel?: string;
  /** Fallback subtitle when count === 0 / undefined. */
  emptyLabel?: string;
  online?: boolean;
  syncing?: boolean;
  trailing?: ReactNode;
}) {
  const hasCount = typeof count === "number" && count > 0;

  const statusColor = !online
    ? "#c48a2b"
    : syncing
      ? "#3b82f6"
      : "#22a06b";
  const statusRing = !online
    ? "rgba(196,138,43,0.18)"
    : syncing
      ? "rgba(59,130,246,0.18)"
      : "rgba(34,160,107,0.18)";

  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={soft}
      className="sticky top-0 z-10 -mx-6 flex flex-col px-6 pt-[max(10px,env(safe-area-inset-top))] pb-3"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in oklab, var(--aegis-cream) 98%, transparent) 0%, color-mix(in oklab, var(--aegis-cream) 90%, transparent) 70%, color-mix(in oklab, var(--aegis-cream) 0%, transparent) 100%)",
        backdropFilter: "blur(20px) saturate(1.2)",
        WebkitBackdropFilter: "blur(20px) saturate(1.2)",
      }}
    >
      {/* Single-row header: brand + title inline, status pill + trailing on the right */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: CHARCOAL,
              color: CREAM_SOFT,
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 10px -6px rgb(var(--aegis-ink-rgb) / 0.6)",
            }}
          >
            <Shield className="h-[13px] w-[13px]" strokeWidth={2.2} />
          </span>
          <motion.h1
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...soft, delay: 0.04 }}
            data-testid="page-large-title"
            className="truncate text-[22px] leading-[1.05]"
            style={{
              color: CHARCOAL,
              fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 660,
              letterSpacing: "-0.028em",
            }}
          >
            {title}
          </motion.h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...soft, delay: 0.08 }}
            className="flex items-center gap-1.5 rounded-full py-[4px] pl-[6px] pr-2 text-[11px]"
            style={{
              background: CREAM_SOFT,
              border: `1px solid ${BORDER}`,
              color: MUTED,
              fontWeight: 600,
              letterSpacing: "-0.003em",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
            }}
            title={hasCount ? countLabel ?? `${count} synced` : emptyLabel ?? "End-to-end encrypted"}
          >
            <span aria-hidden className="relative flex h-2 w-2 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: statusRing }}
              />
              <motion.span
                className="relative h-[7px] w-[7px] rounded-full"
                style={{ background: statusColor }}
                animate={
                  syncing
                    ? { scale: [1, 1.25, 1], opacity: [1, 0.7, 1] }
                    : { scale: 1, opacity: 1 }
                }
                transition={
                  syncing
                    ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.2 }
                }
              />
            </span>
            {hasCount ? String(count) : "E2E"}
          </motion.span>
          {trailing}
        </div>
      </div>
    </motion.header>
  );
}

