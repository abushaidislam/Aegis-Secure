import { useState } from "react";
import { motion } from "framer-motion";
import { X, Send, Bug, Lightbulb, HelpCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { BORDER, CHARCOAL, CREAM, CREAM_SOFT, MUTED } from "./chrome";
import { submitFeedback, type FeedbackCategory } from "@/lib/feedback";

const CATEGORIES: Array<{
  id: FeedbackCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "bug", label: "Bug", icon: <Bug className="h-4 w-4" strokeWidth={1.8} /> },
  { id: "idea", label: "Idea", icon: <Lightbulb className="h-4 w-4" strokeWidth={1.8} /> },
  { id: "question", label: "Question", icon: <HelpCircle className="h-4 w-4" strokeWidth={1.8} /> },
  { id: "other", label: "Other", icon: <MessageSquare className="h-4 w-4" strokeWidth={1.8} /> },
];

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      await submitFeedback({ category, message });
      toast.success("Thanks — we got your report.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgb(var(--aegis-ink-rgb) / 0.35)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[24px] p-5"
        style={{
          background: CREAM,
          borderTop: `1px solid ${BORDER}`,
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-[17px]"
            style={{
              color: CHARCOAL,
              fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.015em",
            }}
          >
            Report a problem
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: MUTED }}
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <p className="mb-4 text-[12.5px] leading-[1.5]" style={{ color: MUTED }}>
          We never see your codes or passphrase. Your message, plus the current
          screen path and browser, is sent to the Aegis team.
        </p>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => {
            const active = c.id === category;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className="flex flex-col items-center gap-1 rounded-[12px] py-3 text-[11px]"
                style={{
                  background: active ? "rgb(var(--aegis-ink-rgb) / 0.06)" : CREAM_SOFT,
                  border: `1px solid ${active ? "rgb(var(--aegis-ink-rgb) / 0.3)" : BORDER}`,
                  color: active ? CHARCOAL : MUTED,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "0.02em",
                }}
              >
                {c.icon}
                {c.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="What went wrong, or what would you like to see?"
          className="w-full resize-none rounded-[14px] p-3 text-[14px] outline-none"
          style={{
            background: CREAM_SOFT,
            border: `1px solid ${BORDER}`,
            color: CHARCOAL,
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />
        <div className="mt-1 text-right text-[11px]" style={{ color: MUTED }}>
          {message.length}/4000
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={busy || !message.trim()}
          onClick={submit}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] disabled:opacity-50"
          style={{
            background: CHARCOAL,
            color: CREAM,
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          <Send className="h-4 w-4" strokeWidth={2} />
          {busy ? "Sending…" : "Send report"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
