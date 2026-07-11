# Aegis — Changelog

All notable user-visible changes land here. This file is the public
history; internal engineering notes stay in `docs/roadmap.md` and phase
release notes live under `docs/release-notes/`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- In-app **Report a problem** in Profile → Support. Category-tagged
  messages ship to the admin-only `client_errors` table with the
  current path and viewport attached. Vault contents are never sent.
- **Real-User Monitoring** — sampled (10%) LCP / INP / CLS collector
  that flushes on visibility change. Same admin-only table, tagged
  `rum:<pathname>`.
- **Server-side log shipping** — `public.server_logs` admin-only table
  with a helper at `src/lib/server-log.server.ts`. A `pg_cron` job
  purges rows older than 30 days.
- **Bundle-size CI gate** — `scripts/check-bundlesize.mjs` +
  `.github/workflows/bundlesize.yml`. Fails a PR when the main JS
  entry exceeds 250 KB gz or CSS exceeds 30 KB gz.
- **Component tests** for `AccountCard`, `PasteTab`, and `AvfPassStage`
  under `src/components/vault/`.
- **Playwright E2E** onboarding → add → export flow at
  `tests/e2e/onboarding-flow.spec.ts` (opt-in via env vars).
- `docs/architecture.md` — system-level overview referenced by the
  roadmap and every phase document.
- `docs/CHANGELOG.md` — this file.

### Changed
- `SECURITY.md` opens with the coordinated-disclosure inbox and the
  quarterly-pentest cadence, both promoted from the roadmap's
  cross-cutting tracks.

## [0.4.0] — 2026-07-06

### Added
- Browser extension (Phase 10) — Chrome + Firefox MV3, autofill for
  `<input autocomplete="one-time-code">`, WebPush "approve on this
  device" flow, 30-second clipboard clear.

## [0.3.0] — 2026-06

### Added
- Family plan (Phase 13) — up to 6 members, shared accounts, admin
  invite flow, per-share ephemeral-static X25519 sealing.
- Stripe subscriptions — free / pro / family tiers via
  `/api/public/stripe-webhook`.

## [0.2.0] — 2026-05

### Added
- Security dashboard (Phase 9) — trusted devices, sign-in history,
  vault health with duplicate detection and optional HIBP lookup.
- Crypto v2 (Phase 12) — Argon2id KDF, AAD-bound row envelopes, live
  background re-encrypt migrator.

## [0.1.0] — 2026-04

### Added
- Offline & installability (Phase 6) — PWA manifest, guarded service
  worker, encrypted IndexedDB mirror, offline outbox.
- Vault UX depth II (Phase 7) — tags, DnD reorder, bulk operations,
  HOTP + Steam Guard.
- Design system + i18n + a11y (Phase 8) — dark mode, eight locales,
  WCAG 2.1 AA clean via axe-core in CI.
