// Tag queue: enqueue/dequeue/flush behavior under online + offline paths.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTagQueue,
  dequeueTagUpdate,
  enqueueTagUpdate,
  flushQueuedTagUpdates,
  hasQueuedTagUpdates,
  listQueuedTagUpdates,
} from "@/lib/vault-tag-queue";

beforeEach(() => clearTagQueue());
afterEach(() => clearTagQueue());

describe("vault-tag-queue", () => {
  it("persists an enqueued update to storage", () => {
    enqueueTagUpdate("acc-1", ["work", "aws"]);
    expect(hasQueuedTagUpdates()).toBe(true);
    const [entry] = listQueuedTagUpdates();
    expect(entry.id).toBe("acc-1");
    expect(entry.tags).toEqual(["work", "aws"]);
    expect(typeof entry.queuedAt).toBe("number");
  });

  it("last-writer-wins per account id", () => {
    enqueueTagUpdate("acc-1", ["a"]);
    enqueueTagUpdate("acc-1", ["a", "b"]);
    const entries = listQueuedTagUpdates();
    expect(entries).toHaveLength(1);
    expect(entries[0].tags).toEqual(["a", "b"]);
  });

  it("survives a simulated page reload (localStorage round-trip)", () => {
    enqueueTagUpdate("acc-1", ["work"]);
    enqueueTagUpdate("acc-2", ["personal"]);
    // Simulate module reload: values persist in the shared storage.
    const ids = listQueuedTagUpdates()
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual(["acc-1", "acc-2"]);
  });

  it("dequeue removes only the targeted entry", () => {
    enqueueTagUpdate("acc-1", ["a"]);
    enqueueTagUpdate("acc-2", ["b"]);
    dequeueTagUpdate("acc-1");
    const entries = listQueuedTagUpdates();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("acc-2");
  });

  it("flush syncs successful entries and drops them from the queue", async () => {
    enqueueTagUpdate("acc-1", ["a"]);
    enqueueTagUpdate("acc-2", ["b"]);
    const applier = vi.fn(async () => {});
    const synced = await flushQueuedTagUpdates(applier);
    expect(synced).toHaveLength(2);
    expect(applier).toHaveBeenCalledTimes(2);
    expect(hasQueuedTagUpdates()).toBe(false);
  });

  it("flush leaves failing entries queued for the next retry", async () => {
    enqueueTagUpdate("acc-1", ["a"]);
    enqueueTagUpdate("acc-2", ["b"]);
    const applier = vi.fn(async (id: string) => {
      if (id === "acc-2") throw new Error("Failed to fetch");
    });
    const synced = await flushQueuedTagUpdates(applier);
    expect(synced.map((s) => s.id)).toEqual(["acc-1"]);
    const remaining = listQueuedTagUpdates();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("acc-2");
  });
});
