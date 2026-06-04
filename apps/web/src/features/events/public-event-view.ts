import type {
  PublicSafeEventSummary,
  PublicSafeGuestRsvpSummary,
} from "@/db/queries/event-planning";

type RsvpStatus = "yes" | "maybe" | "no" | "waitlist";

export type PublicEventInviteView = {
  id: string;
  title: string;
  playgroupName: string;
  dateLabel: string;
  timeLabel: string;
  locationName: string | null;
  rsvpCounts: Record<RsvpStatus, number>;
  guestRsvps: number;
  namedGuests: number;
  totalResponses: number;
  expectedPlayers: number;
  deckDeclarations: number;
  pods: number;
  loggedGames: number;
};

const rsvpLabels: Record<RsvpStatus, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
  waitlist: "Waitlist",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function toPublicEventInviteView(
  eventSummary: PublicSafeEventSummary,
  guestSummary: PublicSafeGuestRsvpSummary,
): PublicEventInviteView {
  const totalResponses = countResponses(guestSummary.rsvps);

  return {
    id: eventSummary.id,
    title: eventSummary.title,
    playgroupName: eventSummary.playgroup.name,
    dateLabel: dateFormatter.format(eventSummary.startsAt),
    timeLabel: formatTimeRange(eventSummary.startsAt, eventSummary.endsAt),
    locationName: eventSummary.location?.name ?? null,
    rsvpCounts: guestSummary.rsvps,
    guestRsvps: guestSummary.guestRsvps,
    namedGuests: guestSummary.namedGuests,
    totalResponses,
    expectedPlayers:
      guestSummary.rsvps.yes +
      guestSummary.rsvps.maybe +
      guestSummary.namedGuests,
    deckDeclarations: eventSummary.counts.deckDeclarations,
    pods: eventSummary.counts.pods,
    loggedGames: eventSummary.counts.loggedGames,
  };
}

export function getPublicRsvpRows(view: PublicEventInviteView) {
  return (Object.keys(rsvpLabels) as RsvpStatus[]).map((status) => ({
    status,
    label: rsvpLabels[status],
    count: view.rsvpCounts[status],
  }));
}

function formatTimeRange(startsAt: Date, endsAt: Date | null) {
  const startLabel = timeFormatter.format(startsAt);

  if (!endsAt) {
    return startLabel;
  }

  return `${startLabel} to ${timeFormatter.format(endsAt)}`;
}

function countResponses(counts: Record<RsvpStatus, number>) {
  return counts.yes + counts.maybe + counts.no + counts.waitlist;
}
