<div align="center">

# Aegis

**Security that simply works.**

A zero-knowledge, end-to-end encrypted TOTP authenticator for the modern web.
Your master passphrase never leaves your device — the server stores opaque
ciphertext and nothing else. A full database dump leaks zero codes.

[Live app](https://aegis-syed.lovable.app) · [Security](./SECURITY.md) · [Roadmap](./docs/roadmap.md) · [Architecture](./docs/architecture.md) · [API](./docs/api.md)

</div>

---

## Why Aegis

Most authenticators either sync your secrets in the clear or lock you into a
single device. Aegis does neither. Every TOTP secret is encrypted on your
device with a key derived from a passphrase we never see, then synced across
your devices as ciphertext. Change your passphrase in one place, every device
stays online — we rewrap the KEK, the DEK never changes, and `vault_accounts`
is never rewritten.

Built on **TanStack Start** (SSR React 19 + Vite 8 on Cloudflare Workers),
backed by **Lovable Cloud** (Supabase-flavoured Postgres with RLS), paranoid
about **crypto correctness** — 18 RFC 6238 golden vectors run on every commit.

## Highlights

- **Zero-knowledge crypto.** PBKDF2-HMAC-SHA256 · 600 000 iterations
  (OWASP 2024 baseline) → AES-GCM 256 wrap of a per-user DEK. Every TOTP
  secret is encrypted on the client before it hits the network. See
  [`SECURITY.md`](./SECURITY.md).
- **Broad, correct algorithm support.** RFC 6238 TOTP (SHA-1/256/512),
  RFC 4226 HOTP, and Steam Guard — all with round-trip tests against the
  browser extension.
- **Cross-device sync without trust.** Vault syncs through Lovable Cloud,
  but the server sees ciphertext only. Offline-first with an IndexedDB
  outbox that reconciles on reconnect.
- **Bulk import from everywhere.** Google Authenticator
  `otpauth-migration://` (with QR-from-screenshot decode), Aegis JSON,
  2FAS JSON, raw `otpauth://` lists, and our own encrypted `.avf` backup —
  all with a per-row preview and per-row checkbox stage.
- **Encrypted personal backups (`.avf`).** Passphrase-independent from
  your vault passphrase, same crypto envelope, restores on any device.
  Round-trip covered by tests.
- **Recovery kit + biometric unlock + auto-lock.** WebAuthn platform
  authenticator (Face ID / Touch ID / Windows Hello), auto-lock
  1/5/15/30-minute or never, and a printable recovery kit to get back in
  if you lose the passphrase.
- **Installable PWA.** Service worker, offline shell, push-based approval
  prompts, and add-to-home-screen on iOS/Android/desktop.
- **Browser extension.** Manifest V3 for Chrome and Firefox with domain
  matching, autofill, and a heartbeat-based trust handshake with the web
  app. See [`docs/extension-publishing.md`](./docs/extension-publishing.md).
- **Sharing, family, emergency access.** 1:1 encrypted account sharing
  via per-recipient key wrap, a family plan with role-based access, and
  emergency-contact recovery — all inside the zero-knowledge envelope.
- **Localised, accessible, themed.** 8 locales (EN, DE, ES, FR, PT-BR,
  JA, HI, BN), full dark mode, semantic design tokens, WCAG 2.1 AA
  audited with `@axe-core/playwright`.
- **Hardened backend.** Row-Level Security on every user table,
  admin-audit append-only log, per-user account cap (500), insert
  rate-limit (60 rows / minute), strict `Content-Security-Policy` +
  `Strict-Transport-Security` + `Permissions-Policy` middleware.

## Roadmap

| Phase | Status | What it shipped |
| --- | --- | --- |
| 0 · Baseline audit | ✅ | Security policy, route map, perf baseline |
| 1 · Backend hardening | ✅ | RLS + admin roles + audit log + CSP + DR doc |
| 2 · Crypto version lock | ✅ | `VAULT_CRYPTO_VERSION`, RFC 6238 tests |
| 3 · Vault UX depth | ✅ | Server-synced favorites, encrypted `.avf` export |
| 4 · Account lifecycle | ✅ | Change passphrase, auto-lock, biometric, avatar, delete |
| 5 · `.avf` restore | ✅ | End-to-end backup / restore across devices |
| 6 · Offline + PWA | ✅ | Service worker, IndexedDB cache, installable |
| 7 · Vault UX II | ✅ | Tags, drag-and-drop, bulk edit, HOTP, Steam Guard |
| 8 · Design system, dark mode, i18n, a11y | ✅ | WCAG 2.1 AA, 8 locales, semantic tokens |
| 9 · Security dashboard | ✅ | Trusted devices, sign-in history, vault health |
| 10 · Browser extension | ✅ | Chrome + Firefox MV3, domain match, autofill |
| 11 · Sharing, family, emergency | ✅ | 1:1 shared credentials, family plan, emergency access |
| 12 · Crypto v2 | ✅ | Argon2id + AAD binding + background re-encrypt |
| 13 · SEO + discovery | ✅ | OG/Twitter cards, sitemap.xml, GSC verified & indexed |
| 14 · Native mobile | 🚧 | Capacitor wrap, widget, watch complication |
| 15 · Open source + self-host | 🚧 | Public repo, Docker Compose stack (see `self-host/`) |

Full detail — including exit criteria and rationale — in
[`docs/roadmap.md`](./docs/roadmap.md).

## Getting started

```bash
bun install              # or npm / pnpm
bun run dev              # http://localhost:8080
bun run build            # production bundle
bun run build:ext        # browser extension (Chrome)
bun run build:ext:firefox
bunx tsgo --noEmit       # type-check
bun run test             # vitest unit suite
bun run test:e2e         # playwright E2E
bun run test:a11y        # axe accessibility audit
node --test tests/crypto/*.spec.mjs   # crypto golden vectors
node --test tests/rls/*.spec.mjs      # RLS regression
```

The dev server auto-runs; edits hot-reload. See
[`.lovable/plan.md`](./.lovable/plan.md) for the current short-horizon
plan.

## Architecture

- **Runtime.** TanStack Start v1 on Vite 8, targeting Cloudflare Workers
  via `nodejs_compat`. SSR by default; server functions live in
  `*.functions.ts` next to the route that consumes them; raw HTTP
  endpoints (webhooks, cron, health) live under `src/routes/api/public/`.
- **Data.** Lovable Cloud (Supabase) with Postgres + RLS. Every public
  table has explicit `GRANT` statements and RLS policies — no schema is
  reachable without a policy match. Migrations in `supabase/migrations/`.
- **Auth.** Supabase Auth (email + Google OAuth), an `_authenticated`
  layout route gating the vault, and a second `_authenticated/_locked/`
  gate for passphrase unlock.
- **Crypto.** `src/lib/vault-crypto.ts` is the single source of truth
  — KDF, wrap/unwrap, AES-GCM encrypt/decrypt. Anything crypto-adjacent
  imports from here, never re-implements.
- **Import / export.** `src/lib/vault-import.ts` (pure parsers) and
  `src/lib/vault-export.ts` (encrypted `.avf` envelope). Unit-testable
  without a bundler.
- **Extension bridge.** `src/lib/extension-bridge.ts` +
  `src/lib/extension-heartbeat.ts` implement a signed heartbeat handshake
  between the web app and the MV3 extension.
- **Payments.** Stripe via `src/lib/stripe.server.ts` and the webhook at
  `src/routes/api/public/stripe-webhook.ts` — signature-verified before
  any state mutation.

Route inventory and per-route data reads: [`docs/routing.md`](./docs/routing.md).
System architecture: [`docs/architecture.md`](./docs/architecture.md).
API surface: [`docs/api.md`](./docs/api.md) + [`docs/openapi.yaml`](./docs/openapi.yaml).
Disaster recovery: [`docs/dr.md`](./docs/dr.md).
Self-hosting: [`self-host/README.md`](./self-host/README.md).

## Security

- Threat model, invariants, and pinned crypto parameters:
  [`SECURITY.md`](./SECURITY.md).
- Reproducible build attestation: [`docs/reproducible-build.md`](./docs/reproducible-build.md).
- Crypto v2 release notes: [`docs/release-notes/phase-12-crypto-v2.md`](./docs/release-notes/phase-12-crypto-v2.md).
- No secret material — TOTP secrets, passphrases, DEKs, KEKs — is ever
  logged, transmitted, or written to disk outside of the encrypted vault
  path. Enforced by review, not decoration.

## SEO & discovery

- Per-route head metadata via TanStack Start's `head()` — unique
  `title`, `description`, `og:*`, `twitter:card`, JSON-LD per page.
- Custom social card at `/og-aegis.jpg`, wired into `og:image` and
  `twitter:image`.
- Dynamic `sitemap.xml` server route
  ([`src/routes/sitemap[.]xml.ts`](./src/routes/sitemap%5B.%5Dxml.ts))
  covering the landing page, auth, and all blog comparison pages.
- `public/robots.txt` allows crawlers and disallows every
  authenticated / vault route.
- Verified with **Google Search Console** via meta-tag verification;
  sitemap submitted for indexing.
- `SoftwareApplication` JSON-LD in the root shell for rich results.

## Tests

- `tests/crypto/rfc6238.spec.mjs` — 18 RFC 6238 golden vectors across
  SHA-1 / SHA-256 / SHA-512.
- `tests/crypto/hotp-steam.roundtrip.spec.mjs` — HOTP counter progression
  and Steam Guard alphabet round-trip.
- `tests/crypto/steam-extension-parity.spec.mjs` — parity between web
  app and browser extension for Steam codes.
- `tests/crypto/vault-crypto.roundtrip.spec.mjs` — KDF determinism,
  wrap/unwrap round-trip, wrong-passphrase rejection, tampered
  ciphertext / IV rejection.
- `tests/crypto/vault-export.roundtrip.spec.mjs` — `.avf` build →
  decrypt → serialise round-trip.
- `tests/rls/anonymous-cannot-read.spec.mjs` — anonymous SELECT returns
  no rows on any user or admin table; anonymous INSERT rejected on
  `vault_accounts` + `profiles`.
- `tests/rls/family-flows.spec.mjs` — family/sharing RLS regression.
- `tests/e2e/*` — Playwright flows for onboarding, locale switch, and
  axe-core accessibility audit.

## Contributing

Every change goes through:

1. **Typecheck** — `bunx tsgo --noEmit` must be **0 errors**.
2. **Lint** — `bunx eslint .` must be **0 errors**.
3. **Build** — `bun run build` must be clean.
4. **Tests** — all crypto, RLS, unit, and E2E suites green.
5. **Bundle budget** — `bun run check:bundlesize` under threshold.

Every migration that creates a table in `public` must also `GRANT`
privileges and enable RLS in the same file — the template enforces this
and CI will reject a table without a matching grant.

## Tech stack

| Layer | Tools |
| --- | --- |
| UI | React 19, TanStack Router/Query, Radix UI, Tailwind CSS v4, Framer Motion, Lucide |
| Runtime | TanStack Start v1, Vite 8, Cloudflare Workers (`nodejs_compat`) |
| Backend | Lovable Cloud (Supabase) — Postgres, RLS, Auth, Storage |
| Crypto | Web Crypto (PBKDF2, AES-GCM), `hash-wasm` Argon2id, `@noble/hashes` |
| Payments | Stripe (checkout + webhook) |
| i18n | Lingui — 8 locales |
| PWA | `vite-plugin-pwa`, web-push |
| Extension | Manifest V3, Chrome + Firefox |
| Testing | Vitest, Playwright, `@axe-core/playwright`, `node --test` |

## License

TBD — publishing under Apache 2.0 or MPL 2.0 is scoped in the roadmap.
See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

---

<div align="center">

Built with paranoid crypto and no dark patterns. If a change would let
an operator, a Supabase admin, or an edge-side attacker decrypt vault
contents, it does not merge. **That is the whole product.**

</div>
