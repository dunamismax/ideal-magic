import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { EventPodSummary } from "@/db/queries/pods";
import { markLifeCounterSessionGameSaved } from "@/features/life/local-session-store";
import { PodLifeGameSaveForm } from "./pod-life-game-save-form";

vi.mock("@/features/life/local-session-store", () => ({
  markLifeCounterSessionGameSaved: vi.fn(async () => true),
}));

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
    vi.clearAllMocks();
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
    expect(screen.getByText("Finish and Loss Details")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Seat 1: Riley Chen finish position"),
    ).toHaveAttribute("name", `finishPosition:${pod.seats[0]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP elimination order"),
    ).toHaveAttribute("name", `eliminationOrder:${pod.seats[1]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP loss reason"),
    ).toHaveAttribute("name", `lossReason:${pod.seats[1]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP poison counters"),
    ).toHaveAttribute("name", `poisonCounters:${pod.seats[1]!.id}`);
    expect(
      screen.getByLabelText("Seat 2: Guest RSVP commander damage amount"),
    ).toHaveAttribute("name", `commanderDamageAmount:${pod.seats[1]!.id}`);
    expect(
      screen.getByRole("button", { name: "Save game for Pod 1" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Private Guest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });

  test("marks the pod local action history as preserved after a successful save", async () => {
    const user = userEvent.setup();

    render(
      <PodLifeGameSaveForm
        action={async (state) => ({
          ...state,
          message: "Saved 2-player game to history.",
          saved: true,
          savedGameId: "50000000-0000-4000-8000-000000000090",
        })}
        eventId="50000000-0000-4000-8000-000000000001"
        localSessionId="linked-life:pod:50000000-0000-4000-8000-000000000001:50000000-0000-4000-8000-000000000002"
        pod={pod}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Save game for Pod 1" }),
    );

    await waitFor(() => {
      expect(markLifeCounterSessionGameSaved).toHaveBeenCalledWith(
        "linked-life:pod:50000000-0000-4000-8000-000000000001:50000000-0000-4000-8000-000000000002",
        {
          eventId: "50000000-0000-4000-8000-000000000001",
          gameId: "50000000-0000-4000-8000-000000000090",
          podId: "50000000-0000-4000-8000-000000000002",
        },
      );
    });
  });
});
