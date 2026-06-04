import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GroupCard } from "./page";

describe("group card", () => {
  it("renders safe member names and roles without private fields", () => {
    render(
      <GroupCard
        group={{
          id: "group-1",
          name: "Friday Pods",
          slug: "friday-pods",
          description: "Bracket-aware pods and rotating hosts.",
          role: "owner",
          canManagePlaygroup: false,
          memberCount: 2,
          upcomingEventCount: 1,
          invites: [],
          members: [
            {
              id: "membership-1",
              displayName: "Riley Chen",
              role: "owner",
              joinedAt: new Date("2026-06-04T00:00:00.000Z"),
              canChangeRole: false,
              canRemove: false,
            },
            {
              id: "membership-2",
              displayName: "Mina Rules",
              role: "admin",
              joinedAt: new Date("2026-06-05T00:00:00.000Z"),
              canChangeRole: false,
              canRemove: false,
            },
          ],
          createdAt: new Date("2026-06-04T00:00:00.000Z"),
          updatedAt: new Date("2026-06-04T00:00:00.000Z"),
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Friday Pods" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Member Directory")).toBeInTheDocument();
    expect(screen.getByText("Riley Chen")).toBeInTheDocument();
    expect(screen.getByText("Mina Rules")).toBeInTheDocument();
    expect(screen.getByText("Joined Jun 4, 2026")).toBeInTheDocument();
    expect(screen.getByText("Joined Jun 5, 2026")).toBeInTheDocument();
    expect(screen.getAllByText("owner")).toHaveLength(2);
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invite/i)).not.toBeInTheDocument();
  });

  it("renders invite metadata for group managers without token values", () => {
    render(
      <GroupCard
        group={{
          id: "group-2",
          name: "Invite Crew",
          slug: "invite-crew",
          description: "",
          role: "admin",
          canManagePlaygroup: true,
          memberCount: 1,
          upcomingEventCount: 0,
          members: [],
          invites: [
            {
              id: "invite-1",
              role: "member",
              usedCount: 0,
              maxUses: null,
              expiresAt: null,
              revokedAt: null,
              createdAt: new Date("2026-06-04T00:00:00.000Z"),
              isActive: true,
            },
            {
              id: "invite-2",
              role: "member",
              usedCount: 1,
              maxUses: null,
              expiresAt: null,
              revokedAt: new Date("2026-06-05T00:00:00.000Z"),
              createdAt: new Date("2026-06-04T00:00:00.000Z"),
              isActive: false,
            },
          ],
          createdAt: new Date("2026-06-04T00:00:00.000Z"),
          updatedAt: new Date("2026-06-04T00:00:00.000Z"),
        }}
      />,
    );

    expect(screen.getByText("Invite Links")).toBeInTheDocument();
    expect(screen.getByText("1 active for Invite Crew")).toBeInTheDocument();
    expect(screen.getByText("Active member invite")).toBeInTheDocument();
    expect(screen.getByText("Revoked member invite")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Invite" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revoke Invite" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tokenHash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invites\/groups\//i)).not.toBeInTheDocument();
  });

  it("renders role and removal controls for manageable members", () => {
    render(
      <GroupCard
        group={{
          id: "group-3",
          name: "Managed Crew",
          slug: "managed-crew",
          description: "",
          role: "owner",
          canManagePlaygroup: true,
          memberCount: 2,
          upcomingEventCount: 0,
          invites: [],
          members: [
            {
              id: "membership-3",
              displayName: "Riley Chen",
              role: "owner",
              joinedAt: new Date("2026-06-04T00:00:00.000Z"),
              canChangeRole: true,
              canRemove: true,
            },
            {
              id: "membership-4",
              displayName: "Mina Rules",
              role: "member",
              joinedAt: new Date("2026-06-05T00:00:00.000Z"),
              canChangeRole: true,
              canRemove: true,
            },
          ],
          createdAt: new Date("2026-06-04T00:00:00.000Z"),
          updatedAt: new Date("2026-06-04T00:00:00.000Z"),
        }}
      />,
    );

    expect(screen.getAllByLabelText("Role")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Save Role" })).toHaveLength(
      2,
    );
    expect(
      screen.getByRole("button", { name: "Remove Riley Chen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Mina Rules" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
  });
});
