// Encrypted vault export (.avf) — a passphrase-wrapped JSON envelope that
// lets a user hold their own backup outside Lovable Cloud.
//
// The export never contains plaintext TOTP secrets. The whole payload
// (accounts + metadata) is AES-GCM encrypted under a KEK derived from a
// user-picked *export passphrase* (independent from the vault passphrase),
// using the same PBKDF2-SHA256-600k KDF as the live vault (see
// vault-crypto.ts). The export version pins to VAULT_CRYPTO_VERSION so a
// v2 rollout can migrate old exports.

import type { DecryptedAccount } from "@/lib/vault-accounts";
import { randomBytes, VAULT_CRYPTO_VERSION } from "@/lib/vault-crypto";

export const AVF_FORMAT = "aegis-vault-file";
const KDF_ALGO = "PBKDF2-SHA256-600k";
const PBKDF2_ITERATIONS = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface ExportedAccount {
  issuer: string;
  label: string;
  secret: string; // base32
  algorithm: "SHA1" | "SHA256" | "SHA512";
  digits: number;
  period: number;
  otp_type?: "totp" | "hotp" | "steam";
  counter?: number;
}

export interface EncryptedExportFile {
  format: typeof AVF_FORMAT;
  version: number;
  exportedAt: string;
  kdf: {
    algo: string;
    iterations: number;
    salt: string; // hex
  };
  cipher: {
    algo: "AES-GCM";
    iv: string; // hex
    ciphertext: string; // hex
  };
}

function toHex(bytes: Uint8Array): string {
  let h = "";
  for (let i = 0; i < bytes.length; i++) h += bytes[i].toString(16).padStart(2, "0");
  return h;
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("\\x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function deriveExportKek(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function buildEncryptedExport(
  accounts: DecryptedAccount[],
  exportPassphrase: string,
): Promise<EncryptedExportFile> {
  if (exportPassphrase.length < 10) {
    throw new Error("Export passphrase must be at least 10 characters.");
  }
  const payload: { exportedAt: string; accounts: ExportedAccount[] } = {
    exportedAt: new Date().toISOString(),
    accounts: accounts.map((a) => ({
      issuer: a.issuer,
      label: a.label,
      secret: a.secret,
      algorithm: a.algorithm,
      digits: a.digits,
      period: a.period,
      otp_type: a.otp_type,
      ...(a.otp_type === "hotp" ? { counter: a.counter ?? 0 } : {}),
    })),
  };
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await deriveExportKek(exportPassphrase, salt);
  const plaintext = enc.encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    kek,
    plaintext,
  );
  return {
    format: AVF_FORMAT,
    version: VAULT_CRYPTO_VERSION,
    exportedAt: payload.exportedAt,
    kdf: { algo: KDF_ALGO, iterations: PBKDF2_ITERATIONS, salt: toHex(salt) },
    cipher: { algo: "AES-GCM", iv: toHex(iv), ciphertext: toHex(new Uint8Array(ct)) },
  };
}

export async function decryptExportedFile(
  file: EncryptedExportFile,
  exportPassphrase: string,
): Promise<ExportedAccount[]> {
  if (file.format !== AVF_FORMAT) throw new Error("Not an Aegis vault file.");
  if (file.version > VAULT_CRYPTO_VERSION) {
    throw new Error(`Export was written by a newer version (v${file.version}).`);
  }
  if (file.kdf.algo !== KDF_ALGO) throw new Error("Unsupported KDF in export.");
  const salt = fromHex(file.kdf.salt);
  const iv = fromHex(file.cipher.iv);
  const ct = fromHex(file.cipher.ciphertext);
  const kek = await deriveExportKek(exportPassphrase, salt);
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      kek,
      ct as unknown as BufferSource,
    );
  } catch {
    throw new Error("Wrong export passphrase, or the file is corrupted.");
  }
  const parsed = JSON.parse(dec.decode(pt)) as { accounts: ExportedAccount[] };
  return parsed.accounts;
}

export function serializeExport(file: EncryptedExportFile): string {
  return JSON.stringify(file, null, 2);
}

export function downloadExport(file: EncryptedExportFile): void {
  const blob = new Blob([serializeExport(file)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = file.exportedAt.replace(/[:.]/g, "-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `aegis-vault-${stamp}.avf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
