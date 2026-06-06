import type { CalendarEventListItem } from "@/db/queries/event-planning";

type RenderCalendarOptions = {
  now?: Date;
};

export function renderCalendarExport(
  events: CalendarEventListItem[],
  options: RenderCalendarOptions = {},
) {
  const now = options.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pod Tracker//Events//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      formatIcsLine("UID", `${event.id}@pod-tracker.app`),
      formatIcsLine("DTSTAMP", formatIcsTimestamp(now)),
      formatIcsLine("DTSTART", formatIcsTimestamp(event.startsAt)),
    );

    if (event.endsAt) {
      lines.push(formatIcsLine("DTEND", formatIcsTimestamp(event.endsAt)));
    }

    lines.push(formatIcsLine("SUMMARY", event.title));

    if (event.status === "cancelled") {
      lines.push("STATUS:CANCELLED");
    }

    const description = event.description.trim();

    if (description) {
      lines.push(formatIcsLine("DESCRIPTION", description));
    }

    const location = formatCalendarLocation(event.location);

    if (location) {
      lines.push(formatIcsLine("LOCATION", location));
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

export function formatIcsTimestamp(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function escapeIcsText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n");
}

function formatIcsLine(name: string, value: string) {
  return `${name}:${escapeIcsText(value)}`;
}

function formatCalendarLocation(location: CalendarEventListItem["location"]) {
  if (!location) {
    return null;
  }

  const address = [
    location.address.addressLine1,
    location.address.addressLine2,
    [location.address.city, location.address.stateProvince]
      .filter(Boolean)
      .join(" "),
    location.address.postalCode,
    location.address.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return [location.name, ...address].join(", ");
}

function foldIcsLine(line: string) {
  const maxLength = 75;

  if (line.length <= maxLength) {
    return [line];
  }

  const folded = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    folded.push(remaining.slice(0, maxLength));
    remaining = ` ${remaining.slice(maxLength)}`;
  }

  folded.push(remaining);

  return folded;
}
