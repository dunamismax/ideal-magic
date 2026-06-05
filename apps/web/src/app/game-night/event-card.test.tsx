import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { EventDeckDeclaration, ViewerDeck } from "@/db/queries/decks";
import type { EventPlanningSummary } from "@/db/queries/event-planning";
import type { EventPodSummary } from "@/db/queries/pods";
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

const viewerDeck: ViewerDeck = {
  id: "20000000-0000-4000-8000-000000000003",
  name: "Atraxa Counters",
  commanders: ["Atraxa, Grand Unifier"],
  colorIdentity: "WUBG",
  bracket: "3",
  powerEstimate: 7,
  archetype: "Counters",
  tags: ["midrange"],
  visibility: "private",
  playgroup: null,
  externalUrl: null,
  createdAt: new Date("2026-06-04T00:00:00.000Z"),
  updatedAt: new Date("2026-06-04T00:00:00.000Z"),
};

const declaration: EventDeckDeclaration = {
  id: "20000000-0000-4000-8000-000000000004",
  eventId: baseEvent.id,
  userId: "20000000-0000-4000-8000-000000000005",
  deckId: viewerDeck.id,
  preference: 1,
  deckNameSnapshot: "Atraxa Counters",
  commanderSnapshot: ["Atraxa, Grand Unifier"],
  colorIdentitySnapshot: "WUBG",
  bracketSnapshot: "3",
  powerEstimateSnapshot: 7,
  archetypeSnapshot: "Counters",
  tagsSnapshot: ["midrange"],
  visibilitySnapshot: "private",
  externalUrlSnapshot: null,
  createdAt: new Date("2026-06-04T00:00:00.000Z"),
};

const pod: EventPodSummary = {
  id: "20000000-0000-4000-8000-000000000007",
  eventId: baseEvent.id,
  name: "Pod 1",
  state: "proposed",
  position: 1,
  sizeFitScore: 100,
  bracketCompatibilityScore: 85,
  availabilityWindowScore: 30,
  totalScore: 215,
  scoringDetails: {
    method: "draft-rsvp-declaration-v1",
  },
  publishedAt: null,
  seats: [
    {
      id: "20000000-0000-4000-8000-000000000008",
      seatPosition: 1,
      participantName: "Riley Chen",
      rsvpStatus: "yes",
      locked: false,
      deck: {
        declarationId: declaration.id,
        deckId: declaration.deckId,
        deckNameSnapshot: declaration.deckNameSnapshot,
        commanderSnapshot: declaration.commanderSnapshot,
        colorIdentitySnapshot: declaration.colorIdentitySnapshot,
        bracketSnapshot: declaration.bracketSnapshot,
        powerEstimateSnapshot: declaration.powerEstimateSnapshot,
        archetypeSnapshot: declaration.archetypeSnapshot,
      },
    },
  ],
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

  test("renders deck declaration controls from snapshot metadata", () => {
    render(
      <EventCard
        declarations={[declaration]}
        decks={[
          viewerDeck,
          {
            ...viewerDeck,
            id: "20000000-0000-4000-8000-000000000006",
            name: "Krenko Tokens",
            commanders: ["Krenko, Mob Boss"],
            colorIdentity: "R",
            bracket: "2",
            powerEstimate: 5,
            archetype: "Tokens",
          },
        ]}
        event={baseEvent}
      />,
    );

    expect(screen.getByText("Deck Declarations")).toBeInTheDocument();
    expect(screen.getByText("Atraxa Counters")).toBeInTheDocument();
    expect(screen.getByText("Atraxa, Grand Unifier")).toBeInTheDocument();
    expect(screen.getByText("Bracket 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Declare Deck" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Undeclare Atraxa Counters" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token hash/i)).not.toBeInTheDocument();
  });

  test("renders draft pod seats from safe snapshot metadata", () => {
    render(
      <EventCard declarations={[declaration]} event={baseEvent} pods={[pod]} />,
    );

    expect(screen.getByText("Draft Pods")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate Draft Pods" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish Pods" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pod 1" })).toBeInTheDocument();
    expect(screen.getByText("Riley Chen")).toBeInTheDocument();
    expect(
      screen.getByText("Atraxa Counters - Atraxa, Grand Unifier"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Move Riley Chen to pod")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Move Riley Chen to seat"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move Riley Chen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lock Riley Chen" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Power 7").length).toBeGreaterThan(0);
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Private RSVP note/i)).not.toBeInTheDocument();
  });

  test("hides manual pod movement controls from non-managers", () => {
    render(
      <EventCard
        declarations={[declaration]}
        event={{
          ...baseEvent,
          viewer: {
            ...baseEvent.viewer,
            role: "member",
            canManageEvent: false,
          },
        }}
        pods={[pod]}
      />,
    );

    expect(screen.getByText("Draft Pods")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish Pods" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Move Riley Chen to pod"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move Riley Chen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lock Riley Chen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlock Riley Chen" }),
    ).not.toBeInTheDocument();
  });

  test("renders locked draft seats with unlock controls and no move controls", () => {
    render(
      <EventCard
        declarations={[declaration]}
        event={baseEvent}
        pods={[
          {
            ...pod,
            seats: [
              {
                ...pod.seats[0]!,
                locked: true,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Locked seat")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unlock Riley Chen" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Move Riley Chen to pod"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move Riley Chen" }),
    ).not.toBeInTheDocument();
  });

  test("renders published pod display without movement controls", () => {
    render(
      <EventCard
        declarations={[declaration]}
        event={baseEvent}
        pods={[
          {
            ...pod,
            state: "locked",
            publishedAt: new Date("2030-06-14T22:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(screen.getByText("Published Pods")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unpublish Pods" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Locked - 1 seats - Score 215/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Move Riley Chen to pod"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move Riley Chen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lock Riley Chen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlock Riley Chen" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Private RSVP note/i)).not.toBeInTheDocument();
  });
});
