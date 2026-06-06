import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  createDatabaseConnection: vi.fn(),
  getServerSession: vi.fn(),
  listCalendarEventsForViewer: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  createDatabaseConnection: mocks.createDatabaseConnection,
}));

vi.mock("@/db/queries/event-planning", () => ({
  listCalendarEventsForViewer: mocks.listCalendarEventsForViewer,
}));

vi.mock("@/features/auth/server", () => ({
  getLoginRedirectPath: (nextPath: string) =>
    `/login?next=${encodeURIComponent(nextPath)}`,
  getServerSession: mocks.getServerSession,
}));

import { GET } from "./route";

describe("calendar export route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("redirects anonymous viewers to login without opening the database", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET(
      new Request("https://pod-tracker.example.test/calendar.ics"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://pod-tracker.example.test/login?next=%2Fcalendar.ics",
    );
    expect(mocks.createDatabaseConnection).not.toHaveBeenCalled();
    expect(mocks.listCalendarEventsForViewer).not.toHaveBeenCalled();
  });

  test("returns an authenticated inline ICS feed", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.createDatabaseConnection.mockReturnValue({
      db: { test: "db" },
      close: mocks.close,
    });
    mocks.listCalendarEventsForViewer.mockResolvedValue([
      {
        id: "event-1",
        title: "Commander Night",
        description: "",
        startsAt: new Date("2030-06-14T23:00:00.000Z"),
        endsAt: null,
        status: "scheduled",
        location: null,
      },
    ]);

    const response = await GET(
      new Request("https://pod-tracker.example.test/calendar.ics"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="pod-tracker.ics"',
    );
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:Commander Night");
    expect(mocks.listCalendarEventsForViewer).toHaveBeenCalledWith(
      { test: "db" },
      { viewerUserId: "user-1" },
    );
    expect(mocks.close).toHaveBeenCalled();
  });

  test("returns a service error and closes the database when export fails", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.createDatabaseConnection.mockReturnValue({
      db: { test: "db" },
      close: mocks.close,
    });
    mocks.listCalendarEventsForViewer.mockRejectedValue(
      new Error("database unavailable"),
    );

    const response = await GET(
      new Request("https://pod-tracker.example.test/calendar.ics"),
    );

    await expect(response.text()).resolves.toBe(
      "Calendar export is unavailable.",
    );
    expect(response.status).toBe(503);
    expect(mocks.close).toHaveBeenCalled();
  });
});
