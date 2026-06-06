import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { MetaHealthSummary } from "@/db/queries/games";
import { HistoryMetaSummary } from "./history-meta-summary";

const summary: MetaHealthSummary = {
  totalLoggedGames: 4,
  eventsWithGames: 2,
  totalSeats: 15,
  averagePlayersPerGame: 3.8,
  distinctKnownPlayers: 5,
  guestSeatCount: 3,
  distinctDeckSnapshots: 6,
  distinctCommanderSnapshots: 7,
  colorIdentitySpread: [
    { label: "RG", count: 5 },
    { label: "WUB", count: 2 },
  ],
  archetypeSpread: [
    { label: "Midrange", count: 4 },
    { label: "Control", count: 2 },
  ],
  podSizeSpread: [
    { label: "4 players", count: 3 },
    { label: "3 players", count: 1 },
  ],
  fourPlayerGameCount: 3,
  undersizedGameCount: 1,
  oversizedGameCount: 0,
  uniquePlayerPairCount: 8,
  freshPlayerPairCount: 7,
  repeatPlayerPairRate: 13,
  repeatPlayerPairCount: 1,
  topRepeatPlayerPairs: [
    {
      leftLabel: "Riley Chen",
      rightLabel: "Sam Rivera",
      gameCount: 3,
    },
  ],
  uniqueDeckPairCount: 6,
  freshDeckPairCount: 5,
  repeatDeckPairRate: 17,
  repeatDeckPairCount: 1,
  topRepeatDeckPairs: [
    {
      leftLabel: "Atraxa Counters",
      rightLabel: "Minsc Midrange",
      gameCount: 2,
    },
  ],
  eventParticipationTrend: [
    {
      eventId: "50000000-0000-4000-8000-000000000031",
      eventTitle: "Saturday Commander",
      startsAt: new Date("2030-06-15T00:00:00.000Z"),
      loggedGames: 3,
      totalSeats: 11,
      knownPlayers: 5,
      guestSeats: 2,
      deckSnapshots: 6,
    },
    {
      eventId: "50000000-0000-4000-8000-000000000032",
      eventTitle: "Wednesday League",
      startsAt: new Date("2030-06-12T00:00:00.000Z"),
      loggedGames: 1,
      totalSeats: 4,
      knownPlayers: 4,
      guestSeats: 0,
      deckSnapshots: 4,
    },
  ],
};

describe("history meta summary", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders source-backed meta health metrics and repeat pairs", () => {
    render(<HistoryMetaSummary summary={summary} />);

    expect(screen.getByText("Meta Health")).toBeInTheDocument();
    expect(screen.getByText("4 logged")).toBeInTheDocument();
    expect(screen.getByText("2 events with games")).toBeInTheDocument();
    expect(screen.getByText("3.8 avg seats/game")).toBeInTheDocument();
    expect(screen.getByText("7 commanders / 5 players")).toBeInTheDocument();
    expect(screen.getByText("13% repeated player pairs")).toBeInTheDocument();
    expect(screen.getByText("Pod-size quality")).toBeInTheDocument();
    expect(screen.getByText("Four-player")).toBeInTheDocument();
    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByText("4 players")).toBeInTheDocument();
    expect(screen.getByText("RG")).toBeInTheDocument();
    expect(screen.getByText("WUB")).toBeInTheDocument();
    expect(screen.getByText("Midrange")).toBeInTheDocument();
    expect(screen.getByText("Control")).toBeInTheDocument();
    expect(screen.getByText("Riley Chen / Sam Rivera")).toBeInTheDocument();
    expect(
      screen.getByText("Atraxa Counters / Minsc Midrange"),
    ).toBeInTheDocument();
    expect(screen.getByText("Event participation")).toBeInTheDocument();
    expect(screen.getByText("Saturday Commander")).toBeInTheDocument();
    expect(
      screen.getByText("11 seats - 5 players - 2 guests - 6 decks"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private guest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });

  test("renders empty states when no logged games or spreads are available", () => {
    render(
      <HistoryMetaSummary
        summary={{
          ...summary,
          totalLoggedGames: 0,
          eventsWithGames: 0,
          totalSeats: 0,
          averagePlayersPerGame: 0,
          distinctKnownPlayers: 0,
          guestSeatCount: 0,
          distinctDeckSnapshots: 0,
          distinctCommanderSnapshots: 0,
          colorIdentitySpread: [],
          archetypeSpread: [],
          podSizeSpread: [],
          fourPlayerGameCount: 0,
          undersizedGameCount: 0,
          oversizedGameCount: 0,
          uniquePlayerPairCount: 0,
          freshPlayerPairCount: 0,
          repeatPlayerPairRate: 0,
          repeatPlayerPairCount: 0,
          topRepeatPlayerPairs: [],
          uniqueDeckPairCount: 0,
          freshDeckPairCount: 0,
          repeatDeckPairRate: 0,
          repeatDeckPairCount: 0,
          topRepeatDeckPairs: [],
          eventParticipationTrend: [],
        }}
      />,
    );

    expect(
      screen.getByText("No scoped game records are available yet."),
    ).toBeInTheDocument();
  });

  test("renders partial empty states for missing spreads and repeats", () => {
    render(
      <HistoryMetaSummary
        summary={{
          ...summary,
          colorIdentitySpread: [],
          archetypeSpread: [],
          podSizeSpread: [],
          fourPlayerGameCount: 0,
          undersizedGameCount: 0,
          oversizedGameCount: 0,
          uniquePlayerPairCount: 0,
          freshPlayerPairCount: 0,
          repeatPlayerPairRate: 0,
          repeatPlayerPairCount: 0,
          topRepeatPlayerPairs: [],
          uniqueDeckPairCount: 0,
          freshDeckPairCount: 0,
          repeatDeckPairRate: 0,
          repeatDeckPairCount: 0,
          topRepeatDeckPairs: [],
          eventParticipationTrend: [],
        }}
      />,
    );

    expect(screen.getByText("No color snapshots yet")).toBeInTheDocument();
    expect(screen.getByText("No archetype snapshots yet")).toBeInTheDocument();
    expect(screen.getByText("No repeat player pairs yet")).toBeInTheDocument();
    expect(screen.getByText("No repeat deck pairs yet")).toBeInTheDocument();
    expect(screen.getByText("No event participation yet")).toBeInTheDocument();
  });
});
