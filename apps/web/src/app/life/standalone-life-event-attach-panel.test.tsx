import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { StandaloneLifeEventAttachPanel } from "./standalone-life-event-attach-panel";

const attachEvents = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    title: "Friday Commander",
    startsAt: new Date("2030-06-15T00:00:00.000Z"),
    playgroupName: "Kitchen Table",
    participantCount: 4,
  },
];

describe("standalone life event attach panel", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders event import controls with safe event metadata", () => {
    render(
      <StandaloneLifeEventAttachPanel
        events={attachEvents}
        isAuthenticated
        loginHref="/login?next=%2Flife"
        selectedEventId={attachEvents[0]!.id}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Attach Event" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Event to attach to this life counter"),
    ).toHaveValue(attachEvents[0]!.id);
    expect(
      screen.getByRole("option", {
        name: /Friday Commander - Kitchen Table - .* - 4 players/,
      }),
    ).toHaveValue(attachEvents[0]!.id);
    expect(
      screen.getByRole("button", { name: "Import Roster" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/@example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/address/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Private Guest/i)).not.toBeInTheDocument();
  });

  test("keeps the public local counter path available for anonymous users", () => {
    render(
      <StandaloneLifeEventAttachPanel
        events={[]}
        isAuthenticated={false}
        loginHref="/login?next=%2Flife"
        selectedEventBlocked={null}
        selectedEventId={null}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Sign In To Attach" }),
    ).toHaveAttribute("href", "/login?next=%2Flife");
    expect(
      screen.queryByLabelText("Event to attach to this life counter"),
    ).not.toBeInTheDocument();
  });

  test("renders selected event attach denial without private details", () => {
    render(
      <StandaloneLifeEventAttachPanel
        events={[]}
        isAuthenticated
        loginHref="/login?next=%2Flife"
        selectedEventBlocked="That event is not available to this account."
        selectedEventId="50000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.getByText("That event is not available to this account."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/@example\.test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/address/i)).not.toBeInTheDocument();
  });
});
