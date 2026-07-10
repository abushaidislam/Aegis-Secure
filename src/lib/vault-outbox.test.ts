// Phase 6.4 — offline outbox tests.
//
// The outbox stores every offline vault mutation (create / delete /
// update-details / favorite) to localStorage, then replays them via
// flushOutbox() when we reconnect. These tests exercise the queue in
// isolation from Supabase.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOutbox,
  dequeueOutbox,
  enqueueCreate,
  enqueueDelete,
  enqueueFavorite,
  enqueueUpdateDetails,
  flushOutbox,
  listOutbox,
  outboxSize,
  type CreatePayload,
  type OutboxAppliers,
} from "./vault-outbox";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
  clearOutbox();
});

afterEach(() => clearOutbox());

const makeAppliers = (overrides: Partial<OutboxAppliers> = {}): OutboxAppliers => ({
  create: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  updateDetails: vi.fn().mockResolvedValue(undefined),
  favorite: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const samplePayload = (over: Partial<CreatePayload> = {}): CreatePayload => ({
  userId: "user-1",
  issuer: "GitHub",
  label: "you@example.com",
  icon_slug: null,
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  tags: [],
  is_favorite: false,
  secret_ciphertext_hex: "\\xdead",
  secret_iv_hex: "\\xbeef",
  ...over,
});

describe("vault-outbox", () => {
  it("enqueue → list → flush round-trip for a delete", async () => {
    enqueueDelete("acc-1");
    expect(outboxSize()).toBe(1);
    expect(listOutbox()[0]).toMatchObject({ kind: "delete", id: "acc-1" });

    const appliers = makeAppliers();
    const flushed = await flushOutbox(appliers);

    expect(appliers.delete).toHaveBeenCalledWith("acc-1");
    expect(appliers.updateDetails).not.toHaveBeenCalled();
    expect(flushed).toHaveLength(1);
    expect(outboxSize()).toBe(0);
  });

  it("enqueue → flush round-trip for an update-details", async () => {
    enqueueUpdateDetails("acc-2", "GitHub", "you@example.com");
    const appliers = makeAppliers();
    await flushOutbox(appliers);
    expect(appliers.updateDetails).toHaveBeenCalledWith("acc-2", "GitHub", "you@example.com");
    expect(outboxSize()).toBe(0);
  });

  it("pending delete supersedes an earlier update-details on the same id", async () => {
    enqueueUpdateDetails("acc-3", "GitHub", "old");
    enqueueDelete("acc-3");
    expect(outboxSize()).toBe(1);
    const appliers = makeAppliers();
    await flushOutbox(appliers);
    expect(appliers.delete).toHaveBeenCalled();
    expect(appliers.updateDetails).not.toHaveBeenCalled();
  });

  it("update-details is dropped when a delete is already queued for that id", async () => {
    enqueueDelete("acc-4");
    enqueueUpdateDetails("acc-4", "X", "y"); // no-op
    const entries = listOutbox();
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("delete");
  });

  it("last-writer-wins for repeated update-details on same id", () => {
    enqueueUpdateDetails("acc-5", "First", "a@x");
    enqueueUpdateDetails("acc-5", "Second", "b@x");
    const entries = listOutbox();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "update-details", issuer: "Second", label: "b@x" });
  });

  it("keeps failed entries in the queue for the next flush (with backoff)", async () => {
    enqueueDelete("acc-6");
    enqueueUpdateDetails("acc-7", "GH", "l");
    const appliers = makeAppliers({
      delete: vi.fn().mockRejectedValue(new Error("network down")),
    });

    const first = await flushOutbox(appliers);
    expect(first).toHaveLength(1); // only the update succeeded
    expect(outboxSize()).toBe(1);  // delete still queued

    // Immediate re-flush is a no-op: backoff hasn't elapsed yet.
    const recovered = makeAppliers();
    const immediate = await flushOutbox(recovered);
    expect(immediate).toHaveLength(0);
    expect(outboxSize()).toBe(1);

    // Force the entry past its retry deadline and re-flush.
    const raw = JSON.parse(localStorage.getItem("aegis.outbox.v1") ?? "[]");
    raw[0].nextRetryAt = 0;
    localStorage.setItem("aegis.outbox.v1", JSON.stringify(raw));
    const second = await flushOutbox(recovered);
    expect(second).toHaveLength(1);
    expect(outboxSize()).toBe(0);
  });

  it("dequeues entries whose server row already vanished (PGRST116)", async () => {
    enqueueDelete("acc-8");
    const appliers = makeAppliers({
      delete: vi.fn().mockRejectedValue({ code: "PGRST116", message: "no rows" }),
    });
    const flushed = await flushOutbox(appliers);
    expect(flushed).toHaveLength(1);
    expect(outboxSize()).toBe(0);
  });

  it("survives a page reload — persists to localStorage", () => {
    enqueueDelete("acc-9");
    enqueueUpdateDetails("acc-10", "Issuer", "Label");
    const raw = localStorage.getItem("aegis.outbox.v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("dequeueOutbox removes every entry for the id", () => {
    enqueueDelete("acc-11");
    enqueueDelete("acc-12");
    dequeueOutbox("acc-11");
    expect(outboxSize()).toBe(1);
    expect(listOutbox()[0].id).toBe("acc-12");
  });

  it("clearOutbox wipes everything", () => {
    enqueueDelete("acc-13");
    enqueueUpdateDetails("acc-14", "x", "y");
    clearOutbox();
    expect(outboxSize()).toBe(0);
    expect(localStorage.getItem("aegis.outbox.v1")).toBeNull();
  });

  // ---- Phase 6.4 additions: create + favorite ----

  it("enqueue → flush round-trip for a create", async () => {
    const payload = samplePayload();
    enqueueCreate("acc-new-1", payload);
    expect(outboxSize()).toBe(1);

    const appliers = makeAppliers();
    await flushOutbox(appliers);
    expect(appliers.create).toHaveBeenCalledWith("acc-new-1", payload);
    expect(outboxSize()).toBe(0);
  });

  it("pending create + delete cancels both — server never sees the row", async () => {
    enqueueCreate("acc-new-2", samplePayload());
    enqueueDelete("acc-new-2");
    expect(outboxSize()).toBe(0);

    const appliers = makeAppliers();
    await flushOutbox(appliers);
    expect(appliers.create).not.toHaveBeenCalled();
    expect(appliers.delete).not.toHaveBeenCalled();
  });

  it("update-details merges into a pending create instead of appending", async () => {
    enqueueCreate("acc-new-3", samplePayload({ issuer: "Old", label: "old@x" }));
    enqueueUpdateDetails("acc-new-3", "New", "new@x");
    expect(outboxSize()).toBe(1);
    const [entry] = listOutbox();
    expect(entry.kind).toBe("create");
    if (entry.kind === "create") {
      expect(entry.payload.issuer).toBe("New");
      expect(entry.payload.label).toBe("new@x");
    }
  });

  it("favorite toggle merges into a pending create", async () => {
    enqueueCreate("acc-new-4", samplePayload({ is_favorite: false }));
    enqueueFavorite("acc-new-4", true);
    expect(outboxSize()).toBe(1);
    const [entry] = listOutbox();
    if (entry.kind === "create") {
      expect(entry.payload.is_favorite).toBe(true);
    } else {
      throw new Error("expected create entry");
    }
  });

  it("last-writer-wins for repeated favorite on same id", () => {
    enqueueFavorite("acc-5f", true);
    enqueueFavorite("acc-5f", false);
    const entries = listOutbox();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "favorite", isFavorite: false });
  });

  it("flush walks create → follow-ups in order for the same id", async () => {
    enqueueCreate("acc-order", samplePayload());
    enqueueFavorite("acc-other", true);
    const calls: string[] = [];
    const appliers = makeAppliers({
      create: vi.fn().mockImplementation(async () => { calls.push("create"); }),
      favorite: vi.fn().mockImplementation(async () => { calls.push("favorite"); }),
    });
    await flushOutbox(appliers);
    expect(calls).toEqual(["create", "favorite"]);
  });
});
