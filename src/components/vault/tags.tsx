// Shared tag primitives for Phase 7.1: normalizer, chip color, chip, input.
// Tags are stored per-account in vault_accounts.tags (text[]). The DB caps
// the array at 20 entries; we enforce the same limit here to keep the
// insert trigger from ever surfacing a raw Postgres error to the user.

import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { BORDER, CHARCOAL, MUTED } from "@/components/aegis/chrome";

export const MAX_TAGS_PER_ACCOUNT = 20;
export const MAX_TAG_LENGTH = 24;

/** Canonicalise a raw tag string: lowercase, trim, collapse spaces to `-`. */
export function normalizeTag(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.slice(0, MAX_TAG_LENGTH);
}

/** Merge + dedupe a list of raw tags into normalised, ordered, capped form. */
export function normalizeTagList(input: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const t = normalizeTag(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS_PER_ACCOUNT) break;
  }
  return out;
}

function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function tagChipColors(tag: string): { bg: string; fg: string; ring: string } {
  const h = hueFor(tag);
  return {
    bg: `hsl(${h}, 46%, 93%)`,
    fg: `hsl(${h}, 42%, 26%)`,
    ring: `hsl(${h}, 42%, 78%)`,
  };
}

interface TagChipProps {
  tag: string;
  size?: "sm" | "md";
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  as?: "span" | "button";
}

export function TagChip({ tag, size = "sm", onRemove, onClick, active, as }: TagChipProps) {
  const { bg, fg, ring } = tagChipColors(tag);
  const sm = size === "sm";
  const paddingX = sm ? 7 : 10;
  const paddingY = sm ? 2 : 4;
  const fontSize = sm ? 10.5 : 12;
  const Comp = (as ?? (onClick ? "button" : "span")) as "span" | "button";

  const content = (
    <>
      <span className="truncate">{tag}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          aria-label={`Remove tag ${tag}`}
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(0,0,0,0.08)", color: fg }}
        >
          <X className="h-2.5 w-2.5" strokeWidth={2.6} />
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = {
    background: active ? fg : bg,
    color: active ? bg : fg,
    border: `1px solid ${active ? fg : ring}`,
    padding: `${paddingY}px ${paddingX}px`,
    fontSize,
    fontWeight: 600,
    letterSpacing: "0.005em",
    lineHeight: 1.15,
    maxWidth: 160,
  };

  if (Comp === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex shrink-0 items-center gap-1 rounded-full transition-colors"
        style={style}
      >
        {content}
      </button>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full" style={style}>
      {content}
    </span>
  );
}

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

/** Chip-list input. Enter / comma commits, backspace on empty removes last. */
export function TagInput({ value, onChange, placeholder, suggestions }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const commit = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) {
      setDraft("");
      return;
    }
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    if (value.length >= MAX_TAGS_PER_ACCOUNT) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (draft.trim().length === 0) return;
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft.length === 0 && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const suggestionPool = (suggestions ?? [])
    .filter((s) => !value.includes(s))
    .filter((s) => (draft ? s.includes(normalizeTag(draft)) : true))
    .slice(0, 6);

  const atLimit = value.length >= MAX_TAGS_PER_ACCOUNT;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-[12px] px-2.5 py-2"
        style={{
          background: "#fff",
          border: `1px solid ${focused ? "rgba(28,28,28,0.35)" : BORDER}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
          transition: "border-color 0.15s ease",
        }}
      >
        {value.map((t) => (
          <TagChip key={t} tag={t} onRemove={() => remove(t)} size="sm" />
        ))}
        {!atLimit && (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              if (draft.trim()) commit(draft);
            }}
            placeholder={value.length === 0 ? (placeholder ?? "Add tags…") : ""}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-[80px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-[color:rgba(95,95,93,0.6)]"
            style={{ color: CHARCOAL }}
          />
        )}
      </div>
      {atLimit && (
        <span className="px-1 text-[11px]" style={{ color: MUTED }}>
          {MAX_TAGS_PER_ACCOUNT} tag limit reached.
        </span>
      )}
      {suggestionPool.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {suggestionPool.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px]"
              style={{
                background: "rgba(28,28,28,0.05)",
                color: MUTED,
                border: `1px dashed ${BORDER}`,
                fontWeight: 500,
              }}
            >
              <Plus className="h-2.5 w-2.5" strokeWidth={2.4} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
