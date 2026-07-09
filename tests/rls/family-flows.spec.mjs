// Phase 13.2 RLS/edge-case coverage for the Family Plan flows.
//
// This spec pins the invariants that must hold for family invite
// accept / decline / revoke and the 6-member cap, from the perspective
// of an unauthenticated Data API caller. Signed-in happy-paths are
// covered by the client-library types + the DB triggers themselves;
// here we assert the security boundary is intact.
//
// Run: node --test tests/rls/family-flows.spec.mjs
// Env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (publishable only).

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
  console.warn("[rls/family] VITE_SUPABASE_URL / PUBLISHABLE_KEY missing — skipping");
  process.exit(0);
}

const anon = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});

const ZERO = "00000000-0000-0000-0000-000000000000";

// --- Read isolation ---------------------------------------------------------
// Anon must never see rows on any family-scoped table. Empty array OR
// explicit permission error are both acceptable; a returned row = fail.
const FAMILY_TABLES = [
  "families",
  "family_members",
  "family_invites",
  "family_shared_accounts",
];

for (const table of FAMILY_TABLES) {
  test(`anon SELECT on ${table} returns no rows`, async () => {
    const { data, error } = await anon.from(table).select("*").limit(1);
    if (error) return; // explicit deny is fine
    assert.deepEqual(data, [], `${table} leaked rows to anon`);
  });
}

// --- Invite lifecycle: accept / decline / revoke ---------------------------
// All three of these are UPDATE / DELETE against family_invites. An
// unauthenticated caller must be rejected (RLS deny → error) OR the
// update must silently match zero rows (data === []). Any successful
// mutation with a returned row = broken RLS.

test("anon cannot ACCEPT a family invite", async () => {
  const { data, error } = await anon
    .from("family_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", ZERO)
    .select();
  if (error) return;
  assert.deepEqual(data, [], "accept path leaked write to anon");
});

test("anon cannot DECLINE a family invite", async () => {
  const { data, error } = await anon
    .from("family_invites")
    .update({ declined_at: new Date().toISOString() })
    .eq("id", ZERO)
    .select();
  if (error) return;
  assert.deepEqual(data, [], "decline path leaked write to anon");
});

test("anon cannot REVOKE (delete) a family invite", async () => {
  const { data, error } = await anon
    .from("family_invites")
    .delete()
    .eq("id", ZERO)
    .select();
  if (error) return;
  assert.deepEqual(data, [], "revoke path leaked delete to anon");
});

test("anon cannot INSERT a family invite", async () => {
  const { error } = await anon.from("family_invites").insert({
    family_id: ZERO,
    invited_by: ZERO,
    invited_email: "attacker@example.com",
  });
  assert.ok(error, "anon must not create invites");
});

// --- 6-member cap -----------------------------------------------------------
// The cap is enforced by the enforce_family_member_cap() trigger. Anon
// cannot even reach that trigger — the INSERT must be rejected by RLS
// first. We assert the outer boundary here; the trigger itself is
// exercised via the client library at runtime.

test("anon cannot INSERT into family_members (cap trigger is unreachable)", async () => {
  const { error } = await anon.from("family_members").insert({
    family_id: ZERO,
    user_id: ZERO,
    role: "member",
  });
  assert.ok(error, "anon must not add family members");
});

test("anon cannot DELETE a family_members row (self-removal path)", async () => {
  const { data, error } = await anon
    .from("family_members")
    .delete()
    .eq("user_id", ZERO)
    .select();
  if (error) return;
  assert.deepEqual(data, [], "member removal leaked to anon");
});

// --- RPCs used by the family flow ------------------------------------------
// Both are SECURITY DEFINER but require auth.uid(); anon must be denied.

test("anon cannot call get_family_member_public_keys", async () => {
  const { data, error } = await anon.rpc("get_family_member_public_keys");
  if (error) {
    assert.ok(error, "expected auth error");
    return;
  }
  assert.deepEqual(data, [], "RPC leaked keys to anon");
});

test("anon cannot resolve users via find_user_by_email", async () => {
  const { data, error } = await anon.rpc("find_user_by_email", {
    _email: "victim@example.com",
  });
  if (error) return;
  assert.deepEqual(data, [], "find_user_by_email leaked to anon");
});
