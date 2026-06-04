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
          memberCount: 2,
          upcomingEventCount: 1,
          members: [
            {
              id: "membership-1",
              displayName: "Riley Chen",
              role: "owner",
              joinedAt: new Date("2026-06-04T00:00:00.000Z"),
            },
            {
              id: "membership-2",
              displayName: "Mina Rules",
              role: "admin",
              joinedAt: new Date("2026-06-05T00:00:00.000Z"),
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
});
