import { useMemo, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, Shield } from "lucide-react";
import {
  BORDER,
  CHARCOAL,
  CREAM,
  CREAM_SOFT,
  DANGER,
  MUTED,
  soft,
  spring,
} from "@/components/aegis/chrome";

/* -------------------------------------------------------------------------- */
/*  Shared ink-hero + cream-sheet layout for auth / reset / callback flows.   */
/*  Mobile-first, safe-area aware, and identical visual language across all   */
/*  entry screens.                                                            */
/* -------------------------------------------------------------------------- */

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  d: number;
}

function useStars(count: number): Star[] {
  return useMemo(() => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      r: rand() * 1.2 + 0.3,
      o: rand() * 0.5 + 0.25,
      d: rand() * 3 + 2,
    }));
  }, [count]);
}

export function Starfield() {
  const reduce = useReducedMotion();
  const stars = useStars(70);
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(100% 80% at 88% 0%, rgba(210,169,96,0.20), transparent 55%), radial-gradient(85% 80% at 8% 8%, rgba(255,239,208,0.10), transparent 58%), linear-gradient(180deg, #1c1c1c 0%, #25221d 58%, #312a20 100%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,248,235,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,248,235,0.045) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(120% 90% at 70% 10%, black 30%, transparent 80%)",
        }}
      />
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            opacity: s.o,
            boxShadow: s.r > 1 ? "0 0 4px rgba(255,255,255,0.6)" : undefined,
          }}
          animate={reduce ? undefined : { opacity: [s.o, s.o * 0.35, s.o] }}
          transition={{ duration: s.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function BrandRow() {
  return (
    <div className="flex items-center gap-2 text-white">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[9px]"
        style={{
          background: "linear-gradient(140deg, #e4bd68 0%, #b9842f 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.32), 0 6px 16px -6px rgba(201,154,43,0.45)",
        }}
      >
        <Shield className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Aegis</span>
    </div>
  );
}

/**
 * Full-screen dark-hero + cream-sheet layout.
 * - Mobile-first: safe-area aware, no horizontal scroll, sheet scrolls if needed.
 * - `heroTitle` swaps with a soft crossfade when it changes.
 */
export function StarfieldHeroLayout({
  heroKey,
  heroTitle,
  heroSubtitle,
  heroAccessory,
  children,
  heroMinVh = 34,
}: {
  heroKey?: string;
  heroTitle: ReactNode;
  heroSubtitle?: ReactNode;
  heroAccessory?: ReactNode;
  children: ReactNode;
  heroMinVh?: number;
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#1c1c1c" }}
    >
      {/* Hero — shrinks aggressively on short viewports (landscape / on-screen keyboard) */}
      <div
        className="relative shrink-0"
        style={{
          minHeight: `clamp(170px, ${heroMinVh}dvh, 320px)`,
          maxHeight: "45dvh",
        }}
      >
        <Starfield />
        {heroAccessory && (
          <div className="pointer-events-none absolute right-[-8px] top-0 z-[5] h-full w-[46%] max-w-[240px]">
            {/* soft warm halo behind the illustration to anchor the composition */}
            <div
              aria-hidden
              className="absolute right-[8%] top-1/2 h-[62%] w-[78%] -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(213,169,91,0.28), rgba(213,169,91,0) 70%)",
                filter: "blur(6px)",
              }}
            />
            <div className="relative h-full w-full">{heroAccessory}</div>
          </div>
        )}
        <div className="relative z-10 flex h-full flex-col px-5 pt-[max(20px,env(safe-area-inset-top))] pb-6 sm:px-6 sm:pb-7">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={soft}
          >
            <BrandRow />
          </motion.div>

          <div className="mt-auto flex flex-col gap-2.5 pr-[42%] sm:gap-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={(heroKey ?? "") + "-eyebrow"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={soft}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden
                  className="h-[1px] w-6"
                  style={{ background: "rgba(255,255,255,0.35)" }}
                />
                <span
                  className="text-white/70"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                  }}
                >
                  Secure access
                </span>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={(heroKey ?? "") + "-title"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={soft}
                className="text-white"
                style={{
                  fontSize: "clamp(32px, 9vw, 44px)",
                  lineHeight: 1.02,
                  fontWeight: 600,
                  letterSpacing: "-0.028em",
                  textWrap: "balance" as never,
                }}
              >
                {heroTitle}
              </motion.h1>
            </AnimatePresence>
            {heroSubtitle && (
              <motion.p
                key={(heroKey ?? "") + "-sub"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 0.78, y: 0 }}
                transition={{ ...soft, delay: 0.05 }}
                className="max-w-[32ch] text-[13.5px] leading-[1.55] text-white"
                style={{ letterSpacing: "-0.005em" }}
              >
                {heroSubtitle}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Cream sheet */}
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...soft, delay: 0.05 }}
        className="relative -mt-6 flex flex-1 flex-col overflow-y-auto rounded-t-[28px] px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6"
        style={{
          background: CREAM,
          boxShadow: "0 -14px 40px -20px rgba(0,0,0,0.35)",
          color: CHARCOAL,
          WebkitOverflowScrolling: "touch" as never,
        }}
      >
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-4 sm:gap-5">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared sheet primitives (used across auth, reset, callback screens)       */
/* -------------------------------------------------------------------------- */

export function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[12.5px] font-medium"
        style={{ color: MUTED, letterSpacing: "-0.005em" }}
      >
        {label}
      </span>
      <div
        className="flex h-[48px] items-center gap-2.5 rounded-[12px] px-3.5"
        style={{
          background: CREAM_SOFT,
          border: `1px solid ${BORDER}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function BlueButton({
  children,
  type = "button",
  loading,
  disabled,
  onClick,
  testId,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <motion.button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={disabled || loading ? undefined : { scale: 0.985, opacity: 0.95 }}
      transition={spring}
      className="relative flex h-[50px] w-full items-center justify-center rounded-[12px] text-[15px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
      style={{
        background: "linear-gradient(180deg, #2b2926 0%, #1c1c1c 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.16), 0 12px 24px -12px rgba(28,28,28,0.58), 0 2px 4px rgba(28,28,28,0.22)",
        letterSpacing: "-0.005em",
        ["--tw-ring-color" as string]: "rgba(28,28,28,0.55)",
        ["--tw-ring-offset-color" as string]: CREAM,
      }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </motion.button>
  );
}

export function InlineNotice({
  kind,
  children,
}: {
  kind: "error" | "info";
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={soft}
      className="rounded-[10px] px-3 py-2 text-[12.5px] leading-snug"
      style={{
        background:
          kind === "error"
            ? "rgb(var(--aegis-danger-rgb) / 0.08)"
            : "rgb(var(--aegis-ink-rgb) / 0.05)",
        color: kind === "error" ? DANGER : CHARCOAL,
        border: `1px solid ${
          kind === "error" ? "rgb(var(--aegis-danger-rgb) / 0.15)" : BORDER
        }`,
      }}
    >
      {children}
    </motion.div>
  );
}
