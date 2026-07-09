# Phase 12 — Crypto v2 রিলিজ নোট

**রিলিজ তারিখ:** 2026-07-09
**স্কোপ:** ভল্টের KDF আপগ্রেড (PBKDF2 → Argon2id) এবং প্রতি-রো ciphertext-এ Authenticated Additional Data (AAD) বাইন্ডিং।

---

## এক নজরে

Aegis-এর ক্লায়েন্ট-সাইড ক্রিপ্টো স্ট্যাক এখন **Argon2id** KDF (v2) ব্যবহার করে এবং প্রতিটি নতুন ভল্ট রো **AES-GCM AAD** দিয়ে বাইন্ড করা হয় `utf8(user_id|account_id)`-এর সাথে (row crypto v3)। DEK পরিবর্তন হয় না — শুধু পাসফ্রেজ-উপরের KEK এবং প্রতিটি রো-এর ciphertext খাম আপগ্রেড হয়। বিদ্যমান v1/v2 রো ব্যাকগ্রাউন্ড মাইগ্রেটর দ্বারা স্বচ্ছভাবে আপগ্রেড হয় — কোনো ডাউনটাইম বা ইউজার অ্যাকশন লাগে না।

---

## 12.1 — `VAULT_CRYPTO_VERSION = 2` + AAD (`[P1]` ✅)

### KDF আপগ্রেড: PBKDF2 → Argon2id
- **নতুন ডিফল্ট:** `argon2id-m19456-t2-p1` (memory 19 MiB, iterations 2, parallelism 1) — `hash-wasm` এর মাধ্যমে।
- **প্যারামিটার যুক্তি:** OWASP 2024-এর mobile-friendly প্রোফাইল; পুরনো ফোনেও OOM ছাড়া চলে, GPU ব্রুট-ফোর্স-এর বিরুদ্ধে PBKDF2-600k-এর চেয়ে অনেক শক্তিশালী।
- **ভার্সনিং কন্ট্রাক্ট:** algorithm string ডাটাবেসে সংরক্ষিত (`kdf_algorithm` কলাম)। ভবিষ্যতে re-tune করলে নতুন string মিন্ট হবে (যেমন `argon2id-m65536-t3-p1`) — বিদ্যমান string-এর অর্থ কখনো পরিবর্তন হবে না।
- **v1 (PBKDF2-SHA256-600k) এখনো readable** — Phase 12 ছয় মাস পর্যন্ত v1 ব্রাঞ্চ ট্রি-তে রাখবে।

### AES-GCM AAD (row crypto v3)
- প্রতিটি নতুন `vault_accounts` রো encrypt হয় `additionalData = utf8("{user_id}|{account_id}")` দিয়ে।
- `vault_accounts.crypto_version` কলাম (smallint, default 2) row-level envelope trace করে:
  - `v2` — legacy: AES-GCM, no AAD (read-compat only)
  - `v3` — current default: AES-GCM + AAD
- Read path row-এর `crypto_version` দেখে সঠিক AAD (বা কিছুই না) ব্যবহার করে — mixed-version ভল্টে ঝামেলা নেই।

---

## 12.2 — ব্যাকগ্রাউন্ড re-encrypt মাইগ্রেটর (`[P1]` ✅)

### `src/lib/vault-migrator.ts` — `runV3Migration(userId, dek)`
- **কখন ট্রিগার হয়:** সফল unlock (পাসওয়ার্ড বা biometric) এর পরে `lock.tsx` fire-and-forget কল করে — router transition ব্লক হয় না।
- **ব্যাচিং:** 10 rows/round-trip; `WHERE crypto_version < 3` কোয়েরি পুনরায় চালানো হয়, তাই মিড-মাইগ্রেশনে ট্যাব বন্ধ হলে পরের unlock resume করে।
- **Idempotent:** ইতিমধ্যেই v3 rows skip হয়, শুধু একটি ছোট count-স্টাইল কোয়েরি খরচ হয়।
- **Serialized per user:** in-flight `Set` guard একই ইউজারের জন্য দুটি কনকারেন্ট রান আটকায়।
- **DEK অপরিবর্তিত:** শুধু per-row ciphertext খাম বদলায় — কোনো TOTP/HOTP secret লস হয় না।
- **HOTP counter:** counter ciphertext-ও একই AAD দিয়ে re-encrypt হয়; corrupt counter থাকলে secret তবু আপগ্রেড হয়, counter পরের successful advance-এ ঠিক হয়।

---

## 12.3 — মাইগ্রেশন টেলিমেট্রি (`[P1]` ✅)

- মাইগ্রেশন শেষে একটি `client_errors` রো insert হয়:
  - `route = 'vault-migrator'`
  - `message` — human-readable summary: `vault-migrator v2->v3 OK · rows=N elapsed_ms=M` (বা failure হলে error সহ)
- কোনো `rows_migrated` না থাকলে টেলিমেট্রি skip হয় (নয়েজ কমাতে)।
- Best-effort — telemetry failure user-facing error হয় না।

---

## নিরাপত্তা প্রভাব (AAD-এর কারণে যা এখন আটকে যায়)

| Attack | v2 (AAD-বিহীন) আচরণ | v3 (AAD-সহ) আচরণ |
|---|---|---|
| **Row-swap** — DB-তে row A-এর ciphertext row B-তে কপি করা | Silently decrypt হতো — B-এর secret এখন A-এর secret দেখাত | AES-GCM tag verification **fail** — decrypt reject |
| **Cross-user swap** — attacker user X-এর ciphertext user Y-এর রো-তে বসায় | Silently decrypt হতো (একই DEK শেয়ার না করলেও attacker-এর নিজস্ব vault-এ সম্ভব ছিল) | Tag fail — user_id AAD-তে থাকে |
| **Ciphertext tamper** | AES-GCM tag ইতিমধ্যেই আটকাত | অপরিবর্তিত — এখনো আটকে যায় |
| **KDF ব্রুট-ফোর্স (GPU)** | PBKDF2-600k তুলনামূলক দুর্বল | Argon2id 19 MiB memory-hard — GPU/ASIC-এ কয়েক অর্ডার-অফ-ম্যাগনিটিউড ধীর |

**যা অপরিবর্তিত:** DEK এখনো non-extractable, শুধুমাত্র সেশনে থাকে। সার্ভার প্লেইনটেক্সট secret কখনো দেখে না। AAD সার্ভারে সঞ্চিত নয় — read-time-এ `user_id | account_id` থেকে reconstruct হয়।

---

## Compatibility ও Rollout

- **প্রথম unlock:** যেকোনো ইউজার আপডেটেড ক্লায়েন্টে unlock করলে:
  1. v1 হলে KEK v2-তে auto-upgrade (`upgradeKdfToV2`)
  2. v2 rows ব্যাকগ্রাউন্ডে v3-তে re-encrypt
- **পুরনো ক্লায়েন্ট এখনো কাজ করে:** v3 rows পুরনো ক্লায়েন্ট decrypt করতে পারবে না (AAD জানে না) — তাই সব ডিভাইসে আপডেট রোল-আউট হওয়ার পর user-visible impact দেখা যেতে পারে যদি ইউজার অনেক পুরনো একটি ইনস্টল থেকে unlock করে। রিকমেন্ডেশন: PWA অটো-আপডেট নিশ্চিত করুন।
- **পারফরম্যান্স বেঞ্চমার্ক:**
  - Unlock: mid-range Android-এ ≤ 1.5s (Argon2id 19 MiB)
  - Migration: 50 rows ≤ 3s (মিড-রেঞ্জ ডিভাইস, ধারণা)
- **Exit criteria (roadmap):** সব নতুন ভল্ট v2 KDF; 95% সক্রিয় ভল্ট 30 দিনের মধ্যে v3 rows-এ মাইগ্রেট।

---

## পরিবর্তিত ফাইল

- `src/lib/vault-crypto.ts` — Argon2id, AAD-aware `encryptSecret`/`decryptSecret`, `buildAccountAad`
- `src/lib/vault-accounts.ts` — write path v3 emit, read path version-aware AAD dispatch, `addAccount` client-side ID generation
- `src/lib/vault-outbox.ts` — outbox flush AAD-aware
- `src/lib/vault-migrator.ts` — **নতুন** ব্যাকগ্রাউন্ড মাইগ্রেটর
- `src/routes/_authenticated/lock.tsx` — unlock success-এ মাইগ্রেটর ট্রিগার
- `src/components/vault/AccountCard.tsx` — HOTP advance path AAD-aware
- `supabase/migrations/…_crypto_version.sql` — `crypto_version` কলাম যোগ
- `tests/crypto/vault-crypto.roundtrip.spec.mjs` — 9টি নতুন AAD টেস্ট
- `src/lib/__tests__/vault-migrator.e2e.test.ts` — **নতুন** end-to-end মাইগ্রেটর টেস্ট

---

## টেস্টিং

- ✅ Vitest: 127/127 pass (নতুন migrator E2E সহ)
- ✅ `node --test tests/crypto/vault-crypto.roundtrip.spec.mjs` — AAD roundtrip + tamper rejection
- ✅ Manual: v2 fixture থেকে unlock → migrator চলে → রো v3, tamper reject

---

## Known Limitations / পরবর্তী কাজ

- মাইগ্রেশন প্রোগ্রেস UI-তে expose করা হয়নি — শুধু telemetry-তে যায়। প্রয়োজনে Phase 12.4-এ toast/badge যোগ করা যেতে পারে।
- v1 → v2 KEK আপগ্রেডের সময় full migration ছয় মাস পরে v1 পুরোপুরি remove — সেই ক্লিনআপ Phase 13-এর সাথে ট্র্যাক করা।
