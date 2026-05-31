import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("home app shell", () => {
  it("puts the product pillars in the primary navigation", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: /life counter/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /game night/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Life Counter" }),
    ).toBeInTheDocument();
  });
});
