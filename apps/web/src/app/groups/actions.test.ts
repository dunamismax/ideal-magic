import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archivePlaygroupForViewer: vi.fn(),
  createDatabase: vi.fn(),
  createPlaygroupForUser: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  requireServerSession: vi.fn(),
  updatePlaygroupForViewer: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/db/client", () => ({
  createDatabase: mocks.createDatabase,
}));

vi.mock("@/db/queries/playgroups", () => ({
  archivePlaygroupForViewer: mocks.archivePlaygroupForViewer,
  changePlaygroupMemberRoleForViewer: vi.fn(),
  createPlaygroupForUser: mocks.createPlaygroupForUser,
  createPlaygroupInviteForViewer: vi.fn(),
  PlaygroupArchiveAuthorizationError: class PlaygroupArchiveAuthorizationError extends Error {},
  PlaygroupLastOwnerError: class PlaygroupLastOwnerError extends Error {},
  PlaygroupManagementAuthorizationError: class PlaygroupManagementAuthorizationError extends Error {},
  PlaygroupMemberManagementAuthorizationError: class PlaygroupMemberManagementAuthorizationError extends Error {},
  PlaygroupInviteAuthorizationError: class PlaygroupInviteAuthorizationError extends Error {},
  removePlaygroupMemberForViewer: vi.fn(),
  revokePlaygroupInviteForViewer: vi.fn(),
  updatePlaygroupForViewer: mocks.updatePlaygroupForViewer,
}));

vi.mock("@/features/auth/server", () => ({
  requireServerSession: mocks.requireServerSession,
}));

import {
  archiveGroupAction,
  createGroupAction,
  updateGroupAction,
} from "./actions";
import {
  rateLimitPolicies,
  resetMemoryRateLimitStoreForTests,
  setRateLimitStoreForTests,
} from "@/features/security/rate-limit";

describe("group server actions CSRF coverage", () => {
  beforeEach(() => {
    mocks.createDatabase.mockReturnValue({ test: "db" });
    mocks.archivePlaygroupForViewer.mockResolvedValue(undefined);
    mocks.createPlaygroupForUser.mockResolvedValue(undefined);
    mocks.updatePlaygroupForViewer.mockResolvedValue(undefined);
    mocks.headers.mockResolvedValue(
      new Headers({ origin: "https://pod-tracker.example.test" }),
    );
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
    mocks.requireServerSession.mockResolvedValue({
      user: { id: "user-1", name: "Stephen" },
    });
    vi.stubEnv("BETTER_AUTH_URL", "https://pod-tracker.example.test");
  });

  afterEach(() => {
    vi.clearAllMocks();
    setRateLimitStoreForTests(null);
    resetMemoryRateLimitStoreForTests();
    vi.unstubAllEnvs();
  });

  test("allows a trusted same-origin group creation write", async () => {
    const formData = new FormData();
    formData.set("name", "Friday Commander");
    formData.set("description", "Weekly games");

    await expect(
      createGroupAction(
        {
          message: null,
          fieldErrors: {},
          fields: { name: "", description: "" },
        },
        formData,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/groups");

    expect(mocks.requireServerSession).toHaveBeenCalledWith("/groups");
    expect(mocks.createPlaygroupForUser).toHaveBeenCalledWith(
      { test: "db" },
      {
        userId: "user-1",
        ownerDisplayName: "Stephen",
        name: "Friday Commander",
        description: "Weekly games",
        slugBase: "friday-commander",
      },
    );
  });

  test("rejects a cross-origin group creation write before auth or database work", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({ origin: "https://evil.example.test" }),
    );
    const formData = new FormData();
    formData.set("name", "Friday Commander");

    await expect(
      createGroupAction(
        {
          message: null,
          fieldErrors: {},
          fields: { name: "", description: "" },
        },
        formData,
      ),
    ).rejects.toThrow("Request origin is not allowed");

    expect(mocks.requireServerSession).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();
    expect(mocks.createPlaygroupForUser).not.toHaveBeenCalled();
  });

  test("rejects an over-limit group creation write before auth or database work", async () => {
    setRateLimitStoreForTests({
      hit: vi.fn().mockResolvedValue({
        count: rateLimitPolicies.write.max + 1,
        ttlSeconds: 22,
      }),
    });
    const formData = new FormData();
    formData.set("name", "Friday Commander");

    await expect(
      createGroupAction(
        {
          message: null,
          fieldErrors: {},
          fields: { name: "", description: "" },
        },
        formData,
      ),
    ).rejects.toThrow("Too many requests");

    expect(mocks.requireServerSession).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();
    expect(mocks.createPlaygroupForUser).not.toHaveBeenCalled();
  });

  test("allows a trusted same-origin group update write", async () => {
    const formData = new FormData();
    formData.set("playgroupId", "20000000-0000-4000-8000-000000000001");
    formData.set("name", "Renamed Commander");
    formData.set("description", "Updated note");

    await expect(
      updateGroupAction(
        {
          message: null,
          saved: false,
          fieldErrors: {},
          fields: {
            playgroupId: "20000000-0000-4000-8000-000000000001",
            name: "Old",
            description: "",
          },
        },
        formData,
      ),
    ).resolves.toMatchObject({
      message: "Group updated.",
      saved: true,
      fieldErrors: {},
    });

    expect(mocks.updatePlaygroupForViewer).toHaveBeenCalledWith(
      { test: "db" },
      {
        viewerUserId: "user-1",
        playgroupId: "20000000-0000-4000-8000-000000000001",
        name: "Renamed Commander",
        description: "Updated note",
      },
    );
  });

  test("allows a trusted same-origin group archive write", async () => {
    const formData = new FormData();
    formData.set("playgroupId", "20000000-0000-4000-8000-000000000001");

    await expect(
      archiveGroupAction(
        {
          message: null,
          saved: false,
          fieldErrors: {},
          fields: {
            playgroupId: "20000000-0000-4000-8000-000000000001",
          },
        },
        formData,
      ),
    ).resolves.toMatchObject({
      message: "Group archived.",
      saved: true,
      fieldErrors: {},
    });

    expect(mocks.archivePlaygroupForViewer).toHaveBeenCalledWith(
      { test: "db" },
      {
        viewerUserId: "user-1",
        playgroupId: "20000000-0000-4000-8000-000000000001",
      },
    );
  });
});
