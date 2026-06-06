import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createInitialLifeCounterSession } from "@/features/life/session";
import { LifeCounter } from "./life-counter";
import { syncLinkedLifeCounterSessionAction } from "./linked-session-actions";

vi.mock("./linked-session-actions", () => ({
  syncLinkedLifeCounterSessionAction: vi.fn(),
}));

vi.mock("@/features/life/local-session-store", () => ({
  cleanupSavedLifeCounterSessions: vi.fn(async () => ({
    deletedCount: 0,
    keptActiveCount: 0,
  })),
  countCleanupEligibleLifeCounterSessions: vi.fn(async () => 0),
  loadLifeCounterSession: vi.fn(async () => null),
  saveLifeCounterSession: vi.fn(async () => undefined),
}));

const syncLinkedLifeCounterSessionActionMock = vi.mocked(
  syncLinkedLifeCounterSessionAction,
);

describe("LifeCounter linked server sync", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("surfaces linked snapshot conflicts instead of silently overwriting server state", async () => {
    syncLinkedLifeCounterSessionActionMock.mockResolvedValueOnce({
      ok: false,
      reason: "conflict",
      message:
        "Server snapshot changed after this table loaded. Reload before syncing.",
      serverActionSequence: 2,
      serverUpdatedAt: "2030-06-15T00:00:02.000Z",
    });

    const eventId = "50000000-0000-4000-8000-000000000001";
    const localSessionKey = `linked-life:event:${eventId}`;

    render(
      <LifeCounter
        initialSession={createInitialLifeCounterSession(
          "2030-06-15T00:00:00.000Z",
          {
            id: localSessionKey,
          },
        )}
        linkedSaveEnabled
        linkedSessionSync={{
          kind: "event",
          eventId,
          localSessionKey,
          expectedServerActionSequence: 1,
          expectedServerUpdatedAt: "2030-06-15T00:00:01.000Z",
        }}
        linkedStatusLabel="2 event players imported."
      />,
    );

    await waitFor(() => {
      expect(syncLinkedLifeCounterSessionActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "event",
          eventId,
          localSessionKey,
          expectedServerActionSequence: 1,
          expectedServerUpdatedAt: "2030-06-15T00:00:01.000Z",
        }),
      );
    });

    expect(await screen.findByTestId("life-sync-scope")).toHaveTextContent(
      "Sync conflict - reload",
    );
  });
});
