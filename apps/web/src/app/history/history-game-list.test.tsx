import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { LoggedGameHistorySummary } from "@/db/queries/games";
import { HistoryGameList } from "./history-game-list";

const loggedGame: LoggedGameHistorySummary = {
  id: "50000000-0000-4000-8000-000000000001",
  event: {
    id: "50000000-0000-4000-8000-000000000002",
    title: "Saturday Commander",
    startsAt: new Date("2030-06-15T00:00:00.000Z"),
  },
  playgroup: {
    id: "50000000-0000-4000-8000-000000000003",
    name: "Saturday Hosts",
    slug: "saturday-hosts",
  },
  pod: {
    id: "50000000-0000-4000-8000-000000000004",
    name: "Pod 1",
  },
  resultType: "combat_win",
  notes: "Shared table note",
  completedAt: new Date("2030-06-15T03:30:00.000Z"),
  winners: [
    {
      id: "50000000-0000-4000-8000-000000000005",
      participantName: "Riley Chen",
      deckNameSnapshot: "Atraxa Counters",
    },
  ],
  players: [
    {
      id: "50000000-0000-4000-8000-000000000005",
      participantName: "Riley Chen",
      seatPosition: 1,
      finishPosition: 1,
      isWinner: true,
      deck: {
        deckId: "50000000-0000-4000-8000-000000000006",
        deckNameSnapshot: "Atraxa Counters",
        commanderSnapshot: ["Atraxa, Grand Unifier"],
        colorIdentitySnapshot: "WUBG",
        bracketSnapshot: "3",
        powerEstimateSnapshot: 7,
        archetypeSnapshot: "Counters",
      },
    },
    {
      id: "50000000-0000-4000-8000-000000000007",
      participantName: "Guest RSVP",
      seatPosition: 2,
      finishPosition: null,
      isWinner: false,
      deck: null,
    },
  ],
};

describe("history game list", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders logged game summaries from safe snapshots", () => {
    render(<HistoryGameList games={[loggedGame]} />);

    expect(
      screen.getByRole("heading", { name: "Saturday Commander" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Saturday Hosts")).toBeInTheDocument();
    expect(screen.getByText(/Pod 1/)).toBeInTheDocument();
    expect(screen.getByText("Combat Win")).toBeInTheDocument();
    expect(screen.getByText("Winner: Riley Chen")).toBeInTheDocument();
    expect(screen.getByText("Atraxa Counters")).toBeInTheDocument();
    expect(screen.getByText("Atraxa, Grand Unifier")).toBeInTheDocument();
    expect(
      screen.getByText("Colors WUBG - Bracket 3 - Power 7 - Counters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Guest RSVP")).toBeInTheDocument();
    expect(screen.getByText("Shared table note")).toBeInTheDocument();
    expect(screen.queryByText(/private guest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
  });

  test("renders multiple safe winners for team results", () => {
    render(
      <HistoryGameList
        games={[
          {
            ...loggedGame,
            resultType: "team_win",
            winners: [
              ...loggedGame.winners,
              {
                id: "50000000-0000-4000-8000-000000000008",
                participantName: "Guest RSVP",
                deckNameSnapshot: "",
              },
            ],
            players: [
              loggedGame.players[0]!,
              {
                ...loggedGame.players[1]!,
                id: "50000000-0000-4000-8000-000000000008",
                isWinner: true,
                finishPosition: 1,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Team Win")).toBeInTheDocument();
    expect(
      screen.getByText("Winners: Riley Chen, Guest RSVP"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private guest/i)).not.toBeInTheDocument();
  });

  test("renders an empty state when no logged games are visible", () => {
    render(<HistoryGameList games={[]} />);

    expect(screen.getByText("No logged games yet")).toBeInTheDocument();
  });
});
