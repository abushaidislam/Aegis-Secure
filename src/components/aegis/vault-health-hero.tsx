import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, ChevronRight, Copy, Heart, Image as ImageIcon, Lock } from "lucide-react";

import { BORDER, CHARCOAL, CREAM_SOFT, DANGER, MUTED, soft } from "@/components/aegis/chrome";
import { getVaultKey, useVaultUnlocked } from "@/lib/vault-session";
import { listAccounts } from "@/lib/vault-accounts";
import { computeVaultHealth, type VaultHealthReport } from "@/lib/vault-health";
import { HealthSheet } from "@/components/aegis/vault-health-section";

/**
 * Vault health hero — polished circular score chart shown at the top of the
 * Security tab. Tapping opens the existing HealthSheet for the full breakdown.
 * All scanning happens on-device against already-decrypted accounts.
 */

function scoreTone(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Healthy", color: "#2f8f5b" };
  if (score >= 60) return { label: "Fair", color: "#c9860b" };
  return { label: "Needs attention", color: DANGER };
}

const RADIUS = 46;
const STROKE = 8;
const CIRC = 2 * Math.PI * RADIUS;

export function VaultHealthHero() {
  const unlocked = useVaultUnlocked();
  const [report, setReport] = useState<VaultHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const scan = async () => {
    const dek = getVaultKey();
    if (!dek) {
      setErrorMsg("Vault is locked. Unlock to scan.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const accounts = await listAccounts(dek);
      const next = await computeVaultHealth(accounts);
      setReport(next);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not scan the vault.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!unlocked) return;
    if (report || loading) return;
    void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const tone = useMemo(
    () => (report ? scoreTone(report.score) : scoreTone(100)),
    [report],
  );
  const score = report?.score ?? 0;
  const dashOffset = CIRC - (Math.max(0, Math.min(100, score)) / 100) * CIRC;

  const dupCount = report?.duplicates.length ?? 0;
  const weakCount = report?.weakFavorites.length ?? 0;
  const missCount = report?.missingIcons.length ?? 0;
  const findingCount = dupCount + weakCount + missCount;

  const subtitle = !unlocked
    ? "Unlock the vault to see your score"
    : loading
      ? "Scanning your vault…"
      : errorMsg
        ? errorMsg
        : findingCount === 0
          ? "All clear — nothing needs your attention"
          : `${findingCount} ${findingCount === 1 ? "finding" : "findings"} to review`;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setSheetOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={soft}
        whileTap={{ scale: 0.995 }}
        aria-label={
          report
            ? `Vault health score ${report.score} of 100, ${tone.label}. ${findingCount} findings. Tap to view details.`
            : "Open vault health"
        }
        className="group relative w-full overflow-hidden rounded-[20px] px-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2"
        style={{
          background: CREAM_SOFT,
          border: `1px solid ${BORDER}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 24px -18px rgba(0,0,0,0.35)",
        }}
      >
        {/* soft gradient wash keyed to score tone */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 80% at 100% 0%, ${tone.color}22 0%, transparent 55%)`,
          }}
        />

        <div className="relative flex items-center gap-4">
          {/* Ring chart */}
          <div className="relative h-[112px] w-[112px] shrink-0">
            <svg
              viewBox="0 0 120 120"
              className="h-full w-full -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke="rgb(var(--aegis-ink-rgb) / 0.09)"
                strokeWidth={STROKE}
              />
              <motion.circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke={tone.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                initial={{ strokeDashoffset: CIRC }}
                animate={{ strokeDashoffset: loading || !report ? CIRC : dashOffset }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {!unlocked ? (
                <Lock className="h-5 w-5" strokeWidth={1.8} style={{ color: MUTED }} />
              ) : loading || !report ? (
                <div
                  className="h-6 w-10 animate-pulse rounded-md"
                  style={{ background: "rgb(var(--aegis-ink-rgb) / 0.08)" }}
                />
              ) : (
                <>
                  <span
                    className="leading-none"
                    style={{
                      color: CHARCOAL,
                      fontFamily: "'Playfair Display', serif",
                      fontWeight: 600,
                      fontSize: 34,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {report.score}
                  </span>
                  <span
                    className="mt-0.5 text-[9.5px] uppercase"
                    style={{ color: MUTED, letterSpacing: "0.16em", fontWeight: 600 }}
                  >
                    / 100
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: MUTED }} />
              <span
                className="text-[10.5px] uppercase"
                style={{ color: MUTED, letterSpacing: "0.16em", fontWeight: 600 }}
              >
                Vault health
              </span>
            </div>
            <div
              className="mt-1 text-[19px]"
              style={{
                color: CHARCOAL,
                fontFamily: "'Playfair Display', serif",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              {!unlocked || !report ? "\u2014" : tone.label}
            </div>
            <div className="mt-1 line-clamp-2 text-[12.5px]" style={{ color: MUTED }}>
              {subtitle}
            </div>

            {/* Finding chips */}
            {report && findingCount > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {dupCount > 0 && (
                  <Chip icon={<Copy className="h-3 w-3" strokeWidth={2} />} tone="warn">
                    {dupCount} duplicate{dupCount === 1 ? "" : "s"}
                  </Chip>
                )}
                {weakCount > 0 && (
                  <Chip icon={<Heart className="h-3 w-3" strokeWidth={2} />} tone="warn">
                    {weakCount} weak fav{weakCount === 1 ? "" : "s"}
                  </Chip>
                )}
                {missCount > 0 && (
                  <Chip icon={<ImageIcon className="h-3 w-3" strokeWidth={2} />} tone="info">
                    {missCount} missing icon{missCount === 1 ? "" : "s"}
                  </Chip>
                )}
              </div>
            )}
          </div>

          <ChevronRight
            className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.8}
            style={{ color: MUTED }}
          />
        </div>
      </motion.button>

      <AnimatePresence>
        {sheetOpen && (
          <HealthSheet
            report={report}
            loading={loading}
            errorMsg={errorMsg}
            unlocked={unlocked}
            onRescan={() => void scan()}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Chip({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "warn" | "info";
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px]"
      style={{
        background: "rgb(var(--aegis-ink-rgb) / 0.05)",
        border: `1px solid ${BORDER}`,
        color: tone === "warn" ? DANGER : MUTED,
        letterSpacing: "0.06em",
        fontWeight: 600,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
