# Aegis routing map

Every route file in `src/routes/` and its guard stack. This file is the
canonical input to the RLS CI test (planned Phase 1.2): every route listed as
"authenticated" or "locked" must reject unauthenticated Supabase requests.

Legend:
- **SSR** — route renders on the server (default in TanStack Start).
- **CSR-only** — `ssr: false` on the route; renders in the browser only.
- **Public** — no auth required.
- **Auth** — signed-in user required (under `_authenticated/`).
- **Locked** — signed-in + vault unlocked (DEK in RAM) — under
  `_authenticated/_locked/`.

## Routes

| Path | File | SSR | Audience | Guard stack | Reads |
| --- | --- | --- | --- | --- | --- |
| `/` | `src/routes/index.tsx` | SSR | Public | none | none |
| `/auth` | `src/routes/auth.tsx` | SSR | Public | redirects to `/vault` when session exists | Supabase Auth |
| `/auth/callback` | `src/routes/auth.callback.tsx` | SSR | Public | exchanges OAuth code | Supabase Auth |
| `/auth/reset-password` | `src/routes/auth.reset-password.tsx` | SSR | Public | none | Supabase Auth |
| `_authenticated` layout | `src/routes/_authenticated/route.tsx` | CSR-only | Auth | `supabase.auth.getUser()` → redirect `/auth` | Supabase Auth |
| `/onboarding` | `src/routes/_authenticated/onboarding.tsx` | CSR-only | Auth | inherits `_authenticated` | `profiles`, `vault_meta` |
| `/lock` | `src/routes/_authenticated/lock.tsx` | CSR-only | Auth | inherits `_authenticated` | `vault_meta` |
| `_authenticated/_tabs` layout | `src/routes/_authenticated/_tabs.tsx` | CSR-only | Auth | inherits | none |
| `/vault` | `src/routes/_authenticated/_tabs/vault.tsx` | CSR-only | Auth (soft-locked) | inherits — locked state handled in-component | `vault_accounts` (needs DEK for decrypt) |
| `/security` | `src/routes/_authenticated/_tabs/security.tsx` | CSR-only | Auth | inherits | `profiles`, `vault_meta` |
| `/profile` | `src/routes/_authenticated/_tabs/profile.tsx` | CSR-only | Auth | inherits | `profiles` |
| `_authenticated/_locked` layout | `src/routes/_authenticated/_locked/route.tsx` | CSR-only | Locked | inherits + requires in-memory DEK → redirect `/lock` | none |
| `/vault/new` | `src/routes/_authenticated/_locked/vault_.new.tsx` | CSR-only | Locked | inherits | `vault_accounts` (write) |
| `/vault/import` | `src/routes/_authenticated/_locked/vault_.import.tsx` | CSR-only | Locked | inherits | `vault_accounts` (write) |
| `/vault/recovery` | `src/routes/_authenticated/_locked/vault_.recovery.tsx` | CSR-only | Locked | inherits | `vault_meta` |

## Public / Auth / Locked map (for the RLS CI suite)

Anonymous Supabase client must return `[]` or 401 for:

- `SELECT` on `profiles`, `vault_meta`, `vault_accounts` — all user-owned.
- `SELECT` on `admin_audit` — admin-only.
- `SELECT` on `client_errors` — admin-only.

Anonymous client may:

- `INSERT` on `client_errors` (frontend error capture from unauthenticated pages).

Authenticated (non-admin) client must:

- Read/write only rows where `user_id = auth.uid()` on `profiles`, `vault_meta`, `vault_accounts`.
- Not read `admin_audit` or other users' `client_errors`.

Authenticated admin (via `profiles.role = 'admin'`) may additionally:

- Read `client_errors` and `admin_audit`.
- Never read `vault_accounts` (no admin policy exists — this is intentional).
