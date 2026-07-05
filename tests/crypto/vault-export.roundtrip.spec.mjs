// Round-trip test for the encrypted .avf export format.
// Run with: node --test tests/crypto/vault-export.roundtrip.spec.mjs
import test from "node:test";
import assert from "node:assert/strict";

// Register a TS loader via tsx if invoked; otherwise import the compiled
// module. We invoke through node --import tsx in CI.
const {
  buildEncryptedExport,
  decryptExportedFile,
  serializeExport,
  AVF_FORMAT,
} = await import("../../src/lib/vault-export.ts");

const sampleAccounts = [
  {
    id: "1",
    issuer: "GitHub",
    label: "alice@example.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    sort_order: 0,
    is_favorite: true,
    secret: "JBSWY3DPEHPK3PXP",
  },
  {
    id: "2",
    issuer: "Google",
    label: "bob@example.com",
    algorithm: "SHA256",
    digits: 8,
    period: 60,
    sort_order: 1,
    is_favorite: false,
    secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  },
];

test("build → decrypt round-trips every account", async () => {
  const file = await buildEncryptedExport(sampleAccounts, "correct horse battery staple");
  assert.equal(file.format, AVF_FORMAT);
  assert.equal(file.version, 1);
  assert.equal(file.kdf.algo, "PBKDF2-SHA256-600k");
  assert.equal(file.kdf.iterations, 600_000);

  const restored = await decryptExportedFile(file, "correct horse battery staple");
  assert.equal(restored.length, 2);
  assert.equal(restored[0].secret, "JBSWY3DPEHPK3PXP");
  assert.equal(restored[1].issuer, "Google");
  assert.equal(restored[1].digits, 8);
});

test("wrong passphrase rejects with a friendly error", async () => {
  const file = await buildEncryptedExport(sampleAccounts, "correct horse battery staple");
  await assert.rejects(
    () => decryptExportedFile(file, "wrong passphrase attempt!"),
    /Wrong export passphrase/,
  );
});

test("serialize → JSON parse round-trip is stable", async () => {
  const file = await buildEncryptedExport(sampleAccounts, "another strong pass 42");
  const json = serializeExport(file);
  const parsed = JSON.parse(json);
  const restored = await decryptExportedFile(parsed, "another strong pass 42");
  assert.equal(restored.length, sampleAccounts.length);
});

test("weak export passphrase rejected", async () => {
  await assert.rejects(() => buildEncryptedExport(sampleAccounts, "short"), /at least 10/);
});
