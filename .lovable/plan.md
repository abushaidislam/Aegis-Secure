## Phase 8.3 — Localization

Goal: ship the localization infrastructure and the user-facing picker so translations can land incrementally. Aegis becomes ready to serve `en, es, pt-BR, fr, de, ja, hi, bn` with a clean workflow for future PRs.

### 1. Dependencies

Add via `bun add`:

- Runtime: `@lingui/core`, `@lingui/react`, `@lingui/detect-locale`
- Dev: `@lingui/cli`, `@lingui/vite-plugin`, `@lingui/babel-plugin-lingui-macro`, `babel-plugin-macros`

### 2. Config files

- `lingui.config.ts` — locales list, `sourceLocale: "en"`, catalogs in `src/locales/{locale}/messages.po`, format `po`.
- `vite.config.ts` — register `@lingui/vite-plugin` alongside the existing plugins.
- `package.json` scripts: `"i18n:extract": "lingui extract"`, `"i18n:compile": "lingui compile"`.

### 3. Runtime wiring

- `src/lib/i18n.ts` — `SUPPORTED_LOCALES` array with `{code, label, nativeLabel}` for the eight locales, `LOCALE_STORAGE_KEY = "aegis:locale"`, `getLocalePref()`, `setLocalePref()`, `activateLocale(code)` calling `i18n.load` + `i18n.activate`, and `detectInitialLocale()` (localStorage → `navigator.language` → `en`).
- `src/routes/__root.tsx` — wrap the app in `<I18nProvider i18n={i18n}>`, activate detected locale before hydration (mirror of theme boot).
- Auth sync in `__root.tsx`: on session, pull `profiles.locale` and, if present, re-activate + persist.

### 4. Catalogs

- Create `src/locales/{en,es,pt-BR,fr,de,ja,hi,bn}/messages.po` — empty scaffolds committed so `lingui compile` works out of the box; also `messages.ts` compiled outputs are gitignored and regenerated.
- Seed the `en` catalog with the strings from step 6 so the app renders identically today.

### 5. Database

Migration `add profiles.locale`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text
  CHECK (locale IN ('en','es','pt-BR','fr','de','ja','hi','bn'));
```

No new grants/policies (column on existing table already covered by RLS).

### 6. Wrap user-facing strings (initial pass)

Convert strings to Lingui macros in the highest-traffic surfaces so the extractor produces a real catalog:

- `src/routes/auth.tsx`, `src/routes/auth.callback.tsx`, `src/routes/auth.reset-password.tsx`
- `src/components/aegis/settings.tsx` (Profile → Appearance rows, Sign out, etc.)
- `src/routes/_authenticated/_tabs/{profile,security,vault}.tsx` visible labels, section titles, empty states
- `src/routes/_authenticated/_locked/vault_.{new,import,recovery}.tsx` primary CTAs, field labels, notices
- `src/components/aegis/BottomTabs.tsx` tab labels
- `src/components/onboarding/Onboarding.tsx` step copy

Deep technical strings (dev/tokens, error stack helpers, log-only text) stay in English; blog route stays English (SEO route).

### 7. Locale picker (Profile → Language)

- New section in `src/components/aegis/settings.tsx` mirroring the Appearance section: rows for each of the eight locales (native label + English label), active checkmark, tap to switch.
- On select: `activateLocale(code)` → `setLocalePref(code)` → upsert `profiles.locale`.

### 8. String freeze policy

- `docs/i18n.md` — new short doc: any PR touching visible copy runs `bun run i18n:extract`, commits the `.po` diff; CI check to be added in Phase 8.4.
- Mention in `AGENTS.md` under a new "Localization" bullet.

### 9. Verification

- `bun run i18n:extract` produces a non-empty `en` catalog with the strings from step 6.
- `bun run i18n:compile` succeeds for all eight locales.
- Manual: switch locale in Profile → picker persists across reload, `profiles.locale` updated. English fallback works for locales with empty catalogs.
- Typecheck + build clean.

### Non-goals

- Actual translated copy for es/pt-BR/fr/de/ja/hi/bn (empty catalogs, English fallback until translators land copy).
- Right-to-left support (no RTL locales in the initial eight).
- CI extractor check — deferred to Phase 8.4 alongside axe-core.
- Localizing the marketing home page and blog route (SEO English-only for now).

### Technical notes

- Lingui macros require the Vite plugin; without it, `<Trans>` and `t\`\`` render literally. The plugin transforms at build time — no runtime cost.
- `@lingui/detect-locale` handles `navigator.languages` fallback chain; we only accept it if it matches a supported locale, else `en`.
- Pre-hydration locale activation is synchronous (catalog is bundled), so no flash of untranslated content.
