import { describe, expect, test } from "vitest";

import {
  escapeIcsText,
  formatIcsTimestamp,
  renderCalendarExport,
} from "./calendar-export";

describe("calendar export", () => {
  test("renders scoped events as an ICS calendar", () => {
    const calendar = renderCalendarExport(
      [
        {
          id: "20000000-0000-4000-8000-000000000301",
          title: "Commander, Pods; Night",
          description: "Bring decks\\tokens\nNo private notes here.",
          startsAt: new Date("2030-06-14T23:00:00.000Z"),
          endsAt: new Date("2030-06-15T03:00:00.000Z"),
          status: "cancelled",
          location: {
            name: "Host Table",
            address: {
              addressLine1: "101 Fixture Way",
              addressLine2: "Unit 2",
              city: "Playtest City",
              stateProvince: "TS",
              postalCode: "00000",
              country: "US",
            },
          },
        },
      ],
      { now: new Date("2030-06-01T00:00:00.000Z") },
    );

    expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
    expect(calendar).toContain(
      "UID:20000000-0000-4000-8000-000000000301@pod-tracker.app\r\n",
    );
    expect(calendar).toContain("DTSTAMP:20300601T000000Z\r\n");
    expect(calendar).toContain("DTSTART:20300614T230000Z\r\n");
    expect(calendar).toContain("DTEND:20300615T030000Z\r\n");
    expect(calendar).toContain("SUMMARY:Commander\\, Pods\\; Night\r\n");
    expect(calendar).toContain("STATUS:CANCELLED\r\n");
    expect(calendar).toContain(
      "DESCRIPTION:Bring decks\\\\tokens\\nNo private notes here.\r\n",
    );
    expect(calendar).toContain(
      "LOCATION:Host Table\\, 101 Fixture Way\\, Unit 2\\, Playtest City TS\\, 00000\\,\r\n  US\r\n",
    );
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  test("omits location and blank description when not present", () => {
    const calendar = renderCalendarExport(
      [
        {
          id: "event-1",
          title: "Hidden Location Night",
          description: "   ",
          startsAt: new Date("2030-06-14T23:00:00.000Z"),
          endsAt: null,
          status: "scheduled",
          location: null,
        },
      ],
      { now: new Date("2030-06-01T00:00:00.000Z") },
    );

    expect(calendar).not.toContain("DESCRIPTION:");
    expect(calendar).not.toContain("LOCATION:");
    expect(calendar).not.toContain("STATUS:CANCELLED");
  });

  test("escapes text and formats UTC timestamps", () => {
    expect(formatIcsTimestamp(new Date("2030-01-02T03:04:05.000Z"))).toBe(
      "20300102T030405Z",
    );
    expect(escapeIcsText("A\\B; C, D\r\nE\rF")).toBe(
      "A\\\\B\\; C\\, D\\nE\\nF",
    );
  });

  test("folds long content lines", () => {
    const calendar = renderCalendarExport([
      {
        id: "event-1",
        title: "A".repeat(90),
        description: "",
        startsAt: new Date("2030-06-14T23:00:00.000Z"),
        endsAt: null,
        status: "scheduled",
        location: null,
      },
    ]);

    expect(calendar).toContain(`SUMMARY:${"A".repeat(67)}\r\n A`);
  });
});
