// Aegis vault typography tokens — single source of truth for the font
// size / weight / line-height / letter-spacing recipes we use across the
// vault feature. Every token pulls its color from the CSS variable set in
// styles.css so the type surface flips automatically with the active theme
// (light ⇄ dark). Never spread a token and then override the color with a
// hardcoded hex; always route color through a token from `chrome.tsx`.

import type { CSSProperties } from "react";
import { CHARCOAL, CREAM_SOFT, DANGER, MUTED } from "./chrome";

/* ---------------- font families ---------------- */

export const FONT_SANS = "var(--font-sans)";
export const FONT_MONO = "var(--font-mono)";
export const FONT_SERIF = "var(--font-serif)";

/* ---------------- typographic roles ---------------- */

/** Big top-of-page heading — e.g. "Scan a code", "Bring your codes with you". */
export const typeDisplay: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 26,
  lineHeight: 1.1,
  fontWeight: 600,
  letterSpacing: "-0.025em",
  color: CHARCOAL,
};

/** Serif variant for editorial / print-adjacent headings (recovery, sheets). */
export const typeDisplaySerif: CSSProperties = {
  fontFamily: FONT_SERIF,
  fontSize: 26,
  lineHeight: 1.15,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: CHARCOAL,
};

/** Bottom-sheet / modal title (Playfair) — smaller than a page display. */
export const typeSheetTitle: CSSProperties = {
  fontFamily: FONT_SERIF,
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: CHARCOAL,
};

/** Compact sheet title used inside confirm dialogs. */
export const typeSheetTitleSm: CSSProperties = {
  ...typeSheetTitle,
  fontSize: 16,
};

/** Larger sheet title (export passphrase, primary bottom sheets). */
export const typeSheetTitleLg: CSSProperties = {
  ...typeSheetTitle,
  fontSize: 18,
};

/** Primary card row title — account issuer name on a vault card. */
export const typeCardTitle: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.005em",
  color: CHARCOAL,
};

/** Secondary label under a title — account handle, sub-line, etc. */
export const typeSubLabel: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 11.5,
  lineHeight: 1.45,
  color: MUTED,
};

/** Body paragraph text used in headers and confirm bodies. */
export const typeBody: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 13.5,
  lineHeight: 1.55,
  color: MUTED,
};

/** Compact body / caption. */
export const typeBodySm: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 11.5,
  lineHeight: 1.5,
  color: MUTED,
};

/** Uppercase eyebrow / section label (JetBrains Mono). */
export const typeEyebrow: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: MUTED,
};

/** Primary OTP code display on the card row. */
export const typeCode: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 26,
  lineHeight: 1,
  fontWeight: 600,
  letterSpacing: "0.06em",
  fontFeatureSettings: "'tnum'",
  color: CHARCOAL,
};

/** Enlarged OTP code inside the details sheet. */
export const typeCodeLg: CSSProperties = {
  ...typeCode,
  fontSize: 32,
  letterSpacing: "0.08em",
};

/** Small "next code" preview beside the current code. */
export const typeCodeNext: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  fontFeatureSettings: "'tnum'",
  color: CHARCOAL,
};

/** Ring / countdown timer digit. */
export const typeTimer: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  fontWeight: 600,
  fontFeatureSettings: "'tnum'",
  color: CHARCOAL,
};

/** Meta-cell label (algorithm / digits / period label). */
export const typeMetaLabel: CSSProperties = {
  ...typeEyebrow,
  fontSize: 9.5,
  letterSpacing: "0.22em",
};

/** Meta-cell value (algorithm / digits / period value). */
export const typeMetaValue: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: "0.02em",
  fontFeatureSettings: "'tnum'",
  color: CHARCOAL,
};

/** Inline mono snippet inside body text (e.g. `otpauth://`, `.avf`). */
export const typeMonoInline: CSSProperties = {
  fontFamily: FONT_MONO,
};

/** Standard input field text. */
export const typeInput: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 14.5,
  color: CHARCOAL,
};

/** Small pill / badge label (counter, "+N more", "Copied"). */
export const typeBadge: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 10.5,
  fontWeight: 600,
  lineHeight: 1,
  color: CREAM_SOFT,
};

/** Primary button text. */
export const typeButton: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 15,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  color: CREAM_SOFT,
};

/** Ghost / secondary button text. */
export const typeButtonGhost: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.005em",
  color: CHARCOAL,
};

/** Destructive button label (dark red fill in light, warm red in dark). */
export const typeButtonDanger: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.005em",
  color: CREAM_SOFT,
};

/** Inline error / danger text. */
export const typeDanger: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: DANGER,
};

/** Compact segmented-tab label. */
export const typeSegLabel: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 12.5,
  letterSpacing: "-0.005em",
};
