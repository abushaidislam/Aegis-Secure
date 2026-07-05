// End-to-end style: setAccountTags routes to server on online, queues on
// offline / network failure, and flushPendingTagUpdates drains the queue.
//
// The Supabase client and vault-cache are mocked so tests focus on the
// online/offline branching logic rather than the network transport.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---------------------------------------------------------------

const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const single = vi.fn();
  // eq() → select() → single() chain. Each .from() returns a fresh builder
  // so the spy sees each call independently.
  const builder = () => {
    const b: Record<string, unknown> = {};
    (b as { update: (v: unknown) => typeof b }).update = (v: unknown) => {
      updateSpy(v);
      return b;
    };
    (b as { eq: () => typeof b }).eq = () => b;
    (b as { select: () => typeof b }).select = () => b;
    (b as { single: () => Promise<unknown> }).single = () => single();
    return b;
  };
  return {
    supabase: {
      from: () => builder(),
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
      __singleMock: single,
    },
  };
});

vi.mock("@/lib/vault-cache", () => ({
  isOffline: vi.fn(),
  readVaultCache: vi.fn(async () => null),
  removeFromVaultCache: vi.fn(),
  upsertVaultCache: vi.fn(),
  writeVaultCache: vi.fn(),
}));

// --- Imports (after mocks) -----------------------------------------------

import { supabase } from "@/integrations/supabase/client";
import { isOffline, upsertVaultCache } from "@/lib/vault-cache";
import { flushPendingTagUpdates, setAccountTags } from "@/lib/vault-accounts";
import { clearTagQueue, listQueuedTagUpdates } from "@/lib/vault-tag-queue";

const singleMock = (supabase as unknown as { __singleMock: ReturnType<typeof vi.fn> })
  .__singleMock;

function mockOnline(v: boolean) {
  (isOffline as unknown as ReturnType<typeof vi.fn>).mockReturnValue(!v);
}

function mockServerRow(tags: string[]) {
  singleMock.mockResolvedValueOnce({
    data: {
      id: "acc-1",
      issuer: "GitHub",
      label: "u@e.com",
      icon_slug: null,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      sort_order: 0,
      is_favorite: false,
      tags,
      secret_ciphertext: "\\x00",
      secret_iv: "\\x00",
    },
    error: null,
  });
}

function mockServerError(message: string) {
  singleMock.mockResolvedValueOnce({ data: null, error: { message } });
}

beforeEach(() => {
  updateSpy.mockClear();
  singleMock.mockReset();
  (isOffline as unknown as ReturnType<typeof vi.fn>).mockReset();
  (upsertVaultCache as unknown as ReturnType<typeof vi.fn>).mockClear();
  clearTagQueue();
});
afterEach(() => clearTagQueue());

describe("setAccountTags — online", () => {
  it("writes to the server, mirrors to cache, and returns queued:false", async () => {
    mockOnline(true);
    mockServerRow(["work", "aws"]);
    const result = await setAccountTags("acc-1", ["Work", "AWS"]);
    expect(result).toEqual({ tags: ["work", "aws"], queued: false });
    expect(updateSpy).toHaveBeenCalledWith({ tags: ["work", "aws"] });
    expect(upsertVaultCache).toHaveBeenCalledOnce();
    expect(listQueuedTagUpdates()).toHaveLength(0);
  });

  it("re-throws non-network errors so the UI surfaces them", async () => {
    mockOnline(true);
    mockServerError("permission denied for table vault_accounts");
    await expect(setAccountTags("acc-1", ["x"])).rejects.toMatchObject({
      message: /permission denied/,
    });
    expect(listQueuedTagUpdates()).toHaveLength(0);
  });
});

describe("setAccountTags — offline", () => {
  it("queues the update instead of hitting the server", async () => {
    mockOnline(false);
    const result = await setAccountTags("acc-1", ["Work"]);
    expect(result).toEqual({ tags: ["work"], queued: true });
    expect(updateSpy).not.toHaveBeenCalled();
    const queued = listQueuedTagUpdates();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ id: "acc-1", tags: ["work"] });
  });

  it("queues when the server call throws a network-shaped error", async () => {
    mockOnline(true);
    mockServerError("Failed to fetch");
    const result = await setAccountTags("acc-1", ["work"]);
    expect(result).toEqual({ tags: ["work"], queued: true });
    expect(listQueuedTagUpdates()).toHaveLength(1);
  });
});

describe("flushPendingTagUpdates", () => {
  it("drains the queue when online and replays each update to the server", async () => {
    // Queue two updates while offline.
    mockOnline(false);
    await setAccountTags("acc-1", ["a"]);
    await setAccountTags("acc-2", ["b"]);
    expect(listQueuedTagUpdates()).toHaveLength(2);

    // Come back online: flush should call the server for each.
    mockOnline(true);
    mockServerRow(["a"]);
    mockServerRow(["b"]);
    const synced = await flushPendingTagUpdates();
    expect(synced).toBe(2);
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(listQueuedTagUpdates()).toHaveLength(0);
  });

  it("keeps failing entries in the queue", async () => {
    mockOnline(false);
    await setAccountTags("acc-1", ["a"]);
    await setAccountTags("acc-2", ["b"]);

    mockOnline(true);
    mockServerRow(["a"]);
    mockServerError("Failed to fetch");
    const synced = await flushPendingTagUpdates();
    expect(synced).toBe(1);
    const still = listQueuedTagUpdates();
    expect(still).toHaveLength(1);
    expect(still[0].id).toBe("acc-2");
  });

  it("is a no-op when offline", async () => {
    mockOnline(false);
    await setAccountTags("acc-1", ["a"]);
    // Still offline — should not attempt.
    const synced = await flushPendingTagUpdates();
    expect(synced).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(listQueuedTagUpdates()).toHaveLength(1);
  });
});
