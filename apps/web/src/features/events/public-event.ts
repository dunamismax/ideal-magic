import { randomUUID } from "node:crypto";

import type { AppDatabase } from "@/db/client";
import { eventRsvps } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  getPublicSafeEventSummaryByInviteToken,
  getPublicSafeGuestRsvpSummaryByInviteToken,
} from "@/db/queries/event-planning";
import {
  generateInviteToken,
  hashInviteToken,
  normalizeInviteToken,
} from "@/db/tokens";
import {
  toPublicEventInviteView,
  type PublicEventInviteView,
} from "./public-event-view";

type PublicEventDatabase = Pick<AppDatabase, "select">;
type PublicEventWriteDatabase = Pick<
  AppDatabase,
  "insert" | "select" | "transaction" | "update"
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

export type PublicGuestRsvpReceipt = {
  rsvpToken: string;
  guestName: string;
  status: RsvpStatus;
};

export type PublicGuestRsvpMutationResult = {
  event: PublicEventInviteView;
  guestRsvp: PublicGuestRsvpReceipt;
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
): Promise<PublicGuestRsvpMutationResult | null> {
  const rsvp = normalizePublicGuestRsvpInput(input);

  return db.transaction(async (tx) => {
    const eventSummary = await getPublicSafeEventSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!eventSummary) {
      return null;
    }

    const rsvpToken = generateInviteToken();
    const [created] = await tx
      .insert(eventRsvps)
      .values({
        id: randomUUID(),
        eventId: eventSummary.id,
        guestName: rsvp.guestName,
        guestEditTokenHash: hashInviteToken(rsvpToken),
        status: rsvp.status,
        notes: "",
      })
      .returning({
        guestName: eventRsvps.guestName,
        status: eventRsvps.status,
      });

    if (!created) {
      throw new Error("Expected guest RSVP insert to return a row.");
    }

    const guestSummary = await getPublicSafeGuestRsvpSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!guestSummary) {
      return null;
    }

    return {
      event: toPublicEventInviteView(eventSummary, guestSummary),
      guestRsvp: {
        rsvpToken,
        guestName: created.guestName ?? rsvp.guestName,
        status: asPublicGuestRsvpStatus(created.status) ?? rsvp.status,
      },
    };
  });
}

export async function getPublicGuestRsvp(
  db: PublicEventWriteDatabase,
  inviteToken: string,
  rsvpToken: string,
): Promise<PublicGuestRsvpMutationResult | null> {
  return db.transaction(async (tx) => {
    const eventSummary = await getPublicSafeEventSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!eventSummary) {
      return null;
    }

    const existing = await getTokenScopedGuestRsvp(tx, {
      eventId: eventSummary.id,
      rsvpToken,
    });

    if (!existing) {
      return null;
    }

    const guestSummary = await getPublicSafeGuestRsvpSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!guestSummary) {
      return null;
    }

    return {
      event: toPublicEventInviteView(eventSummary, guestSummary),
      guestRsvp: {
        rsvpToken,
        guestName: existing.guestName,
        status: existing.status,
      },
    };
  });
}

export async function updatePublicGuestRsvp(
  db: PublicEventWriteDatabase,
  inviteToken: string,
  rsvpToken: string,
  input: PublicGuestRsvpInput,
): Promise<PublicGuestRsvpMutationResult | null> {
  const rsvp = normalizePublicGuestRsvpInput(input);

  return db.transaction(async (tx) => {
    const eventSummary = await getPublicSafeEventSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!eventSummary) {
      return null;
    }

    const existing = await getTokenScopedGuestRsvp(tx, {
      eventId: eventSummary.id,
      rsvpToken,
    });

    if (!existing) {
      return null;
    }

    const [updated] = await tx
      .update(eventRsvps)
      .set({
        guestName: rsvp.guestName,
        status: rsvp.status,
        updatedAt: new Date(),
      })
      .where(eq(eventRsvps.id, existing.id))
      .returning({
        guestName: eventRsvps.guestName,
        status: eventRsvps.status,
      });

    if (!updated) {
      throw new Error("Expected guest RSVP update to return a row.");
    }

    const guestSummary = await getPublicSafeGuestRsvpSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!guestSummary) {
      return null;
    }

    return {
      event: toPublicEventInviteView(eventSummary, guestSummary),
      guestRsvp: {
        rsvpToken,
        guestName: updated.guestName ?? rsvp.guestName,
        status: asPublicGuestRsvpStatus(updated.status) ?? rsvp.status,
      },
    };
  });
}

export async function cancelPublicGuestRsvp(
  db: PublicEventWriteDatabase,
  inviteToken: string,
  rsvpToken: string,
): Promise<PublicGuestRsvpMutationResult | null> {
  return db.transaction(async (tx) => {
    const eventSummary = await getPublicSafeEventSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!eventSummary) {
      return null;
    }

    const existing = await getTokenScopedGuestRsvp(tx, {
      eventId: eventSummary.id,
      rsvpToken,
    });

    if (!existing) {
      return null;
    }

    const [updated] = await tx
      .update(eventRsvps)
      .set({
        status: "no",
        updatedAt: new Date(),
      })
      .where(eq(eventRsvps.id, existing.id))
      .returning({
        guestName: eventRsvps.guestName,
        status: eventRsvps.status,
      });

    if (!updated) {
      throw new Error("Expected guest RSVP cancellation to return a row.");
    }

    const guestSummary = await getPublicSafeGuestRsvpSummaryByInviteToken(tx, {
      inviteToken,
    });

    if (!guestSummary) {
      return null;
    }

    return {
      event: toPublicEventInviteView(eventSummary, guestSummary),
      guestRsvp: {
        rsvpToken,
        guestName: updated.guestName ?? existing.guestName,
        status: "no",
      },
    };
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

async function getTokenScopedGuestRsvp(
  db: PublicEventWriteDatabase,
  input: {
    eventId: string;
    rsvpToken: string;
  },
) {
  const normalizedRsvpToken = normalizeInviteToken(input.rsvpToken);

  if (!normalizedRsvpToken) {
    return null;
  }

  const [rsvp] = await db
    .select({
      id: eventRsvps.id,
      guestName: eventRsvps.guestName,
      status: eventRsvps.status,
    })
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, input.eventId),
        isNull(eventRsvps.userId),
        eq(eventRsvps.guestEditTokenHash, hashInviteToken(normalizedRsvpToken)),
      ),
    )
    .limit(1);
  const status = asPublicGuestRsvpStatus(rsvp?.status ?? null);
  const guestName = rsvp?.guestName?.trim();

  if (!rsvp || !status || !guestName) {
    return null;
  }

  return {
    id: rsvp.id,
    guestName,
    status,
  };
}

function asPublicGuestRsvpStatus(value: string | null): RsvpStatus | null {
  return includesString(publicGuestRsvpStatuses, value) ? value : null;
}
