// Phase 1.2 RLS CI test — hits every user-scoped table with an
// unauthenticated Supabase client and asserts either empty result sets
// (RLS filtered everything) or an explicit error. NEVER returns a row.
//
// Run: node --test tests/rls/anonymous-cannot-read.spec.mjs
//
// Env needed: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY.
// These are the publishable (anon) values only — safe to read from .env.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* .env optional */
  }
}
loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn("[rls] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing — skipping");
  process.exit(0);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});

// User-scoped tables: an anon client MUST get either an empty array or
// a permission error. Ever returning a row = broken RLS = fail.
const USER_TABLES = ["profiles", "vault_meta", "vault_accounts"];

for (const table of USER_TABLES) {
  test(`anon SELECT on ${table} returns no rows`, async () => {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      // Explicit deny is fine.
      assert.ok(error, `expected error or empty data on ${table}`);
      return;
    }
    assert.deepEqual(data, [], `${table} leaked rows to anon`);
  });
}

// Admin-only tables must never expose data to anon.
const ADMIN_TABLES = ["admin_audit", "client_errors"];
for (const table of ADMIN_TABLES) {
  test(`anon SELECT on ${table} returns no rows`, async () => {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) return;
    assert.deepEqual(data, [], `${table} leaked rows to anon`);
  });
}

// Feature flags + announcements are readable by authenticated only.
const AUTH_ONLY = ["feature_flags", "announcements"];
for (const table of AUTH_ONLY) {
  test(`anon SELECT on ${table} returns no rows`, async () => {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) return;
    assert.deepEqual(data, [], `${table} leaked rows to anon`);
  });
}

// Writes from anon must be rejected everywhere except client_errors INSERT
// (which is deliberately open — see SECURITY.md).
test("anon INSERT on vault_accounts is rejected", async () => {
  const { error } = await supabase.from("vault_accounts").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    issuer: "x",
    label: "y",
    secret_ciphertext: "\\x00",
    secret_iv: "\\x000000000000000000000000",
  });
  assert.ok(error, "anon must not be able to INSERT into vault_accounts");
});

test("anon INSERT on profiles is rejected", async () => {
  const { error } = await supabase
    .from("profiles")
    .insert({ id: "00000000-0000-0000-0000-000000000000" });
  assert.ok(error, "anon must not be able to INSERT into profiles");
});
