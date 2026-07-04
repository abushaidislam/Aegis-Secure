# Mobile navigation for Aegis

Add a proper mobile navigation to every authenticated page, in the same warm-cream / motion-heavy language as the onboarding flow. A hamburger button opens a full-screen slide-in sheet with four destinations: **Vault**, **Security**, **Add**, **Profile**. The floating "+ Add account" pill stays as the primary shortcut but the sheet becomes the single source of truth for navigation.

## What the user sees

- Every locked screen (Vault, Add account, and the new Security / Profile pages) gets a small hamburger icon at the top-right of the brand bar. The lock icon and sign-out chips move into the sheet.
- Tapping it opens a full-height sheet that slides in from the right with the same cream backdrop, animated blobs, and grain used elsewhere.
- Four large nav rows, each with an IconChip, title, one-line description, and a chevron. The current route shows a filled charcoal chip and a small "Current" pill. Rows stagger in with the onboarding's `soft` spring.
- Bottom of the sheet: a subtle account block (avatar initials + email) with **Lock vault** and **Sign out** as ghost buttons.
- Tapping outside the sheet, pressing Escape, or tapping the close button dismisses it. Body scroll is locked while open.
- Routing between destinations closes the sheet before navigation so the transition feels intentional.

```text
┌──────────────────────────────┐
│ 🛡 Aegis                  ☰ │  ← brand bar with hamburger
│                              │
│  Your codes.                 │
│  ────────────                │
│  • account rows              │
│                              │
│          [ + Add account ]   │  ← floating pill stays
└──────────────────────────────┘

opens →

┌──────────────────────────────┐
│                          ✕   │
│  Menu                        │
│                              │
│  🔑  Vault          Current  │
│      Your one-time codes  ›  │
│  🛡  Security                │
│      Passphrase & lock    ›  │
│  ＋  Add account             │
│      Scan or enter manually› │
│  👤  Profile                 │
│      Name, avatar, email  ›  │
│                              │
│  ── you@example.com ──       │
│  [ Lock vault ] [ Sign out ] │
└──────────────────────────────┘
```

## New routes

- `/_authenticated/_locked/security` — shows current passphrase hint, "Change passphrase" (deferred, disabled with a coming-soon tag for now), "Reset vault" (existing flow moved here), and auto-lock timer info. Uses the same HeroIcon + Display + Lede layout.
- `/_authenticated/profile` — sits outside the `_locked` gate so it works even before the vault is unlocked. Editable display name, avatar (initials chip, later upload), read-only email, and quick sign-out. Persists to the existing `profiles` table.

Both pages reuse the shared `AegisScreen` / `BrandBar` / `Field` / `PrimaryButton` primitives so the look stays consistent.

## Technical notes

- New component `src/components/aegis/NavSheet.tsx` — a portal-rendered overlay driven by Framer Motion (`AnimatePresence`, backdrop fade, panel slide from `x: "100%"` with the shared `spring`). Handles Escape, focus trap on the first row, and `overflow: hidden` on `document.body` while open.
- New component `src/components/aegis/BrandBarWithMenu.tsx` — thin wrapper around the existing `BrandBar` that owns the open/close state and renders the hamburger button on the right (with `whileTap` scale). Existing per-page `right` slots (Back, Lock, Sign out) collapse into the sheet, keeping the bar visually calm on 390px widths.
- Nav destinations are declared once in `src/components/aegis/nav-items.ts` (id, label, description, icon, `to`) so the sheet, the future keyboard shortcut, and any breadcrumb reuse the same data. Active route is detected with `useRouterState({ select: s => s.location.pathname })`.
- Sign out / lock stay in their current implementations; the sheet just calls the same handlers, which live in a small `useVaultActions` hook to avoid duplicating them across Vault and the sheet.
- The floating "+ Add account" pill on the Vault page stays; the sheet's "Add account" row is a secondary entry point that also works from Security and Profile.
- No layout changes on desktop widths — the design is mobile-first (390px viewport) which is where the app lives, and the sheet caps at `max-w-[360px]` so it also looks intentional on wider screens.
- Route architecture: new files use flat dot-separated names — `_authenticated._locked.security.tsx` and `_authenticated.profile.tsx` — matching the existing pattern.
