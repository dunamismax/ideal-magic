import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  createPlaygroupForUser: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  requireServerSession: vi.fn(),
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
  changePlaygroupMemberRoleForViewer: vi.fn(),
  createPlaygroupForUser: mocks.createPlaygroupForUser,
  createPlaygroupInviteForViewer: vi.fn(),
  PlaygroupLastOwnerError: class PlaygroupLastOwnerError extends Error {},
  PlaygroupMemberManagementAuthorizationError: class PlaygroupMemberManagementAuthorizationError extends Error {},
  PlaygroupInviteAuthorizationError: class PlaygroupInviteAuthorizationError extends Error {},
  removePlaygroupMemberForViewer: vi.fn(),
  revokePlaygroupInviteForViewer: vi.fn(),
}));

vi.mock("@/features/auth/server", () => ({
  requireServerSession: mocks.requireServerSession,
}));

import { createGroupAction } from "./actions";

describe("group server actions CSRF coverage", () => {
  beforeEach(() => {
    mocks.createDatabase.mockReturnValue({ test: "db" });
    mocks.createPlaygroupForUser.mockResolvedValue(undefined);
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
});
