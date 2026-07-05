# Aegis — current plan

## Navigation (done, revised approach)

Original plan proposed a hamburger + full-screen slide-in sheet with four
destinations. During implementation we switched to a **persistent bottom tab
bar** — more natural for a mobile-first PWA, one tap to any section, matches
native authenticator apps (Google Authenticator, Authy, 2FAS).

Current shape:

- `src/components/aegis/BottomTabs.tsx` — fixed bottom bar, three tabs:
  **Vault**, **Security**, **Profile**. Uses the shared cream/charcoal
  chrome, `soft` spring for the active pill.
- Add account is NOT a tab — it stays as the floating "+ Add account" pill
  on the Vault screen (primary action, one screen only).
- Layout route `_authenticated/_tabs.tsx` renders `<Outlet />` above the
  bottom bar. Locked-vault gate lives at `_authenticated/_locked/route.tsx`
  and wraps only the screens that need the DEK (Vault, Add). Security and
  Profile work without unlocking.
- Routes in place:
  - `_authenticated/_tabs/vault.tsx`
  - `_authenticated/_tabs/security.tsx`
  - `_authenticated/_tabs/profile.tsx`
  - `_authenticated/_locked/vault_.new.tsx` (Add account, unlock required)

```text
┌──────────────────────────────┐
│ 🛡 Aegis                     │
│                              │
│  Your codes.                 │
│  • account rows              │
│                              │
│          [ + Add account ]   │
│                              │
├──────────────────────────────┤
│  🔑 Vault  🛡 Security  👤 Me │  ← bottom tabs
└──────────────────────────────┘
```

## Remaining work on the shipped screens

### Security tab
- ~~**Change passphrase**~~ — DONE. Bottom-sheet flow verifies the
  current passphrase by unwrapping the DEK, then `rewrapVaultKey` mints
  a fresh KEK + salt + iv, updates `vault_meta`, and re-unlocks the
  in-memory DEK. `vault_accounts` untouched.
- ~~**Auto-lock timer**~~ — DONE. Picker (1 / 5 / 15 / 30 min / never)
  in `vault-session.ts`, cached in `localStorage` and mirrored to
  `profiles.auto_lock_pref` so it syncs across devices.
- **Biometric row** already toggles enroll/disable — verify copy is
  clear when the platform doesn't support WebAuthn.

### Profile tab
- Display name is editable and persists to `profiles`. Verify RLS covers
  update on `profiles`.
- ~~**Avatar**~~ — DONE. Client resizes to 512×512 JPEG
  (`src/lib/avatar.ts`), uploads to the private `avatars` bucket at
  `user_id/avatar.jpg`, stores the path on `profiles.avatar_url`, and
  reads via short-lived signed URLs. Bottom-sheet gives Choose/Remove.
- ~~**Delete account**~~ — DONE. `deleteMyAccount` server fn wipes
  `vault_accounts`, `vault_meta`, `profiles`, avatar object, then calls
  the admin API to remove the `auth.users` row.

## Next feature candidates

Ordered by user value on top of the current vault:

1. ~~**Search + favorites**~~ — DONE.
2. ~~**Recovery sheet**~~ — DONE.
3. ~~**Copy code + auto-clear clipboard**~~ — DONE. `AccountCard`
   schedules a singleton 30 s timer after each copy; on fire it reads
   the clipboard and overwrites only if the value still matches the
   copied code (defensively overwrites when read permission is denied).
   A subtle "next XXX XXX" preview replaces the copy icon during the
   last 5 s of the current window so users can wait for a fresh code.
4. ~~**Bulk import**~~ — DONE. `_authenticated/_locked/vault_.import.tsx`
   with Paste / File-or-image tabs. Parsers in `src/lib/vault-import.ts`
   auto-detect `otpauth://` lists, `otpauth-migration://` (Google
   Authenticator, manual protobuf decode), Aegis plain JSON, and 2FAS
   JSON. Preview stage shows every parsed entry with per-row checkboxes
   (Select/Deselect all), commits selected ones through the existing
   `addAccount` path so each secret is encrypted with the in-memory DEK,
   then toasts the count and returns to `/vault`. Entry point: "Or
   import from another app" link on `/vault/new`.
5. **Encrypted export** — download a passphrase-wrapped `.aegis` file
   that mirrors the DB shape, so users hold their own backup.

Encrypted export is the next pickup.

