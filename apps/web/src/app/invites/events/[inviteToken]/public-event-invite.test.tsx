import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PublicEventInvite } from "./public-event-invite";

describe("public event invite", () => {
  test("renders only public-safe event details", () => {
    render(
      <PublicEventInvite
        event={{
          id: "event-1",
          title: "Wednesday Commander Night",
          playgroupName: "Example City Commander League",
          dateLabel: "Wednesday, June 10, 2026",
          timeLabel: "11:00 PM UTC",
          locationName: "Example Tabletop Room",
          rsvpCounts: {
            yes: 3,
            maybe: 1,
            no: 1,
            waitlist: 1,
          },
          guestRsvps: 1,
          namedGuests: 1,
          totalResponses: 6,
          expectedPlayers: 5,
          deckDeclarations: 5,
          pods: 1,
          loggedGames: 1,
        }}
      />,
    );

    expect(screen.getByText("Wednesday, June 10, 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Wednesday Commander Night" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Example City Commander League"),
    ).toBeInTheDocument();
    expect(screen.getByText("Example Tabletop Room")).toBeInTheDocument();
    expect(screen.getByText("5 players")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Waitlist" })).toBeInTheDocument();

    const publicText = document.body.textContent ?? "";

    expect(publicText).not.toContain("101 Example Tabletop Way");
    expect(publicText).not.toContain("Private fixture RSVP note");
    expect(publicText).not.toContain("nora@example.test");
    expect(publicText).not.toContain("fixture-wednesday-event-access");
    expect(publicText).not.toContain("Example Guest");
  });
});
