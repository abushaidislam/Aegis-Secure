// Phase 13.1 — vault sharing crypto roundtrip.
//
// Verifies:
//   • sealForRecipient / openSharedSecret roundtrip with the intended pubkey
//   • wrong recipient private key fails (cross-user rejection)
//   • tampered AAD (swap owner / recipient / account id) fails
//   • tampered ciphertext fails via AES-GCM tag
//   • ephemeral pubkey uniqueness across seals

import { describe, expect, it } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";
import {
  openSharedSecret,
  sealForRecipient,
} from "@/lib/vault-sharing-crypto";

function keypair() {
  const priv = x25519.utils.randomSecretKey();
  const pub = x25519.getPublicKey(priv);
  return { priv, pub };
}

describe("vault-sharing crypto roundtrip", () => {
  const ownerId = "11111111-1111-1111-1111-111111111111";
  const recipientId = "22222222-2222-2222-2222-222222222222";
  const otherId = "33333333-3333-3333-3333-333333333333";
  const accountId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const secret = "JBSWY3DPEHPK3PXP";

  it("recipient opens what owner sealed", async () => {
    const recipient = keypair();
    const sealed = await sealForRecipient(
      secret,
      recipient.pub,
      ownerId,
      recipientId,
      accountId,
    );
    const restored = await openSharedSecret(
      sealed,
      recipient.priv,
      recipient.pub,
      ownerId,
      recipientId,
      accountId,
    );
    expect(restored).toBe(secret);
    // Ephemeral pub must be 32 bytes and NOT equal to recipient's pub.
    expect(sealed.ephemeralPublicKey).toHaveLength(32);
    expect(Buffer.compare(sealed.ephemeralPublicKey, recipient.pub)).not.toBe(0);
  });

  it("wrong recipient private key cannot open the share", async () => {
    const recipient = keypair();
    const attacker = keypair();
    const sealed = await sealForRecipient(
      secret,
      recipient.pub,
      ownerId,
      recipientId,
      accountId,
    );
    await expect(
      openSharedSecret(
        sealed,
        attacker.priv,
        recipient.pub,
        ownerId,
        recipientId,
        accountId,
      ),
    ).rejects.toBeDefined();
  });

  it("swapping recipient id in AAD is rejected", async () => {
    const recipient = keypair();
    const sealed = await sealForRecipient(
      secret,
      recipient.pub,
      ownerId,
      recipientId,
      accountId,
    );
    await expect(
      openSharedSecret(
        sealed,
        recipient.priv,
        recipient.pub,
        ownerId,
        otherId, // wrong recipient id
        accountId,
      ),
    ).rejects.toBeDefined();
  });

  it("swapping account id in AAD is rejected (row-swap protection)", async () => {
    const recipient = keypair();
    const sealed = await sealForRecipient(
      secret,
      recipient.pub,
      ownerId,
      recipientId,
      accountId,
    );
    await expect(
      openSharedSecret(
        sealed,
        recipient.priv,
        recipient.pub,
        ownerId,
        recipientId,
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      ),
    ).rejects.toBeDefined();
  });

  it("tampering the ciphertext fails AES-GCM tag", async () => {
    const recipient = keypair();
    const sealed = await sealForRecipient(
      secret,
      recipient.pub,
      ownerId,
      recipientId,
      accountId,
    );
    sealed.ciphertext[0] ^= 0xff;
    await expect(
      openSharedSecret(
        sealed,
        recipient.priv,
        recipient.pub,
        ownerId,
        recipientId,
        accountId,
      ),
    ).rejects.toBeDefined();
  });

  it("each seal generates a fresh ephemeral pubkey", async () => {
    const recipient = keypair();
    const a = await sealForRecipient(secret, recipient.pub, ownerId, recipientId, accountId);
    const b = await sealForRecipient(secret, recipient.pub, ownerId, recipientId, accountId);
    expect(Buffer.compare(a.ephemeralPublicKey, b.ephemeralPublicKey)).not.toBe(0);
  });
});
