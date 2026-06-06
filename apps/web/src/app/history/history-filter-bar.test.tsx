import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { HistoryFilterOptions } from "@/db/queries/games";
import { HistoryFilterBar } from "./history-filter-bar";

const options: HistoryFilterOptions = {
  playgroups: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      name: "Saturday Hosts",
      slug: "saturday-hosts",
      loggedGameCount: 3,
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      name: "Wednesday League",
      slug: "wednesday-league",
      loggedGameCount: 1,
    },
  ],
  events: [
    {
      id: "50000000-0000-4000-8000-000000000011",
      title: "Saturday Commander",
      startsAt: new Date("2030-06-15T00:00:00.000Z"),
      playgroupId: "50000000-0000-4000-8000-000000000001",
      playgroupName: "Saturday Hosts",
      loggedGameCount: 2,
    },
    {
      id: "50000000-0000-4000-8000-000000000012",
      title: "Wednesday Commander",
      startsAt: new Date("2030-06-12T00:00:00.000Z"),
      playgroupId: "50000000-0000-4000-8000-000000000002",
      playgroupName: "Wednesday League",
      loggedGameCount: 1,
    },
  ],
};

describe("history filter bar", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders scoped filter options and active reset control", () => {
    render(
      <HistoryFilterBar
        options={options}
        selectedEventId="50000000-0000-4000-8000-000000000011"
        selectedPlaygroupId="50000000-0000-4000-8000-000000000001"
      />,
    );

    expect(screen.getByLabelText("Playgroup")).toHaveValue(
      "50000000-0000-4000-8000-000000000001",
    );
    expect(screen.getByLabelText("Event")).toHaveValue(
      "50000000-0000-4000-8000-000000000011",
    );
    expect(screen.getByText("Saturday Hosts (3)")).toBeInTheDocument();
    expect(
      screen.getByText("Saturday Commander - Saturday Hosts (2)"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Wednesday Commander - Wednesday League (1)"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute(
      "href",
      "/history",
    );
  });

  test("hides reset when no filter is active", () => {
    render(<HistoryFilterBar options={options} />);

    expect(screen.getByLabelText("Playgroup")).toHaveValue("");
    expect(screen.getByLabelText("Event")).toHaveValue("");
    expect(screen.queryByRole("link", { name: "Reset" })).toBeNull();
  });
});
