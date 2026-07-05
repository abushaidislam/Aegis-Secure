# Aegis — Design Instructions

A single source of truth for the visual language of this app. Every new screen,
component, or modal must feel like it was cut from the same cloth as the vault,
onboarding, and settings surfaces. If a change would break these rules, don't
ship it — extend the system instead.

> **North star:** *Warm, editorial, physical.* A leather notebook holding
> cryptographic secrets. Serif display + monospaced code + cream paper.
> Never generic SaaS, never neon, never purple gradients.

---

## 1. Aesthetic direction

- **Tone:** editorial-minimal, warm cream paper, quiet luxury.
- **Metaphor:** a hand-bound field notebook — soft grain, ink-on-cream, precise
  monospaced digits stamped into the page.
- **Refusals:** no Inter/Poppins, no purple/indigo gradients on white, no
  glassmorphism blur-cards, no neon accents, no emoji-heavy UI, no drop-shadow
  cartoon buttons, no default shadcn look-and-feel left unstyled.
- **Motion:** *few, meaningful, physical.* Springy but calm. One hero motion
  per screen beats ten micro-jitters.

---

## 2. Color tokens (do not hardcode elsewhere)

Import from `src/components/aegis/chrome.tsx`:

| Token         | Hex        | Use                                                     |
| ------------- | ---------- | ------------------------------------------------------- |
| `CREAM`       | `#f7f4ed`  | Page background (warm paper)                            |
| `CREAM_SOFT`  | `#fcfbf8`  | Cards, sheets, fields, elevated surfaces                |
| `CHARCOAL`    | `#1c1c1c`  | Text, primary buttons, ink                              |
| `BORDER`      | `#eceae4`  | All 1px hairlines                                       |
| `MUTED`       | `#5f5f5d`  | Secondary text, icon defaults                           |
| `DANGER`      | `#8a2020`  | Destructive text/borders (chrome.tsx)                   |
| Delete-red    | `#b23a2a`  | Destructive filled buttons (AccountCard sheet)          |
| Favorite-gold | `#c99a2b`  | Pinned/favorite state                                   |

Rules:
- Never write `text-white`, `bg-black`, `bg-[#xxx]` in a component. Use tokens
  or `style={{ color: CHARCOAL }}`.
- Semantic shadcn tokens in `src/styles.css` mirror this palette — extending
  the palette means editing **both** `chrome.tsx` (JS constants) **and**
  `styles.css` (oklch variables).
- Overlays: `rgba(28,28,28,0.35)` + `backdropFilter: blur(4px)`.
- Tinted chips (issuer color, notice bg): generate from a stable hue with
  `hsl(hue, 42%, 92%)` bg and `hsl(hue, 40%, 28%)` fg — see `AccountCard`.

---

## 3. Typography

Three families, each with one job:

| Family              | Role                                          | Where                                      |
| ------------------- | --------------------------------------------- | ------------------------------------------ |
| `Playfair Display`  | Display/serif headings, sheet titles          | `<Display>`, modal titles                  |
| `Sora`              | UI weight (600) for chips, initials, brand    | Brand mark, avatar initials, section labels|
| `Manrope`           | Body / default UI text (`--font-sans`)        | Everything not covered above               |
| `JetBrains Mono`    | Codes, eyebrows, tabular numbers              | TOTP digits, `Eyebrow`, countdown ring     |

Rules:
- Headings: `letter-spacing: -0.02em`, weight `600`.
- Body: `line-height: 1.55`, max width ~`34ch` for lede paragraphs.
- Codes/numbers: **always** `font-feature-settings: "tnum"` +
  `letter-spacing: 0.06em`. Split 6-digit TOTP as `XXX XXX`.
- Eyebrows: monospace, `uppercase`, `letter-spacing: 0.25em`, 10px.
- Never introduce a 4th font. Never fall back to system defaults visibly.

---

## 4. Surfaces & elevation

- **Radius vocabulary:** `10px` buttons, `12px` fields, `13–14px` inline chips
  and secondary buttons, `18px` hero tiles, `22px` bottom sheets. Pick from
  this ladder; don't invent new radii.
- **Cards / fields:** `background: CREAM_SOFT`, `border: 1px solid BORDER`,
  `boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)"` — the inner highlight is
  what makes them feel embossed on paper. Don't drop it.
- **Primary button shadow** (`INSET_SHADOW`): keep verbatim from `chrome.tsx`.
  It's the signature bevel on charcoal buttons.
- **Bottom sheet shadow:** `0 -12px 40px -12px rgba(0,0,0,0.25)`.
- **No large drop shadows on cream** — they read as cheap. Use hairline borders
  + the inset highlight instead.

---

## 5. Background & backdrop

Every full-screen surface sits on `<Backdrop />` (see `chrome.tsx`):
- Warm radial washes (peach, blush, dusty blue) at low opacity.
- Two slow-drifting blurred blobs (18s / 22s loops, respects
  `useReducedMotion`).
- A subtle 3px dot grain overlay at ~5% opacity, `mix-blend-multiply`.

Never replace this with a flat color or a stock gradient. New screens compose
inside `<AegisScreen>` which already provides it.

---

## 6. Layout

- **Mobile-first, single column, max-width `440px`, centered.** The app is a
  vault — density is intentional, not marketing-page airy.
- Safe-area padding: `pt-[max(28px,env(safe-area-inset-top))]` /
  `pb-[max(24px,env(safe-area-inset-bottom))]`.
- Row rhythm: 12–16px vertical gap between cards, 3.5–4 (14–16px) horizontal
  padding inside cards.
- Avatars / logo chips: 40×40, radius 12, `object-contain` on white when a
  logo loads, tinted initials fallback otherwise.

---

## 7. Motion

Use `framer-motion` only. Two named springs live in `chrome.tsx` — use them:

```ts
spring = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } // taps, buttons
soft   = { type: "spring", stiffness: 200, damping: 32, mass: 1   } // entrances, sheets
```

Patterns:
- **Entrance:** `initial={{ opacity: 0, y: 6-10 }} animate={{ opacity: 1, y: 0 }}`
  with `soft`. Stagger by `delay: 0.05` increments.
- **Tap:** `whileTap={{ scale: 0.985–0.99 }}` on buttons,
  `whileTap={{ scale: 0.85–0.9 }}` on icon-only affordances.
- **Code swap:** `AnimatePresence mode="popLayout"` with y: ±4, 0.18s — see
  `AccountCard`.
- **Bottom sheet:** `initial={{ y: 40, opacity: 0 }} → { y: 0, opacity: 1 }`
  with `soft`; overlay fades independently.
- **Always** respect `useReducedMotion()` for looping/ambient motion.
- No parallax, no scroll-jacking, no confetti. One expressive moment per view.

---

## 8. Component patterns

Reuse the primitives in `src/components/aegis/chrome.tsx`. Do not fork them.

- `<AegisScreen>` — full-bleed shell + backdrop. Every route uses this.
- `<BrandBar right={…}>` — top bar with the shield mark.
- `<Display>` / `<Lede>` / `<Eyebrow>` — the only heading stack.
- `<HeroIcon Icon={…}>` — the layered charcoal tile with two rotated frames.
  Reserved for hero moments (auth, empty states, onboarding steps).
- `<IconChip>` — round 40px cream chip for inline icons.
- `<Field icon={…}>` — the canonical input row. New inputs go inside this.
- `<PrimaryButton>` / `<GhostButton>` / `<TextLink>` — the entire button
  vocabulary. Add a variant to these; do not introduce a 4th button style.
- `<Notice kind="error|info">` — inline messages. No toasts for form errors.
- Toasts (`sonner`) for async success/failure only, and dedupe repeated
  failures (see `notifiedIssuers` in `AccountCard`).

---

## 9. Modals & confirmations

**Bottom sheet is the default modal.** Reference: the delete confirmation in
`AccountCard.tsx`.

- Slides up from the bottom on mobile, centers on `sm:` and up
  (`items-end sm:items-center`, `rounded-t-[22px] sm:rounded-[22px]`).
- Overlay: `rgba(28,28,28,0.35)` + `backdropFilter: blur(4px)`, tap-to-dismiss
  unless a destructive action is in flight (`disabled={deleting}`).
- Anatomy, in order:
  1. 4×10 drag handle (`rgba(28,28,28,0.15)`), centered.
  2. Header row: 44×44 subject chip (logo or initials) + Playfair title +
     muted subtitle, with an `X` close button on the right.
  3. Muted 13px explanatory paragraph, `line-height: 1.55`.
  4. Stacked buttons, primary action first, cancel second. Destructive uses
     the `#b23a2a` filled button with a `Trash2` icon; cancel is a ghost
     button.
- **Do not** use shadcn `<AlertDialog>` or centered `<Dialog>` for confirms.
  Those exist in the repo but the Aegis convention is the bottom sheet.
- Provide haptics: `navigator.vibrate(6)` on soft actions, `14` on destructive
  triggers (long-press).

---

## 10. Interaction & affordances

- **Tap = safe action.** On the account card, tap copies the code.
- **Long-press (500ms) or right-click = reveal destructive/secondary action**,
  then always open a bottom sheet to confirm. Never delete on the gesture
  alone. Guard with a `longPressedRef` so the tap handler doesn't also fire.
- Copy feedback: swap the icon for a pill (`Copied` in `CHARCOAL` on
  `CREAM_SOFT`) for ~1.2s, `AnimatePresence mode="wait"`.
- Countdown/urgency: recolor to `DANGER` when `remaining ≤ 5s`. The ring +
  the digits + the number in the ring all shift together.
- Focus states: `focus:ring-2 focus:ring-ring focus:ring-offset-2` — never
  remove focus rings for looks.

---

## 11. Content & voice

- Titles: sentence case, short, human. "Remove GitHub?" not
  "Confirm Deletion".
- Body copy: explain the consequence in one sentence, then how to recover.
  Example: *"The encrypted secret will be deleted from your vault. You'll
  need the original QR or setup key to add it back."*
- Never use exclamation marks in system copy. Never say "Oops".
- Bilingual users: keep English UI copy; Bangla is fine in changelogs/plan
  files but not in shipped strings unless the user asks.

---

## 12. Accessibility

- Every interactive element has an `aria-label` if it lacks visible text
  (star, close, ring timer).
- Keyboard: icon buttons implemented as `motion.span` need
  `role="button" tabIndex={0}` + `onKeyDown` for Enter/Space (see the favorite
  star in `AccountCard`).
- Color is never the only signal — pair the red countdown with the ring
  emptying and the number decreasing.
- Respect `prefers-reduced-motion` for ambient/looping motion.

---

## 13. Checklist before shipping a new screen

- [ ] Wrapped in `<AegisScreen>` with `<BrandBar>`.
- [ ] Uses `Display` / `Lede` / `Eyebrow` — no raw `<h1 className="text-2xl">`.
- [ ] All colors come from `chrome.tsx` tokens or CSS vars.
- [ ] Fields use `<Field>`; buttons use `PrimaryButton` / `GhostButton`.
- [ ] Any confirm dialog is a bottom sheet, not an `AlertDialog`.
- [ ] Motion uses `spring` or `soft`, and respects reduced motion.
- [ ] Copy is short, sentence case, explains consequence + recovery.
- [ ] Works at 390×712 (iPhone 14) without horizontal scroll.
