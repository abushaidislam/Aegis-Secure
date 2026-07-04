import { useState, useEffect, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Shield,
  Zap,
  Lock,
  RefreshCw,
  QrCode,
  Upload,
  KeyRound,
  CloudUpload,
  Bell,
  Fingerprint,
  Check,
  ArrowRight,
  Sparkles,
  ChevronLeft,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Motion primitives                                                          */
/* -------------------------------------------------------------------------- */

const spring = { type: "spring" as const, stiffness: 280, damping: 28, mass: 0.8 };
const softSpring = { type: "spring" as const, stiffness: 220, damping: 30, mass: 0.9 };

const pageVariants = {
  initial: { opacity: 0, y: 16, filter: "blur(12px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -16, filter: "blur(12px)" },
};

const rise = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

/* -------------------------------------------------------------------------- */
/*  Reusable UI                                                                */
/* -------------------------------------------------------------------------- */

function PrimaryButton({
  children,
  onClick,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-[18px] bg-primary text-[17px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_rgba(37,99,235,0.55)] transition-shadow duration-300 hover:shadow-[0_14px_34px_-12px_rgba(37,99,235,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 to-transparent opacity-80" />
      <span className="relative flex items-center gap-2">
        {children}
        {icon ?? <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-0.5" />}
      </span>
    </motion.button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className="flex h-14 w-full items-center justify-center rounded-[18px] bg-transparent text-[16px] font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {children}
    </motion.button>
  );
}

function ProgressDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => {
        const active = i === current;
        return (
          <motion.span
            key={i}
            layout
            transition={spring}
            className="h-1.5 rounded-full"
            style={{
              width: active ? 22 : 6,
              backgroundColor: active
                ? "var(--color-primary)"
                : "color-mix(in oklab, var(--color-foreground) 14%, transparent)",
            }}
          />
        );
      })}
    </div>
  );
}

function StepShell({
  step,
  total,
  onBack,
  children,
}: {
  step: number;
  total: number;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-4">
        <div className="w-10">
          {onBack && step > 0 ? (
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={spring}
              onClick={onBack}
              aria-label="Back"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
          ) : null}
        </div>
        <ProgressDots count={total} current={step} />
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ ...softSpring, filter: { duration: 0.35 } }}
            className="flex flex-1 flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Headline({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-8 text-center">
      <motion.h1
        variants={rise}
        initial="initial"
        animate="animate"
        transition={{ ...spring, delay: 0.05 }}
        className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[36px]"
      >
        {title}
      </motion.h1>
      {subtitle ? (
        <motion.p
          variants={rise}
          initial="initial"
          animate="animate"
          transition={{ ...spring, delay: 0.12 }}
          className="mx-auto mt-3 max-w-sm text-[17px] leading-[1.45] text-muted-foreground"
        >
          {subtitle}
        </motion.p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screens                                                                    */
/* -------------------------------------------------------------------------- */

function BackgroundGlow() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute left-1/2 top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-primary) 22%, transparent), transparent 70%)",
          filter: "blur(30px)",
        }}
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function FloatingShield() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      {/* soft outer ring */}
      <motion.div
        aria-hidden
        className="absolute h-56 w-56 rounded-full border border-primary/10"
        animate={reduce ? undefined : { scale: [1, 1.05, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute h-72 w-72 rounded-full border border-primary/[0.06]"
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* particles */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 110;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.span
            key={i}
            aria-hidden
            className="absolute h-1.5 w-1.5 rounded-full bg-primary/60"
            style={{ x, y }}
            animate={
              reduce
                ? undefined
                : {
                    opacity: [0.2, 0.9, 0.2],
                    scale: [0.8, 1.3, 0.8],
                  }
            }
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.25,
            }}
          />
        );
      })}

      {/* shield card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        className="relative flex h-32 w-32 items-center justify-center rounded-[32px] bg-card shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25),0_2px_6px_-2px_rgba(15,23,42,0.08)]"
      >
        <motion.div
          animate={reduce ? undefined : { rotate: [0, 6, -6, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          <Shield
            className="h-14 w-14"
            strokeWidth={1.6}
            style={{ color: "var(--color-primary)" }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

function ScreenHero({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="relative flex flex-1 items-center justify-center px-6">
        <BackgroundGlow />
        <div className="relative flex flex-col items-center gap-14">
          <FloatingShield />
          <Headline
            title="Security that simply works."
            subtitle="Protect every account with secure one-time codes."
          />
        </div>
      </div>
      <div className="px-6 pb-8 pt-4">
        <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ ...spring, delay }}
      className="flex items-center gap-4 rounded-[28px] bg-card p-5 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.2),0_1px_3px_-1px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.04]"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.08]">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
        <p className="mt-0.5 text-[14.5px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}

function ScreenWhy({ onNext }: { onNext: () => void }) {
  const items = [
    { icon: <Zap className="h-6 w-6" style={{ color: "var(--color-primary)" }} strokeWidth={1.8} />, title: "Fast", description: "Generate codes instantly." },
    { icon: <Lock className="h-6 w-6" style={{ color: "var(--color-primary)" }} strokeWidth={1.8} />, title: "Private", description: "Everything stays on your device." },
    { icon: <RefreshCw className="h-6 w-6" style={{ color: "var(--color-primary)" }} strokeWidth={1.8} />, title: "Reliable", description: "Never miss an authentication code." },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pt-8">
        <Headline title="Why Aegis." subtitle="Designed for calm, everyday security." />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 px-6 py-10">
        {items.map((it, i) => (
          <FeatureCard key={it.title} {...it} delay={0.15 + i * 0.12} />
        ))}
      </div>
      <div className="px-6 pb-8">
        <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
      </div>
    </div>
  );
}

function PhoneMockup() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto flex items-center justify-center">
      <motion.div
        aria-hidden
        className="absolute h-[340px] w-[240px] rounded-[52px]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 70%)",
          filter: "blur(28px)",
        }}
        animate={reduce ? undefined : { opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        className="relative h-[300px] w-[168px] rounded-[38px] bg-[#0F172A] p-2 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.45),0_2px_6px_-2px_rgba(15,23,42,0.15)]"
      >
        <div className="relative h-full w-full overflow-hidden rounded-[30px] bg-card">
          {/* notch */}
          <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-[#0F172A]" />
          {/* QR area */}
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl bg-background ring-1 ring-black/[0.05]">
              <QrCode className="h-20 w-20 text-foreground/85" strokeWidth={1.4} />
              {/* scan line */}
              <motion.div
                aria-hidden
                className="absolute inset-x-3 h-[2px] rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, var(--color-primary), transparent)",
                  boxShadow: "0 0 12px color-mix(in oklab, var(--color-primary) 60%, transparent)",
                }}
                animate={reduce ? undefined : { top: ["12%", "88%", "12%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* corners */}
              {[
                "top-1 left-1 border-l-2 border-t-2",
                "top-1 right-1 border-r-2 border-t-2",
                "bottom-1 left-1 border-l-2 border-b-2",
                "bottom-1 right-1 border-r-2 border-b-2",
              ].map((c) => (
                <span
                  key={c}
                  className={`absolute h-4 w-4 rounded-[4px] ${c}`}
                  style={{ borderColor: "var(--color-primary)" }}
                />
              ))}
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Align QR to scan</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  onClick,
  delay,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[22px] bg-card px-4 py-3.5 text-left shadow-[0_6px_20px_-16px_rgba(15,23,42,0.2)] ring-1 ring-black/[0.05] transition-colors hover:bg-black/[0.02]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08]">
        {icon}
      </div>
      <span className="flex-1 text-[15.5px] font-medium text-foreground">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </motion.button>
  );
}

function ScreenImport({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pt-4">
        <PhoneMockup />
        <Headline
          title="Import in seconds."
          subtitle="Bring existing accounts into Aegis your way."
        />
        <div className="flex w-full max-w-sm flex-col gap-2.5">
          <OptionRow
            icon={<QrCode className="h-5 w-5" style={{ color: "var(--color-primary)" }} strokeWidth={1.8} />}
            label="Scan QR"
            delay={0.15}
            onClick={onNext}
          />
          <OptionRow
            icon={<Upload className="h-5 w-5" style={{ color: "var(--color-primary)" }} strokeWidth={1.8} />}
            label="Import Backup"
            delay={0.22}
            onClick={onNext}
          />
          <OptionRow
            icon={<KeyRound className="h-5 w-5" style={{ color: "var(--color-primary)" }} strokeWidth={1.8} />}
            label="Manual Setup"
            delay={0.29}
            onClick={onNext}
          />
        </div>
      </div>
      <div className="px-6 pb-8 pt-6">
        <SecondaryButton onClick={onNext}>Skip for now</SecondaryButton>
      </div>
    </div>
  );
}

function NativeSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-8 w-[52px] rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{
        backgroundColor: checked
          ? "var(--color-success)"
          : "color-mix(in oklab, var(--color-foreground) 12%, transparent)",
      }}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-0.5 h-7 w-7 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

function CloudVault() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        aria-hidden
        className="absolute h-56 w-56 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 70%)",
          filter: "blur(24px)",
        }}
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        className="relative flex h-32 w-32 items-center justify-center rounded-[32px] bg-card shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)]"
      >
        <CloudUpload className="h-14 w-14" strokeWidth={1.5} style={{ color: "var(--color-primary)" }} />
        <motion.div
          aria-hidden
          className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-[0_6px_20px_-8px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.05]"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...spring, delay: 0.35 }}
        >
          <Lock className="h-4 w-4" strokeWidth={2} style={{ color: "var(--color-success)" }} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function ScreenBackup({ onNext }: { onNext: () => void }) {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
        <CloudVault />
        <Headline
          title="Encrypted backup."
          subtitle="Your vault is end-to-end encrypted. Only you can unlock it."
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
          className="flex w-full max-w-sm items-center justify-between rounded-[22px] bg-card px-5 py-4 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.2)] ring-1 ring-black/[0.05]"
        >
          <div className="min-w-0 pr-4">
            <p className="text-[15.5px] font-semibold text-foreground">Automatic Backup</p>
            <p className="text-[13px] text-muted-foreground">Keep your accounts safely synced.</p>
          </div>
          <NativeSwitch checked={enabled} onChange={setEnabled} />
        </motion.div>
      </div>
      <div className="px-6 pb-8 pt-4">
        <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
      </div>
    </div>
  );
}

function BellAnimation() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        aria-hidden
        className="absolute h-56 w-56 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 70%)",
          filter: "blur(24px)",
        }}
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        className="relative flex h-32 w-32 items-center justify-center rounded-[32px] bg-card shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)]"
      >
        <motion.div
          animate={reduce ? undefined : { rotate: [0, -12, 12, -8, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
          style={{ transformOrigin: "50% 20%" }}
        >
          <Bell className="h-14 w-14" strokeWidth={1.5} style={{ color: "var(--color-primary)" }} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function ScreenNotifications({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
        <BellAnimation />
        <Headline
          title="Stay in the loop."
          subtitle="Get gentle reminders for backups and important security updates."
        />
      </div>
      <div className="flex flex-col gap-2 px-6 pb-8">
        <PrimaryButton onClick={onNext}>Allow Notifications</PrimaryButton>
        <SecondaryButton onClick={onNext}>Maybe Later</SecondaryButton>
      </div>
    </div>
  );
}

function FingerprintAnimation() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute rounded-full border border-primary/25"
          style={{ width: 160 + i * 40, height: 160 + i * 40 }}
          animate={
            reduce
              ? undefined
              : { scale: [0.9, 1.05, 0.9], opacity: [0.15, 0.6, 0.15] }
          }
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
        />
      ))}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        className="relative flex h-32 w-32 items-center justify-center rounded-[32px] bg-card shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)]"
      >
        <Fingerprint className="h-14 w-14" strokeWidth={1.5} style={{ color: "var(--color-primary)" }} />
      </motion.div>
    </div>
  );
}

function ScreenBiometrics({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-12 px-6">
        <FingerprintAnimation />
        <Headline
          title="Unlock with a touch."
          subtitle="Use Face ID or your fingerprint to open Aegis instantly."
        />
      </div>
      <div className="flex flex-col gap-2 px-6 pb-8">
        <PrimaryButton onClick={onNext}>Enable Biometrics</PrimaryButton>
        <SecondaryButton onClick={onNext}>Not now</SecondaryButton>
      </div>
    </div>
  );
}

function Confetti() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 300,
        delay: Math.random() * 0.4,
        rot: Math.random() * 180,
        color:
          i % 3 === 0
            ? "var(--color-primary)"
            : i % 3 === 1
              ? "var(--color-success)"
              : "color-mix(in oklab, var(--color-primary) 60%, white)",
      })),
    [],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/3 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: p.color }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            x: p.x,
            y: 260 + Math.random() * 120,
            scale: [0, 1, 0.6],
            rotate: p.rot,
          }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function BigShield() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        aria-hidden
        className="absolute h-64 w-64 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-success) 22%, transparent), transparent 70%)",
          filter: "blur(30px)",
        }}
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        className="relative flex h-36 w-36 items-center justify-center rounded-[36px] bg-card shadow-[0_28px_70px_-24px_rgba(15,23,42,0.28)]"
      >
        <Shield className="h-16 w-16" strokeWidth={1.5} style={{ color: "var(--color-primary)" }} />
        <motion.div
          aria-hidden
          className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-[0_8px_24px_-8px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.05]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring, delay: 0.35 }}
        >
          <Check className="h-5 w-5" strokeWidth={2.4} style={{ color: "var(--color-success)" }} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function ScreenFinal({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <Confetti />
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
        <BigShield />
        <Headline title="You're protected." subtitle="Your authenticator is ready." />
      </div>
      <div className="flex flex-col gap-2 px-6 pb-8">
        <PrimaryButton onClick={onRestart} icon={<Sparkles className="h-[18px] w-[18px]" />}>
          Get Started
        </PrimaryButton>
        <SecondaryButton onClick={onRestart}>Explore Settings</SecondaryButton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

const screens = [
  "hero",
  "why",
  "import",
  "backup",
  "notifications",
  "biometrics",
  "final",
] as const;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const total = screens.length;

  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const restart = () => setStep(0);

  // preload feel: nothing async, but ensure smooth focus
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  }, [step]);

  const current = screens[step];

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-background font-sans text-foreground antialiased">
      <StepShell step={step} total={total} onBack={back}>
        {current === "hero" && <ScreenHero onNext={next} />}
        {current === "why" && <ScreenWhy onNext={next} />}
        {current === "import" && <ScreenImport onNext={next} />}
        {current === "backup" && <ScreenBackup onNext={next} />}
        {current === "notifications" && <ScreenNotifications onNext={next} />}
        {current === "biometrics" && <ScreenBiometrics onNext={next} />}
        {current === "final" && <ScreenFinal onRestart={restart} />}
      </StepShell>
    </main>
  );
}
