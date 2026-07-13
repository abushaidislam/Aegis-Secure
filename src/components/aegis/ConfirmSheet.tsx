// Design-system-consistent confirmation modal. Mirrors the look of
// ExportPassphraseSheet: cream card, blurred ink backdrop, spring-in.
// Replaces the native `window.confirm` for high-stakes decisions where
// the tone/context needs to match the Aegis chrome.

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import {
  BORDER,
  CHARCOAL,
  CREAM_SOFT,
  DANGER,
  GhostButton,
  MUTED,
  Notice,
  PrimaryButton,
  soft,
} from "@/components/aegis/chrome";
import { typeSheetTitleLg, typeSubLabel } from "@/components/aegis/typography";

export function ConfirmSheet({
  open,
  title,
  description,
  bullets,
  noticeKind,
  noticeText,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  icon: Icon,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  bullets?: string[];
  noticeKind?: "error" | "info";
  noticeText?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.button
        aria-label={cancelLabel}
        onClick={loading ? undefined : onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: "rgb(var(--aegis-ink-rgb) / 0.35)", backdropFilter: "blur(4px)" }}
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={soft}
        className="relative z-10 mx-auto w-full max-w-[440px] rounded-t-[22px] px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 sm:rounded-[22px]"
        style={{
          background: CREAM_SOFT,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 -12px 40px -12px rgba(0,0,0,0.25)",
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
                style={{
                  background: destructive
                    ? "rgb(var(--aegis-danger-rgb, 200 60 60) / 0.10)"
                    : "rgb(var(--aegis-ink-rgb) / 0.06)",
                  color: destructive ? DANGER : CHARCOAL,
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </div>
            ) : null}
            <div className="min-w-0">
              <div style={typeSheetTitleLg}>{title}</div>
              {description ? (
                <div
                  className="mt-1"
                  style={{ ...typeSubLabel, fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}
                >
                  {description}
                </div>
              ) : null}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={loading ? undefined : onCancel}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full"
            style={{ background: "rgb(var(--aegis-ink-rgb) / 0.06)", color: CHARCOAL }}
            aria-label={cancelLabel}
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </motion.button>
        </div>

        {bullets && bullets.length > 0 ? (
          <ul
            className="mb-3 space-y-1.5 rounded-[12px] px-3.5 py-3"
            style={{
              background: "rgb(var(--aegis-ink-rgb) / 0.04)",
              border: `1px solid ${BORDER}`,
            }}
          >
            {bullets.map((b, i) => (
              <li
                key={i}
                className="flex gap-2 text-[12.5px]"
                style={{ color: CHARCOAL, lineHeight: 1.5 }}
              >
                <span
                  className="mt-[7px] h-1 w-1 flex-none rounded-full"
                  style={{ background: destructive ? DANGER : CHARCOAL, opacity: 0.6 }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {noticeText ? (
          <div className="mb-3">
            <Notice kind={noticeKind ?? "info"}>{noticeText}</Notice>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
          <div className="sm:flex-1">
            <GhostButton onClick={loading ? undefined : onCancel} disabled={loading}>
              {cancelLabel}
            </GhostButton>
          </div>
          <div className="sm:flex-1">
            <PrimaryButton onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </PrimaryButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
