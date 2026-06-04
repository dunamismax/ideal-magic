import { randomUUID } from "node:crypto";

import type { AppDatabase } from "@/db/client";
import { eventRsvps } from "@/db/schema";
import {
  getPublicSafeEventSummaryByInviteToken,
  getPublicSafeGuestRsvpSummaryByInviteToken,
} from "@/db/queries/event-planning";
import {
  toPublicEventInviteView,
  type PublicEventInviteView,
} from "./public-event-view";

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

const publicGuestRsvpStatuses = ["yes", "maybe", "no", "waitlist"] as const;
const guestNameMaxLength = 80;

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

export class PublicGuestRsvpValidationError extends Error {
  fieldErrors: Partial<Record<keyof PublicGuestRsvpForm, string>>;

  constructor(fieldErrors: Partial<Record<keyof PublicGuestRsvpForm, string>>) {
    super("Guest RSVP validation failed");
    this.name = "PublicGuestRsvpValidationError";
    this.fieldErrors = fieldErrors;
  }
}

function includesString<const T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return value !== null && values.includes(value as T);
}
