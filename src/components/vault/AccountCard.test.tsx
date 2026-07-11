// @vitest-environment happy-dom
//
// Smoke coverage for AccountCard. The full component fans out into
// generateCode / vault-session / clipboard / share flows — we mock those
// boundaries and assert the surface renders and reacts to the basic
// props (issuer/label/tags/HOTP badge).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Stub the crypto/DB boundary so we don't need an unlocked vault.
vi.mock("@/lib/vault-accounts", async (orig) => {
  const actual = await orig<typeof import("@/lib/vault-accounts")>();
  return {
    ...actual,
    generateCode: vi.fn(async () => "123456"),
    advanceHotpCounter: vi.fn(async () => ({ counter: 1, code: "654321" })),
    setAccountTags: vi.fn(async () => {}),
    updateAccountDetails: vi.fn(async () => {}),
  };
});
vi.mock("@/lib/vault-session", () => ({ getVaultKey: () => ({} as unknown) }));
vi.mock("@/lib/vault-sharing", () => ({ shareAccountByEmail: vi.fn() }));
vi.mock("@/lib/vault-privacy", () => ({ useHideCodes: () => false }));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { _: (id: string) => id } }),
}));

import { AccountCard } from "./AccountCard";
import type { DecryptedAccount } from "@/lib/vault-accounts";

const totp: DecryptedAccount = {
  id: "row-1",
  issuer: "Acme Corp",
  label: "me@acme.test",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  sort_order: 0,
  is_favorite: false,
  tags: ["work"],
  secret: "JBSWY3DPEHPK3PXP",
  otp_type: "totp",
};

const hotp: DecryptedAccount = { ...totp, id: "row-2", otp_type: "hotp", counter: 0 };

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe("AccountCard", () => {
  it("renders issuer and label for a TOTP account", async () => {
    render(<AccountCard account={totp} now={Date.now()} />);
    expect(screen.getByText("Acme Corp")).toBeTruthy();
    expect(screen.getByText("me@acme.test")).toBeTruthy();
  });

  it("shows tag chip when tags are present", async () => {
    render(<AccountCard account={totp} now={Date.now()} />);
    expect(screen.getByText("work")).toBeTruthy();
  });

  it("renders an HOTP account without crashing", async () => {
    render(<AccountCard account={hotp} now={Date.now()} />);
    expect(screen.getByText("Acme Corp")).toBeTruthy();
  });
});
