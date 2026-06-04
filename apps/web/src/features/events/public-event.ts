import { randomUUID } from "node:crypto";

import type { AppDatabase } from "@/db/client";
import { eventRsvps } from "@/db/schema";
import {
  getPublicSafeEventSummaryByInviteToken,
  getPublicSafeGuestRsvpSummaryByInviteToken,
  type PublicSafeEventSummary,
  type PublicSafeGuestRsvpSummary,
} from "@/db/queries/event-planning";

type PublicEventDatabase = Pick<AppDatabase, "select">;
type PublicEventWriteDatabase = Pick<
  AppDatabase,
  "insert" | "select" | "transaction"
>;

type RsvpStatus = "yes" | "maybe" | "no" | "waitlist";

export type PublicGuestRsvpInput = {
  guestName: unknown;
  status: unknown;
};

export type PublicGuestRsvpForm = {
  guestName: string;
  status: RsvpStatus;
};

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

const publicGuestRsvpStatuses = ["yes", "maybe", "no", "waitlist"] as const;
const guestNameMaxLength = 80;

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

export async function getPublicEventInviteView(
  db: PublicEventDatabase,
  inviteToken: string,
): Promise<PublicEventInviteView | null> {
  const [eventSummary, guestSummary] = await Promise.all([
    getPublicSafeEventSummaryByInviteToken(db, { inviteToken }),
    getPublicSafeGuestRsvpSummaryByInviteToken(db, { inviteToken }),
  ]);

  if (!eventSummary || !guestSummary) {
    return null;
  }

  return toPublicEventInviteView(eventSummary, guestSummary);
}

export async function createPublicGuestRsvp(
  db: PublicEventWriteDatabase,
  inviteToken: string,
  input: PublicGuestRsvpInput,
): Promise<PublicEventInviteView | null> {
  const rsvp = normalizePublicGuestRsvpInput(input);

  return db.transaction(async (tx) => {
    const eventSummary = await getPublicSafeEventSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!eventSummary) {
      return null;
    }

    await tx.insert(eventRsvps).values({
      id: randomUUID(),
      eventId: eventSummary.id,
      guestName: rsvp.guestName,
      status: rsvp.status,
      notes: "",
    });

    const guestSummary = await getPublicSafeGuestRsvpSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!guestSummary) {
      return null;
    }

    return toPublicEventInviteView(eventSummary, guestSummary);
  });
}

export function normalizePublicGuestRsvpInput(
  input: PublicGuestRsvpInput,
): PublicGuestRsvpForm {
  const guestName =
    typeof input.guestName === "string"
      ? input.guestName.trim().replace(/\s+/g, " ")
      : "";
  const status = typeof input.status === "string" ? input.status : "";

  if (!guestName) {
    throw new PublicGuestRsvpValidationError({
      guestName: "Enter a guest name.",
    });
  }

  if (guestName.length > guestNameMaxLength) {
    throw new PublicGuestRsvpValidationError({
      guestName: `Use ${guestNameMaxLength} characters or fewer.`,
    });
  }

  if (!includesString(publicGuestRsvpStatuses, status)) {
    throw new PublicGuestRsvpValidationError({
      status: "Choose an RSVP status.",
    });
  }

  return {
    guestName,
    status,
  };
}

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

export class PublicGuestRsvpValidationError extends Error {
  fieldErrors: Partial<Record<keyof PublicGuestRsvpForm, string>>;

  constructor(fieldErrors: Partial<Record<keyof PublicGuestRsvpForm, string>>) {
    super("Guest RSVP validation failed");
    this.name = "PublicGuestRsvpValidationError";
    this.fieldErrors = fieldErrors;
  }
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

function includesString<const T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return value !== null && values.includes(value as T);
}
