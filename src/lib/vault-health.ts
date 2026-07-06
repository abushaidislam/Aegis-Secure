// Phase 9.3 — Vault health.
//
// All checks run on the client against already-decrypted accounts. The
// duplicate-detection pass hashes each base32 secret (SHA-256) so the raw
// secret never leaves the local scope of computeVaultHealth() and is not
// retained on any finding object.
//
// Optional HIBP lookup uses the k-anonymity range endpoint. We hash the
// issuer domain (SHA-1), send only the first 5 hex chars, and match the
// full hash against returned suffixes locally — the domain itself never
// crosses the wire in full.

import type { DecryptedAccount } from "@/lib/vault-accounts";
import { domainFromIssuer, logoUrlFor } from "@/lib/issuer-domain";

export type HealthSeverity = "warn" | "info";

export interface DuplicateFinding {
  kind: "duplicate";
  severity: HealthSeverity;
  /** Anonymised group id (short prefix of the secret hash). */
  groupId: string;
  accountIds: string[];
  /** Issuer/label pairs for user-facing display. */
  labels: { id: string; issuer: string; label: string }[];
}

export interface MissingIconFinding {
  kind: "missing_icon";
  severity: HealthSeverity;
  accountId: string;
  issuer: string;
  label: string;
}

export interface WeakFavoriteFinding {
  kind: "weak_favorite";
  severity: HealthSeverity;
  accountId: string;
  issuer: string;
  label: string;
  reason: "no_domain" | "no_icon";
}

export type HealthFinding =
  | DuplicateFinding
  | MissingIconFinding
  | WeakFavoriteFinding;

export interface VaultHealthReport {
  scannedAt: number;
  totalAccounts: number;
  duplicates: DuplicateFinding[];
  missingIcons: MissingIconFinding[];
  weakFavorites: WeakFavoriteFinding[];
  /** 0–100. 100 = no findings. */
  score: number;
}

/**
 * Hash a UTF-8 string with SHA-256, return hex.
 * Used to fingerprint decrypted secrets without keeping the plaintext.
 */
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex.toUpperCase();
}

function normalizeSecret(base32: string): string {
  // Collapse whitespace and case so trivial formatting differences don't
  // hide real duplicates.
  return base32.replace(/\s+/g, "").toUpperCase();
}

export async function computeVaultHealth(
  accounts: DecryptedAccount[],
): Promise<VaultHealthReport> {
  const now = Date.now();
  const total = accounts.length;

  // ---------- Duplicates ----------
  // Hash each secret, group by full hash. Then anonymise the group id to
  // a short prefix for display. The full hash is dropped after grouping.
  const hashByAccount = new Map<string, string>();
  await Promise.all(
    accounts.map(async (a) => {
      const norm = normalizeSecret(a.secret);
      if (!norm) return;
      hashByAccount.set(a.id, await sha256Hex(norm));
    }),
  );
  const groups = new Map<string, DecryptedAccount[]>();
  for (const a of accounts) {
    const h = hashByAccount.get(a.id);
    if (!h) continue;
    const list = groups.get(h) ?? [];
    list.push(a);
    groups.set(h, list);
  }
  const duplicates: DuplicateFinding[] = [];
  for (const [hash, group] of groups) {
    if (group.length < 2) continue;
    duplicates.push({
      kind: "duplicate",
      severity: "warn",
      groupId: hash.slice(0, 8),
      accountIds: group.map((a) => a.id),
      labels: group.map((a) => ({ id: a.id, issuer: a.issuer, label: a.label })),
    });
  }

  // ---------- Missing icons ----------
  // "Missing icon" = no resolvable Logo.dev URL (no domain mapping and
  // not a domain-shaped issuer). Purely a visual/quality signal.
  const missingIcons: MissingIconFinding[] = [];
  for (const a of accounts) {
    if (!logoUrlFor(a.issuer)) {
      missingIcons.push({
        kind: "missing_icon",
        severity: "info",
        accountId: a.id,
        issuer: a.issuer,
        label: a.label,
      });
    }
  }

  // ---------- Weak favourites ----------
  // Favouriting an issuer we can't confidently identify (no domain match)
  // is a signal the row may have been added under a nickname — worth a
  // gentle nudge to rename so recovery/audit is unambiguous.
  const weakFavorites: WeakFavoriteFinding[] = [];
  for (const a of accounts) {
    if (!a.is_favorite) continue;
    const domain = domainFromIssuer(a.issuer);
    if (!domain) {
      weakFavorites.push({
        kind: "weak_favorite",
        severity: "warn",
        accountId: a.id,
        issuer: a.issuer,
        label: a.label,
        reason: "no_domain",
      });
    } else if (!logoUrlFor(a.issuer)) {
      weakFavorites.push({
        kind: "weak_favorite",
        severity: "info",
        accountId: a.id,
        issuer: a.issuer,
        label: a.label,
        reason: "no_icon",
      });
    }
  }

  // ---------- Score ----------
  // Simple 0–100 heuristic:
  //   -12 per duplicate group (max hit -60)
  //   -6 per weak favourite (max -30)
  //   -1 per missing icon (max -20)
  let score = 100;
  score -= Math.min(60, duplicates.length * 12);
  score -= Math.min(30, weakFavorites.length * 6);
  score -= Math.min(20, missingIcons.length * 1);
  if (score < 0) score = 0;
  if (total === 0) score = 100;

  return {
    scannedAt: now,
    totalAccounts: total,
    duplicates,
    missingIcons,
    weakFavorites,
    score,
  };
}

// ---------------- Optional HIBP lookup ----------------
//
// The HIBP Pwned Passwords k-anonymity endpoint accepts a 5-char SHA-1
// prefix and returns every suffix it knows plus a count. We reuse it as
// an opt-in signal for issuer domains: hash the domain, send the prefix,
// and locally check whether the domain's full hash appears in the response.
// This is a coarse heuristic — a match means "a string with this hash has
// appeared in a breach corpus", not "this issuer is compromised" — so the
// UI must present it as a hint, never as a verdict.

const HIBP_ENDPOINT = "https://api.pwnedpasswords.com/range/";

export type HibpResult =
  | { status: "match"; count: number }
  | { status: "clean" }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

export async function checkIssuerAgainstHibp(issuer: string): Promise<HibpResult> {
  const domain = domainFromIssuer(issuer);
  if (!domain) return { status: "skipped", reason: "No domain match for this issuer." };

  let fullHash: string;
  try {
    fullHash = await sha1Hex(domain);
  } catch {
    return { status: "error", message: "Could not hash the issuer domain locally." };
  }
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);

  let res: Response;
  try {
    res = await fetch(`${HIBP_ENDPOINT}${prefix}`, {
      method: "GET",
      // Add-Padding hides the exact response size from network observers.
      headers: { "Add-Padding": "true" },
    });
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Network request failed.",
    };
  }
  if (!res.ok) {
    return { status: "error", message: `HIBP responded ${res.status}` };
  }
  const body = await res.text();
  for (const line of body.split(/\r?\n/)) {
    const [suf, countStr] = line.split(":");
    if (!suf) continue;
    if (suf.trim().toUpperCase() === suffix) {
      const count = Number.parseInt((countStr ?? "0").trim(), 10);
      return {
        status: "match",
        count: Number.isFinite(count) ? count : 0,
      };
    }
  }
  return { status: "clean" };
}
