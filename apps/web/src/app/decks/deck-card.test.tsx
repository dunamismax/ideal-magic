import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { ViewerDeck } from "@/db/queries/decks";
import { DeckCard } from "./page";

const deck: ViewerDeck = {
  id: "30000000-0000-4000-8000-000000000001",
  name: "Atraxa Counters",
  commanders: ["Atraxa, Grand Unifier", "Tekuthal, Inquiry Dominus"],
  colorIdentity: "WUBG",
  bracket: "3",
  powerEstimate: 7,
  archetype: "Counters",
  tags: ["midrange", "proliferate"],
  visibility: "playgroup",
  playgroup: {
    id: "30000000-0000-4000-8000-000000000002",
    name: "Friday Pods",
    slug: "friday-pods",
  },
  externalUrl: "https://example.test/decks/atraxa",
  createdAt: new Date("2026-06-04T00:00:00.000Z"),
  updatedAt: new Date("2026-06-04T00:00:00.000Z"),
};

describe("deck card", () => {
  test("renders lightweight planning metadata without private fields", () => {
    render(
      <DeckCard
        deck={deck}
        playgroups={[
          {
            id: deck.playgroup?.id ?? "",
            name: deck.playgroup?.name ?? "",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Atraxa Counters" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Atraxa, Grand Unifier / Tekuthal, Inquiry Dominus"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Playgroup").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Friday Pods").length).toBeGreaterThan(0);
    expect(screen.getByText("WUBG")).toBeInTheDocument();
    expect(screen.getByText("Counters")).toBeInTheDocument();
    expect(screen.getByText("midrange")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deck Link" })).toHaveAttribute(
      "href",
      "https://example.test/decks/atraxa",
    );
    expect(screen.getByText("Edit Deck")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit Deck Name")).toHaveValue(
      "Atraxa Counters",
    );
    expect(
      screen.getByRole("button", { name: "Update Deck" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retire Atraxa Counters" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/example\.test.*@/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invite/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });
});
