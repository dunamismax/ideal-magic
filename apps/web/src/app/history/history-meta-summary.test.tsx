import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { MetaHealthSummary } from "@/db/queries/games";
import { HistoryMetaSummary } from "./history-meta-summary";

const summary: MetaHealthSummary = {
  totalLoggedGames: 4,
  eventsWithGames: 2,
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
  repeatPlayerPairCount: 1,
  topRepeatPlayerPairs: [
    {
      leftLabel: "Riley Chen",
      rightLabel: "Sam Rivera",
      gameCount: 3,
    },
  ],
  repeatDeckPairCount: 1,
  topRepeatDeckPairs: [
    {
      leftLabel: "Atraxa Counters",
      rightLabel: "Minsc Midrange",
      gameCount: 2,
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
    expect(screen.getByText("3 guest seats")).toBeInTheDocument();
    expect(screen.getByText("7 commanders")).toBeInTheDocument();
    expect(screen.getByText("1 player / 1 deck")).toBeInTheDocument();
    expect(screen.getByText("RG")).toBeInTheDocument();
    expect(screen.getByText("WUB")).toBeInTheDocument();
    expect(screen.getByText("Midrange")).toBeInTheDocument();
    expect(screen.getByText("Control")).toBeInTheDocument();
    expect(screen.getByText("Riley Chen / Sam Rivera")).toBeInTheDocument();
    expect(
      screen.getByText("Atraxa Counters / Minsc Midrange"),
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
          distinctKnownPlayers: 0,
          guestSeatCount: 0,
          distinctDeckSnapshots: 0,
          distinctCommanderSnapshots: 0,
          colorIdentitySpread: [],
          archetypeSpread: [],
          repeatPlayerPairCount: 0,
          topRepeatPlayerPairs: [],
          repeatDeckPairCount: 0,
          topRepeatDeckPairs: [],
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
          repeatPlayerPairCount: 0,
          topRepeatPlayerPairs: [],
          repeatDeckPairCount: 0,
          topRepeatDeckPairs: [],
        }}
      />,
    );

    expect(screen.getByText("No color snapshots yet")).toBeInTheDocument();
    expect(screen.getByText("No archetype snapshots yet")).toBeInTheDocument();
    expect(screen.getByText("No repeat player pairs yet")).toBeInTheDocument();
    expect(screen.getByText("No repeat deck pairs yet")).toBeInTheDocument();
  });
});
