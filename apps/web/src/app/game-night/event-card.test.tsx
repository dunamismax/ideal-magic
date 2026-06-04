import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { EventPlanningSummary } from "@/db/queries/event-planning";
import { EventCard } from "./page";

const baseEvent: EventPlanningSummary = {
  id: "20000000-0000-4000-8000-000000000001",
  title: "Saturday Commander",
  description: "Bring bracket 2-3 decks.",
  startsAt: new Date("2030-06-14T23:00:00.000Z"),
  endsAt: null,
  status: "scheduled",
  cancelledAt: null,
  archivedAt: null,
  visibility: "members",
  playgroup: {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Saturday Hosts",
    slug: "saturday-hosts",
  },
  viewer: {
    role: "owner",
    rsvpStatus: null,
    rsvpArrivalTime: null,
    rsvpLeavingTime: null,
    canRsvp: true,
    canManageEvent: true,
    canSeeHostAddress: false,
  },
  location: null,
  counts: {
    rsvps: {
      yes: 1,
      maybe: 2,
      no: 0,
      waitlist: 0,
    },
    deckDeclarations: 0,
    pods: 0,
    loggedGames: 0,
  },
};

describe("event card", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders event lifecycle controls for managers", () => {
    render(<EventCard event={baseEvent} />);

    expect(
      screen.getByRole("heading", { name: "Saturday Commander" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update Event" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel Event" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Archive Event" }),
    ).toBeInTheDocument();
  });

  test("shows cancelled state without management controls for plain members", () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          status: "cancelled",
          cancelledAt: new Date("2030-06-13T12:00:00.000Z"),
          viewer: {
            ...baseEvent.viewer,
            role: "member",
            canManageEvent: false,
          },
        }}
      />,
    );

    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Update Event" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive Event" }),
    ).not.toBeInTheDocument();
  });
});
