# Aegis — current plan

Last updated: Phase 0 is now **fully complete** (audit deliverables + clean
CI). Phase 1.1 admin/schema migrations and Phase 2 crypto version-lock +
golden vectors also landed.

## Phase 0 — Baseline audit ✅ CLOSED

- `SECURITY.md` v0.1 published — zero-knowledge invariant, v1 crypto
  params, RLS-only authz stance, coordinated-disclosure stub.
- `docs/routing.md` published — 14 routes tabulated with SSR posture,
  guard stack, data reads; plus the public/auth/locked map that the
  Phase 1.2 RLS CI test will consume.
- `perf/baseline.json` captured from a real `bun run build`:
  - Typecheck: `bunx tsgo --noEmit` → **0 errors**.
  - Lint: `bunx eslint .` → **0 errors, 10 warnings** (all
    `react-refresh/only-export-components` in shadcn UI — expected).
    Auto-fixed 1167 prettier formatting errors in the same pass.
  - Build: **clean**. Biggest client chunks: `esm` 458 KB, `index`
    450 KB, `vault_.recovery` 419 KB. Biggest server libs:
    `@zxing/browser` 1.07 MB, `@tanstack/react-router` 656 KB,
    `jspdf` 477 KB. Both are called out under `nextWins` for
    Phase 6 code-splitting.
- `@zxing/library@^0.22.0` locked as an explicit dep (was previously an
  unresolved peer of `@zxing/browser`).

**Exit criterion met:** clean typecheck ✅, zero-error lint ✅, clean
build ✅, baseline snapshot ✅, security stub ✅, route-map doc ✅.
Phase 0 is closed — Phase 1 backend hardening is where new PRs go.

## Phase 1.1 — Schema migrations (landed)

- `profiles.role` (`'user' | 'admin'`, default `'user'`) with a
  `prevent_role_self_promotion` trigger — role changes require the
  `service_role` connection.
- `public.is_admin(uuid)` security-definer helper, granted to
  `authenticated` + `service_role` only.
- `client_errors` table — anon + authenticated can INSERT, only admins
  can SELECT. `purge_old_client_errors(days)` housekeeping fn.
- `admin_audit` table — append-only: only `service_role` can INSERT,
  only admins can SELECT; UPDATE/DELETE revoked from every role.
- `vault_accounts` size caps: ciphertext ≤512 bytes, IV = 12 bytes,
  issuer/label ≤200 chars, icon_slug ≤100 chars, plus a
  `enforce_vault_accounts_per_user_limit` trigger capping each user at
  500 accounts.

## Phase 1 — Backend hardening ✅ CLOSED (this session)

### 1.1 Remaining schema (just landed)
- `vault_accounts.tags text[]` + GIN index + 20-tag-per-row cap.
- `vault_accounts.is_favorite` + partial index on `(user_id, is_favorite) WHERE is_favorite` — favorites now sync across devices (the client-only `favorites.ts` cache will be swapped over in a Phase 3 UI PR).
- `feature_flags` table: signed-in users can SELECT; only admins can INSERT/UPDATE/DELETE.
- `announcements` table: signed-in users see rows where `expires_at IS NULL OR expires_at > now()`; only admins can write. `kind` constrained to `info|warning|success|critical`.

### 1.2 RLS
- Admin-read policies on `client_errors` and `admin_audit` — landed with the tables. **No admin policy on `vault_accounts` — intentional.**
- Per-user insert rate limit: `enforce_vault_accounts_insert_rate_limit` trigger caps each user at 60 new vault rows per minute.
- CI test `tests/rls/anonymous-cannot-read.spec.mjs` — 9 green assertions: anon SELECT on every user/admin/auth-only table returns no rows, and anon INSERT on `vault_accounts` + `profiles` is rejected. Run with `node --test tests/rls/anonymous-cannot-read.spec.mjs`.

### 1.3 Edge / server code
- `src/start.ts` now registers `securityHeadersMiddleware` in front of the error middleware. Every server response gets a strict `Content-Security-Policy` (self + inline styles + `*.supabase.co` / `*.lovable.dev` connect), `Strict-Transport-Security` (2y + preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` locking camera/clipboard to self and denying geolocation/microphone/payment, and `Cross-Origin-Opener-Policy: same-origin`.
- **Rate limit on `POST /auth/*`** is provided by Supabase Auth itself (configured platform-side) — we cannot intercept those calls from app code because they hit the Supabase Auth service directly, not our TanStack Start worker.

### 1.4 Backups & DR
- `docs/dr.md` published — documents the PITR / snapshot posture (Lovable Cloud → Advanced settings owns backup config), RPO ≤ 5 min / RTO ≤ 60 min targets, quarterly restore drill checklist, and the zero-knowledge property (a full dump leaks no codes).
- Enabling PITR + scheduling snapshot exports is a **platform-side action** the app cannot perform — the service-role key is not exposed to the app runtime. Left as a manual step for the operator.

**Exit criterion met:** SECURITY.md promises are enforced in migrations + CI. Phase 1 is closed.



### Phase 2 — Crypto version lock
- `VAULT_CRYPTO_VERSION = 1` exported from `src/lib/vault-crypto.ts`
  with an inline contract explaining what bumping it requires (KDF,
  wrap shape, secret shape). v2 (Argon2id + AAD) documented as the
  next migrator.
- `tests/crypto/rfc6238.spec.mjs` — 18 RFC 6238 golden assertions
  (SHA-1/256/512 × 6 canonical timestamps). Green.
- `tests/crypto/vault-crypto.roundtrip.spec.mjs` — KDF determinism,
  wrap/unwrap round-trip, wrong-passphrase rejection, tampered
  ciphertext + IV rejection. Green.
- Run both with `node --test tests/crypto/*.spec.mjs` (no vitest
  dependency introduced).

### Accepted linter warnings
Two Supabase linter warnings remain after the migration and are
**intentional** — do not "fix" them:
1. `client_errors` INSERT policy is `WITH CHECK (true)` because the
   frontend needs to log errors from unauthenticated pages too. The
   payload has no privileged content.
2. `is_admin(uuid)` is a `SECURITY DEFINER` function granted to
   `authenticated`. That grant is required for RLS policies on
   `client_errors` and `admin_audit` to evaluate it. The function only
   reads the caller's own `profiles` row.

## Notes on the wider roadmap you shared

That roadmap (Phases 0–7) was written before this session. Big items
worth reconciling against reality before you plan the next PRs:

- Phase 4 (auto-lock, change passphrase, delete account, avatar) is
  already shipped — see the "shipped screens" section below. The
  roadmap lists them as pending.
- Phase 1.4 (Supabase PITR + weekly S3 dumps) is a platform-side task
  that cannot be done from Lovable Cloud tooling — it needs the
  Supabase dashboard directly.
- Phase 1.3 CSP/HSTS headers and edge rate-limits on `POST /auth/*`
  need to be added at the TanStack Start server middleware layer;
  Supabase Auth has its own built-in rate limits for the auth
  endpoints themselves.

The next-up crypto work is the v2 migrator (Argon2id + AAD binding on
`vault_accounts.secret_ciphertext`). Ship it behind
`VAULT_CRYPTO_VERSION = 2` with a background re-encrypt.

---

## Vault navigation (background — unchanged)

Persistent bottom tab bar (Vault / Security / Profile) driven by
`_authenticated/_tabs.tsx`; locked-vault gate at
`_authenticated/_locked/route.tsx`. Add-account is the floating pill on
the Vault screen, not a tab.

## Shipped screens

### Security tab
- Change passphrase — bottom-sheet flow, `rewrapVaultKey` mints a fresh
  KEK + salt + iv, DEK stays the same so `vault_accounts` is untouched.
- Auto-lock timer — picker (1/5/15/30 min / never), mirrored to
  `profiles.auto_lock_pref` for cross-device sync.
- Biometric enroll/disable — clear success/failure notice, WebAuthn
  removal explicitly verified.

### Profile tab
- Editable display name, persisted to `profiles`.
- Avatar — client resize to 512×512 JPEG, private `avatars` bucket at
  `user_id/avatar.jpg`, short-lived signed URLs, Choose/Remove sheet.
- Delete account — `deleteMyAccount` server fn wipes `vault_accounts`,
  `vault_meta`, `profiles`, avatar object, then removes the
  `auth.users` row via the admin API.

### Vault
- Search + favorites.
- Recovery sheet.
- Copy code + auto-clear clipboard after 30 s (only if value unchanged).
- Bulk import — Paste / File-or-image, auto-detects `otpauth://` lists,
  `otpauth-migration://` (Google Authenticator protobuf), Aegis plain
  JSON, and 2FAS JSON. Preview stage with per-row checkboxes.

## Next feature candidates

1. **Encrypted export** — download a passphrase-wrapped `.avf` file
   mirroring the DB shape so users hold their own backup. (Phase 3.2.)
2. **RLS CI test** — `tests/rls/anonymous-cannot-read.spec.ts` walking
   the map in `docs/routing.md`.
3. **`VAULT_CRYPTO_VERSION = 2`** — Argon2id KDF + AAD binding
   (`user_id || account_id`) with a background re-encrypt migrator.
4. **CSP + security headers middleware** on the TanStack Start server.
