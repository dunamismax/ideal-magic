import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { LoggedGameHistorySummary } from "@/db/queries/games";
import { HistoryGameDetail } from "./history-game-detail";

const loggedGame: LoggedGameHistorySummary = {
  id: "60000000-0000-4000-8000-000000000001",
  event: {
    id: "60000000-0000-4000-8000-000000000002",
    title: "Saturday Commander",
    startsAt: new Date("2030-06-15T00:00:00.000Z"),
  },
  playgroup: {
    id: "60000000-0000-4000-8000-000000000003",
    name: "Saturday Hosts",
    slug: "saturday-hosts",
  },
  pod: {
    id: "60000000-0000-4000-8000-000000000004",
    name: "Pod 1",
  },
  resultType: "combat_win",
  notes: "Shared table note",
  completedAt: new Date("2030-06-15T03:30:00.000Z"),
  winners: [
    {
      id: "60000000-0000-4000-8000-000000000005",
      participantName: "Riley Chen",
      deckNameSnapshot: "Atraxa Counters",
    },
  ],
  players: [
    {
      id: "60000000-0000-4000-8000-000000000005",
      participantName: "Riley Chen",
      seatPosition: 1,
      finishPosition: 1,
      eliminationOrder: null,
      eliminatedTurn: null,
      lossReason: null,
      lossDetail: "",
      poisonCounters: null,
      commanderDamageSource: "",
      commanderDamageAmount: null,
      isWinner: true,
      deck: {
        deckId: "60000000-0000-4000-8000-000000000007",
        deckNameSnapshot: "Atraxa Counters",
        commanderSnapshot: ["Atraxa, Grand Unifier"],
        colorIdentitySnapshot: "WUBG",
        bracketSnapshot: "3",
        powerEstimateSnapshot: 7,
        archetypeSnapshot: "Counters",
      },
    },
    {
      id: "60000000-0000-4000-8000-000000000006",
      participantName: "Guest RSVP",
      seatPosition: 2,
      finishPosition: 2,
      eliminationOrder: 1,
      eliminatedTurn: 9,
      lossReason: "commander_damage",
      lossDetail: "Copied draw trigger",
      poisonCounters: null,
      commanderDamageSource: "Nekusar",
      commanderDamageAmount: 21,
      isWinner: false,
      deck: null,
    },
  ],
};

describe("history game detail", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders scoped logged game snapshots without private guest data", () => {
    render(<HistoryGameDetail canCorrect game={loggedGame} />);

    expect(screen.getByText("Saturday Hosts")).toBeInTheDocument();
    expect(screen.getByText("Saturday Commander")).toBeInTheDocument();
    expect(screen.getByText("Pod 1")).toBeInTheDocument();
    expect(screen.getAllByText("Combat Win").length).toBeGreaterThan(0);
    expect(screen.getByText("Winner: Riley Chen")).toBeInTheDocument();
    expect(screen.getAllByText("Riley Chen").length).toBeGreaterThan(0);
    expect(screen.getByText("Seat 1 - Finish 1")).toBeInTheDocument();
    expect(screen.getByText("Atraxa Counters")).toBeInTheDocument();
    expect(screen.getByText("Atraxa, Grand Unifier")).toBeInTheDocument();
    expect(screen.getByText("WUBG")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Counters")).toBeInTheDocument();
    expect(screen.getAllByText("Guest RSVP").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Elim 1 - Turn 9 - Commander loss - 21 commander from Nekusar - Copied draw trigger",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("No deck snapshot")).toBeInTheDocument();
    expect(screen.getAllByText("Shared table note").length).toBeGreaterThan(0);
    expect(screen.queryByText(/private guest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Correct game result" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Result")).toHaveValue("combat_win");
    expect(
      screen.getByLabelText("Seat 1: Riley Chen finish position"),
    ).toHaveValue(1);
    expect(screen.getByLabelText("Seat 2: Guest RSVP loss reason")).toHaveValue(
      "commander_damage",
    );
    expect(
      screen.getByRole("button", { name: "Save Correction" }),
    ).toBeInTheDocument();
  });

  test("hides result correction controls when viewer cannot correct", () => {
    render(<HistoryGameDetail game={loggedGame} />);

    expect(
      screen.queryByRole("form", { name: "Correct game result" }),
    ).not.toBeInTheDocument();
  });

  test("renders event-only draw history without winners", () => {
    render(
      <HistoryGameDetail
        game={{
          ...loggedGame,
          pod: null,
          resultType: "draw",
          winners: [],
          players: loggedGame.players.map((player) => ({
            ...player,
            finishPosition: null,
            isWinner: false,
          })),
        }}
      />,
    );

    expect(screen.getByText("Event-only game")).toBeInTheDocument();
    expect(screen.getAllByText("Draw").length).toBeGreaterThan(0);
    expect(screen.getByText("No winners")).toBeInTheDocument();
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
  });
});
