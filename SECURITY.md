# Aegis — Security Policy (v0.1)

Aegis is a zero-knowledge TOTP authenticator. This document is the source of
truth for our security posture. It will grow as we harden.

## Zero-knowledge invariant

The server (Lovable Cloud / Supabase) MUST NEVER be able to compute a user's
TOTP codes. Concretely:

- The master passphrase never leaves the device.
- The DEK (Data Encryption Key) exists only in RAM on the user's device after
  they unlock the vault. It is never transmitted or logged.
- Every TOTP `secret` is encrypted with the DEK using AES-GCM before it hits
  the network. The server only ever sees opaque ciphertext + a random IV.
- A full database dump — including by a compromised operator — yields opaque
  ciphertext. Without the passphrase, it is useless.

If any code change would let an operator, a Supabase admin, or an edge-side
attacker decrypt vault contents, it MUST be rejected in review.

## v1 crypto parameters

Pinned by `VAULT_CRYPTO_VERSION` in `src/lib/vault-crypto.ts`.

| Item | Value |
| --- | --- |
| KDF | PBKDF2-HMAC-SHA256, 600 000 iterations (OWASP 2024 baseline) |
| Salt | 16 random bytes, per-user, stored on `vault_meta.kdf_salt` |
| DEK | AES-GCM 256-bit, generated with `crypto.subtle.generateKey` |
| DEK wrap | AES-GCM, 12-byte IV, tag included, stored on `vault_meta.recovery_wrapped_key` |
| Secret encryption | AES-GCM per row, 12-byte IV per row |
| AAD | none (v1) — planned for v2 |

## Authorization model

- All app-level authorization is enforced by Postgres Row Level Security.
- Every user-owned table has `auth.uid() = user_id` policies for the four DML
  operations that are exposed.
- Admins (`profiles.role = 'admin'`) may read `client_errors` and
  `admin_audit` only. Admins have NO read access to `vault_accounts`.
- The service role is used only from trusted server functions
  (`src/integrations/supabase/client.server.ts`) for account deletion, admin
  auditing, and maintenance. It never touches ciphertext for the purpose of
  reading it.

## Coordinated disclosure

Report vulnerabilities to `security@aegis.app` (stub — a PGP key will be
published before GA). Please do not open public issues for security bugs.
We aim to acknowledge within 72 hours and to ship a fix or workaround within
14 days for high-severity issues.

## Scope

In-scope: the Aegis web app, its Supabase project, and the crypto module.

Out-of-scope for reports (but still fixed on best-effort): third-party
libraries with published upstream advisories, browser bugs, OS-level attacks
requiring a compromised device.
