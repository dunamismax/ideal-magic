import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { EventLifeCounterParticipantSummary } from "@/db/queries/event-planning";
import { EventLifeGameSaveForm } from "./event-life-game-save-form";

const participants = [
  {
    id: "50000000-0000-4000-8000-000000000002",
    participantName: "Riley Chen",
    rsvpStatus: "yes",
    deck: {
      declarationId: "50000000-0000-4000-8000-000000000003",
      deckId: "50000000-0000-4000-8000-000000000004",
      deckNameSnapshot: "Atraxa Counters",
      commanderSnapshot: ["Atraxa, Grand Unifier"],
      colorIdentitySnapshot: "WUBG",
      bracketSnapshot: "3",
      powerEstimateSnapshot: 7,
      archetypeSnapshot: "Counters",
    },
  },
  {
    id: "50000000-0000-4000-8000-000000000005",
    participantName: "Guest RSVP",
    rsvpStatus: "maybe",
    deck: null,
  },
] satisfies EventLifeCounterParticipantSummary[];

describe("event life game save form", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders explicit result controls with safe event participant labels", () => {
    render(
      <EventLifeGameSaveForm
        action={async (state) => state}
        eventId="50000000-0000-4000-8000-000000000001"
        eventTitle="Friday Commander"
        participants={participants}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Save Game" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Result for Friday Commander"),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Team win" })).toHaveValue(
      "team_win",
    );
    expect(screen.getByRole("group", { name: "Winners" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Seat 1: Riley Chen" }),
    ).toHaveAttribute("value", participants[0]!.id);
    expect(
      screen.getByRole("checkbox", { name: "Seat 2: Guest RSVP" }),
    ).toHaveAttribute("value", participants[1]!.id);
    expect(
      screen.getByLabelText("Notes for Friday Commander"),
    ).toBeInTheDocument();
    expect(screen.getByText("Finish and Loss Details")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Seat 1: Riley Chen finish position"),
    ).toHaveAttribute("name", `finishPosition:${participants[0]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP elimination order"),
    ).toHaveAttribute("name", `eliminationOrder:${participants[1]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP loss reason"),
    ).toHaveAttribute("name", `lossReason:${participants[1]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP poison counters"),
    ).toHaveAttribute("name", `poisonCounters:${participants[1]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP commander damage source"),
    ).toHaveAttribute("name", `commanderDamageSource:${participants[1]!.id}`);
    expect(
      screen.getByRole("button", { name: "Save game for Friday Commander" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Private Guest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });
});
