import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  createInitialLifeCounterSession,
  createInitialLifeCounterSnapshot,
  type LifeCounterSession,
} from "@/features/life/session";
import { LifeTableEmptyState, LifeTableView } from "./life-table-view";

describe("LifeTableView", () => {
  test("renders synced life state without private guest details", () => {
    const session = createTableSession({
      firstPlayerName: "Riley Chen",
      secondPlayerName: "Guest RSVP",
      secondPlayerPrivateName: "Mara Private",
    });

    render(
      <LifeTableView session={session} syncedAt="2030-06-15T00:10:00.000Z" />,
    );

    expect(screen.getByTestId("linked-life-table-view")).toBeInTheDocument();
    expect(screen.getAllByTestId("linked-life-table-player")).toHaveLength(2);
    expect(screen.getAllByText("Riley Chen").length).toBeGreaterThan(0);
    expect(screen.getByText("Guest RSVP")).toBeInTheDocument();
    expect(screen.queryByText("Mara Private")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(/Riley Chen, Active, 37 life, 2 poison/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Ezuri, Claw of Progress").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  test("renders an honest empty state before the linked table has synced", () => {
    render(<LifeTableEmptyState label="Commander Night" />);

    expect(screen.getByTestId("linked-life-table-empty")).toHaveTextContent(
      "No synced table",
    );
    expect(screen.getByText("Commander Night")).toBeInTheDocument();
  });
});

function createTableSession({
  firstPlayerName,
  secondPlayerName,
  secondPlayerPrivateName,
}: {
  firstPlayerName: string;
  secondPlayerName: string;
  secondPlayerPrivateName: string;
}): LifeCounterSession {
  const snapshot = createInitialLifeCounterSnapshot();
  const session = createInitialLifeCounterSession("2030-06-15T00:00:00.000Z", {
    id: "linked-life:event:50000000-0000-4000-8000-000000000001",
    snapshot: {
      ...snapshot,
      playerCount: 2,
      activePlayerId: "player-1",
      gameElapsedSeconds: 90,
      turnElapsedSeconds: 30,
      stormCount: 3,
      players: snapshot.players.map((player, index) => {
        if (index === 0) {
          return {
            ...player,
            name: firstPlayerName,
            deck: "Simic Counters",
            life: 37,
            poison: 2,
            commanders: [
              {
                ...player.commanders[0]!,
                name: "Ezuri, Claw of Progress",
                castCount: 1,
                damageByDefender: {
                  "player-2": 7,
                },
              },
            ],
          };
        }

        if (index === 1) {
          return {
            ...player,
            name: secondPlayerName,
            deck: "",
            life: 40,
            customCounters: [
              {
                id: "private-name-proof",
                name: secondPlayerPrivateName,
                value: 1,
              },
            ],
          };
        }

        return player;
      }),
    },
  });

  return session;
}
