
## Phase 8.1 — Semantic-token pass

Goal: no hard-coded hex/rgba colors anywhere in `chrome.tsx`, `settings.tsx`, or route files (except third-party brand marks like Google logo). Every component consumes theme-aware CSS variables. Add an internal `/dev/tokens` route to visually verify every token in both light and dark modes.

### Scope of files to sweep

- `src/components/aegis/settings.tsx` — gradient overlay hex → ink-rgb var
- `src/components/vault/ScanTab.tsx` — `#0a0a0a`, `#c9a24a` (warning), `#4a8f5a` (success)
- `src/routes/__root.tsx` — `theme-color` meta will keep its literal (browser chrome only)
- `src/routes/index.tsx` — CREAM/CHARCOAL constants → CSS vars
- `src/routes/blog.aegis-vs-google-authenticator.tsx` — heaviest offender, ~30 hex sites
- `src/routes/_authenticated/_locked/vault_.recovery.tsx` — QR fg/bg + tile bg
- `src/routes/_authenticated/_locked/vault_.new.tsx` — status dots
- `src/routes/_authenticated/_locked/vault_.import.tsx` — scanner overlay + status dot
- `src/routes/_authenticated/_tabs/vault.tsx` — chip color

Google brand SVG in `chrome.tsx` (EA4335 / 4285F4 / FBBC05 / 34A853) is a brand asset and stays literal — documented as an exception.

### New semantic tokens (add to `src/styles.css`)

Two new status colors are needed (light + dark values):

```
--aegis-success       (light: #4a8f5a  · dark: #6db97b)
--aegis-success-rgb   (rgb triplet)
--aegis-warning       (light: #c9a24a  · dark: #e6b04a)
--aegis-warning-rgb   (rgb triplet)
--aegis-scanner-bg    (light: #0a0a0a  · dark: #0a0a0a — scanner stays dark either way)
```

Existing tokens already cover ink, cream, cream-soft, border, muted, danger, fav, placeholder — those are the target replacements everywhere else.

### Replacement rules

- `#f7f4ed` / `#fbf7ee` / `#fff` on cream surfaces → `var(--aegis-cream)` or `var(--aegis-cream-soft)`
- `#1c1c1c` / `#1c1c1a` → `var(--aegis-ink)`
- `#6b6b6b` / `#4a4a4a` / `#3a3a3a` → `var(--aegis-muted)`
- `rgba(28,28,28, X)` → `rgb(var(--aegis-ink-rgb) / X)`
- QR foreground/background → `var(--aegis-ink)` / `var(--aegis-cream-soft)` read via `getComputedStyle` at render time (QR lib needs literals)
- Blog page: replace top-level constants (CREAM, CHARCOAL, MUTED) with CSS vars via a single `useTheme`-less helper — pure inline styles that reference the vars

### `/dev/tokens` route

- New file: `src/routes/dev.tokens.tsx`
- Not linked from nav; discoverable via URL only
- Renders a grid of every `--aegis-*` token as a swatch card: name, resolved value, hex/rgb readout, contrast ratio hint against ink/cream
- Includes a manual light/dark toggle at the top (adds/removes `.dark` on `<html>`) so a reviewer can flip modes without OS-level changes
- Groups: Surfaces · Text · Status · Accents · Glow · Grain

### Roadmap update

Mark 8.1 checkboxes done and note the Google brand SVG exception.

### Non-goals

- No visual redesign of any existing route — pure token migration
- No changes to shadcn's `--color-*` OKLCH tokens (Aegis tokens live alongside)
- Storybook is not being added; `/dev/tokens` fulfills the "render every token" requirement

### Verification

- `rg '#[0-9a-fA-F]{6}' src/routes src/components/aegis` returns only the Google brand SVG lines
- Load `/dev/tokens` in both light and dark, confirm every swatch renders and flips
- Spot-check blog, vault list, scanner, recovery QR in both modes via Playwright screenshot
