// Phase 13.1 — vault sharing high-level API.
//
// End-to-end flow (owner → recipient):
//   1. owner: shareAccountByEmail(accountId, "friend@example.com")
//      → RPC find_user_by_email → recipient's X25519 pubkey
//      → decrypt account secret locally with owner DEK
//      → seal secret to recipient pubkey → insert vault_shares row
//   2. recipient (any device, once unlocked): listIncomingShares()
//      → decrypts sealed secret with their X25519 private key (from
//        ensureUserKeys) → renders codes read-only
//   3. owner: revokeShare(shareId)
//      → deletes row, sets vault_accounts.needs_rotation = true
//      → next time owner opens that account we prompt them to rotate at
//        the source site (TOTP secrets are one-way; only the site can mint
//        a new one).
//
// Server never sees plaintext. RLS enforces owner-only writes, recipient
// sees only non-revoked rows.

import { supabase } from "@/integrations/supabase/client";
import { getVaultKey } from "@/lib/vault-session";
import {
  buildAccountAad,
  decryptSecret,
  toBytes,
  toByteaHex,
} from "@/lib/vault-crypto";
import {
  ensureUserKeys,
  openSharedSecret,
  sealForRecipient,
  type UserKeyMaterial,
} from "@/lib/vault-sharing-crypto";

export interface RecipientLookup {
  userId: string;
  x25519PublicKey: Uint8Array;
  ed25519PublicKey: Uint8Array;
}

export interface OutgoingShare {
  id: string;
  accountId: string;
  recipientUserId: string;
  issuer: string;
  label: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface IncomingShare {
  id: string;
  accountId: string;
  ownerUserId: string;
  issuer: string;
  label: string;
  algorithm: string;
  digits: number;
  period: number;
  otpType: string;
  secret: string; // decrypted plaintext, held in memory only
  createdAt: string;
}

/* ---------------- recipient lookup ---------------- */

export async function findRecipientByEmail(
  email: string,
): Promise<RecipientLookup | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const { data, error } = await supabase.rpc("find_user_by_email", {
    _email: trimmed,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    userId: row.user_id,
    x25519PublicKey: toBytes(row.x25519_public_key),
    ed25519PublicKey: toBytes(row.ed25519_public_key),
  };
}

/* ---------------- share an account ---------------- */

interface AccountRow {
  id: string;
  user_id: string;
  issuer: string;
  label: string;
  algorithm: string;
  digits: number;
  period: number;
  otp_type: string;
  secret_ciphertext: unknown;
  secret_iv: unknown;
  crypto_version: number | null;
}

export async function shareAccountByEmail(
  accountId: string,
  recipientEmail: string,
): Promise<{ shareId: string }> {
  const dek = getVaultKey();
  if (!dek) throw new Error("Vault is locked.");
  const {
    data: userRes,
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw new Error("Not signed in.");
  const ownerId = userRes.user.id;

  const recipient = await findRecipientByEmail(recipientEmail);
  if (!recipient) {
    throw new Error(
      "No Aegis user with that email has set up sharing yet. Ask them to sign in and unlock their vault.",
    );
  }
  if (recipient.userId === ownerId) {
    throw new Error("You can't share an account with yourself.");
  }

  // Pull the account row + decrypt secret locally.
  const { data: acctData, error: acctErr } = await supabase
    .from("vault_accounts")
    .select(
      "id, user_id, issuer, label, algorithm, digits, period, otp_type, secret_ciphertext, secret_iv, crypto_version",
    )
    .eq("id", accountId)
    .single();
  if (acctErr) throw acctErr;
  const acct = acctData as AccountRow;
  if (acct.user_id !== ownerId) throw new Error("You don't own this account.");

  const aad =
    (acct.crypto_version ?? 2) >= 3
      ? buildAccountAad(ownerId, acct.id)
      : undefined;
  const plaintextSecret = await decryptSecret(
    dek,
    toBytes(acct.secret_ciphertext),
    toBytes(acct.secret_iv),
    aad,
  );

  const sealed = await sealForRecipient(
    plaintextSecret,
    recipient.x25519PublicKey,
    ownerId,
    recipient.userId,
    acct.id,
  );

  const { data: inserted, error: insErr } = await supabase
    .from("vault_shares")
    .insert({
      account_id: acct.id,
      owner_user_id: ownerId,
      recipient_user_id: recipient.userId,
      ephemeral_public_key: toByteaHex(sealed.ephemeralPublicKey),
      sealed_ciphertext: toByteaHex(sealed.ciphertext),
      sealed_iv: toByteaHex(sealed.iv),
      issuer_snapshot: acct.issuer,
      label_snapshot: acct.label,
      algorithm_snapshot: acct.algorithm,
      digits_snapshot: acct.digits,
      period_snapshot: acct.period,
      otp_type_snapshot: acct.otp_type,
    })
    .select("id")
    .single();
  if (insErr) {
    if (insErr.code === "23505") {
      throw new Error("You've already shared this account with that person.");
    }
    throw insErr;
  }
  return { shareId: inserted.id };
}

/* ---------------- listings ---------------- */

export async function listOutgoingShares(): Promise<OutgoingShare[]> {
  const {
    data: userRes,
  } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("vault_shares")
    .select(
      "id, account_id, recipient_user_id, issuer_snapshot, label_snapshot, created_at, revoked_at",
    )
    .eq("owner_user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    accountId: r.account_id,
    recipientUserId: r.recipient_user_id,
    issuer: r.issuer_snapshot ?? "",
    label: r.label_snapshot ?? "",
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

export async function listIncomingShares(
  keys: UserKeyMaterial,
): Promise<IncomingShare[]> {
  const {
    data: userRes,
  } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("vault_shares")
    .select(
      "id, account_id, owner_user_id, ephemeral_public_key, sealed_ciphertext, sealed_iv, issuer_snapshot, label_snapshot, algorithm_snapshot, digits_snapshot, period_snapshot, otp_type_snapshot, created_at",
    )
    .eq("recipient_user_id", uid)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const out: IncomingShare[] = [];
  for (const row of data ?? []) {
    try {
      const secret = await openSharedSecret(
        {
          ephemeralPublicKey: toBytes(row.ephemeral_public_key),
          ciphertext: toBytes(row.sealed_ciphertext),
          iv: toBytes(row.sealed_iv),
        },
        keys.x25519Private,
        keys.x25519Public,
        row.owner_user_id,
        uid,
        row.account_id,
      );
      out.push({
        id: row.id,
        accountId: row.account_id,
        ownerUserId: row.owner_user_id,
        issuer: row.issuer_snapshot ?? "",
        label: row.label_snapshot ?? "",
        algorithm: row.algorithm_snapshot ?? "SHA1",
        digits: row.digits_snapshot ?? 6,
        period: row.period_snapshot ?? 30,
        otpType: row.otp_type_snapshot ?? "totp",
        secret,
        createdAt: row.created_at,
      });
    } catch (err) {
      // A single tampered/corrupt share row shouldn't hide the rest.
      console.warn("[vault-sharing] failed to open share", row.id, err);
    }
  }
  return out;
}

/* ---------------- revocation ---------------- */

/**
 * Revoke a share and flag the underlying account so the UI can prompt the
 * owner to rotate the TOTP secret at the source site. We soft-delete
 * (`revoked_at = now()`) rather than DELETE so the row is still visible in
 * the owner's audit view.
 */
export async function revokeShare(shareId: string): Promise<void> {
  const {
    data: userRes,
  } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const { data: shareRow, error: readErr } = await supabase
    .from("vault_shares")
    .select("account_id, owner_user_id")
    .eq("id", shareId)
    .single();
  if (readErr) throw readErr;
  if (shareRow.owner_user_id !== uid) {
    throw new Error("Only the owner can revoke this share.");
  }

  const { error: updShare } = await supabase
    .from("vault_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId);
  if (updShare) throw updShare;

  // Best-effort: mark the account for rotation. Failure here doesn't
  // reverse the revoke; owner will still see the flag next sync.
  const { error: updAcct } = await supabase
    .from("vault_accounts")
    .update({ needs_rotation: true })
    .eq("id", shareRow.account_id);
  if (updAcct) console.warn("[vault-sharing] needs_rotation flag failed", updAcct);
}

/**
 * Clear the rotation flag after the owner confirms they've rotated the
 * secret at the source site (or dismissed the reminder).
 */
export async function clearNeedsRotation(accountId: string): Promise<void> {
  const { error } = await supabase
    .from("vault_accounts")
    .update({ needs_rotation: false })
    .eq("id", accountId);
  if (error) throw error;
}

export { ensureUserKeys } from "@/lib/vault-sharing-crypto";
export type { UserKeyMaterial } from "@/lib/vault-sharing-crypto";
