import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { EventPodSummary } from "@/db/queries/pods";
import { PodLifeGameSaveForm } from "./pod-life-game-save-form";

const pod = {
  id: "50000000-0000-4000-8000-000000000002",
  name: "Pod 1",
  seats: [
    {
      id: "50000000-0000-4000-8000-000000000003",
      seatPosition: 1,
      participantName: "Riley Chen",
      rsvpStatus: "yes",
      locked: false,
      deck: {
        declarationId: "50000000-0000-4000-8000-000000000004",
        deckId: "50000000-0000-4000-8000-000000000005",
        deckNameSnapshot: "Atraxa Counters",
        commanderSnapshot: ["Atraxa, Grand Unifier"],
        colorIdentitySnapshot: "WUBG",
        bracketSnapshot: "3",
        powerEstimateSnapshot: 7,
        archetypeSnapshot: "Counters",
      },
    },
    {
      id: "50000000-0000-4000-8000-000000000006",
      seatPosition: 2,
      participantName: "Guest RSVP",
      rsvpStatus: "yes",
      locked: false,
      deck: null,
    },
  ],
} satisfies Pick<EventPodSummary, "id" | "name" | "seats">;

describe("pod life game save form", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders explicit result controls with safe pod seat labels", () => {
    render(
      <PodLifeGameSaveForm
        action={async (state) => state}
        eventId="50000000-0000-4000-8000-000000000001"
        pod={pod}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Save Game" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Result for Pod 1")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Team win" })).toHaveValue(
      "team_win",
    );
    expect(screen.getByRole("group", { name: "Winners" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Seat 1: Riley Chen" }),
    ).toHaveAttribute("value", pod.seats[0]!.id);
    expect(
      screen.getByRole("checkbox", { name: "Seat 2: Guest RSVP" }),
    ).toHaveAttribute("value", pod.seats[1]!.id);
    expect(screen.getByLabelText("Notes for Pod 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save game for Pod 1" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Private Guest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });
});
