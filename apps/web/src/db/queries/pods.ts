import { and, asc, eq, sql } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import {
  eventDeckDeclarations,
  eventRsvps,
  events,
  playgroupMemberships,
  podSeats,
  pods,
  users,
} from "../schema";
import { canManageEvent, canRsvpToEvent, type PlaygroupRole } from "../scopes";
import {
  generateDraftPodAssignments,
  type PodGenerationDeckSnapshot,
  type PodGenerationParticipant,
} from "@/features/pods/pod-generation";

type PodReadDatabase = Pick<AppDatabase, "select">;
type PodWriteDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "delete" | "transaction"
>;

export type PodState =
  | "proposed"
  | "locked"
  | "active"
  | "completed"
  | "cancelled";

export type EventPodSeatSummary = {
  id: string;
  seatPosition: number;
  participantName: string;
  rsvpStatus: "yes" | "maybe" | "no" | "waitlist";
  locked: boolean;
  deck: {
    declarationId: string;
    deckId: string;
    deckNameSnapshot: string;
    commanderSnapshot: string[];
    colorIdentitySnapshot: string;
    bracketSnapshot: "1" | "2" | "3" | "4" | "5" | null;
    powerEstimateSnapshot: number | null;
    archetypeSnapshot: string;
  } | null;
};

export type EventPodSummary = {
  id: string;
  eventId: string;
  name: string;
  state: PodState;
  position: number;
  sizeFitScore: number;
  bracketCompatibilityScore: number;
  availabilityWindowScore: number;
  totalScore: number;
  scoringDetails: Record<string, unknown>;
  seats: EventPodSeatSummary[];
};

export class PodGenerationAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot generate pods for this event.");
    this.name = "PodGenerationAuthorizationError";
  }
}

export class PodGenerationBlockedByExistingPodsError extends Error {
  constructor() {
    super("Existing non-draft pods cannot be overwritten.");
    this.name = "PodGenerationBlockedByExistingPodsError";
  }
}

const podStates = [
  "proposed",
  "locked",
  "active",
  "completed",
  "cancelled",
] as const;
const rsvpStatuses = ["yes", "maybe", "no", "waitlist"] as const;
const playgroupRoles = [
  "owner",
  "admin",
  "member",
  "host",
  "guest",
  "viewer",
] as const;
const brackets = ["1", "2", "3", "4", "5"] as const;

export async function generateDraftPodsForEvent(
  db: PodWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
  },
): Promise<EventPodSummary[]> {
  return runInTransaction(db, async (tx) => {
    const eventRow = await getEventForPodAccess(tx, input.eventId);

    if (!eventRow || eventRow.status !== "scheduled") {
      throw new PodGenerationAuthorizationError();
    }

    const viewerRole = await getViewerRole(tx, {
      playgroupId: eventRow.playgroupId,
      viewerUserId: input.viewerUserId,
    });

    if (!viewerRole || !canManageEvent(viewerRole)) {
      throw new PodGenerationAuthorizationError();
    }

    const existingNonDraftPods = await tx
      .select({
        id: pods.id,
      })
      .from(pods)
      .where(
        and(eq(pods.eventId, input.eventId), sql`${pods.state} <> 'proposed'`),
      )
      .limit(1);

    if (existingNonDraftPods.length > 0) {
      throw new PodGenerationBlockedByExistingPodsError();
    }

    const participants = await listEligiblePodParticipants(tx, {
      eventId: input.eventId,
      playgroupId: eventRow.playgroupId,
    });
    const drafts = generateDraftPodAssignments(participants);

    await tx
      .delete(pods)
      .where(and(eq(pods.eventId, input.eventId), eq(pods.state, "proposed")));

    for (const draft of drafts) {
      const [pod] = await tx
        .insert(pods)
        .values({
          eventId: input.eventId,
          name: draft.name,
          state: "proposed",
          position: draft.position,
          sizeFitScore: draft.sizeFitScore,
          bracketCompatibilityScore: draft.bracketCompatibilityScore,
          repeatPlayerPairPenalty: draft.repeatPlayerPairPenalty,
          repeatDeckMatchupPenalty: draft.repeatDeckMatchupPenalty,
          guestPlacementScore: draft.guestPlacementScore,
          availabilityWindowScore: draft.availabilityWindowScore,
          totalScore: draft.totalScore,
          scoringDetails: draft.scoringDetails,
          publishedAt: null,
        })
        .returning({
          id: pods.id,
        });

      if (!pod) {
        throw new Error("Expected pod insert to return a row.");
      }

      if (draft.seats.length > 0) {
        await tx.insert(podSeats).values(
          draft.seats.map((seat) => ({
            podId: pod.id,
            eventId: input.eventId,
            rsvpId: seat.rsvpId,
            userId: seat.userId,
            guestName: null,
            deckDeclarationId: seat.deckDeclaration?.id ?? null,
            deckId: seat.deckDeclaration?.deckId ?? null,
            seatPosition: seat.seatPosition,
            locked: false,
            arrivalTime: seat.arrivalTime,
            leavingTime: seat.leavingTime,
          })),
        );
      }
    }

    return listPodsForEventViewer(tx, input);
  });
}

export async function listPodsForEventViewer(
  db: PodReadDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
  },
): Promise<EventPodSummary[]> {
  const eventRow = await getEventForPodAccess(db, input.eventId);

  if (!eventRow || eventRow.status === "archived") {
    return [];
  }

  const viewerRole = await getViewerRole(db, {
    playgroupId: eventRow.playgroupId,
    viewerUserId: input.viewerUserId,
  });

  if (!viewerRole || !canRsvpToEvent(viewerRole)) {
    return [];
  }

  const rows = await db
    .select({
      podId: pods.id,
      eventId: pods.eventId,
      podName: pods.name,
      state: pods.state,
      podPosition: pods.position,
      sizeFitScore: pods.sizeFitScore,
      bracketCompatibilityScore: pods.bracketCompatibilityScore,
      availabilityWindowScore: pods.availabilityWindowScore,
      totalScore: pods.totalScore,
      scoringDetails: pods.scoringDetails,
      seatId: podSeats.id,
      seatPosition: podSeats.seatPosition,
      seatLocked: podSeats.locked,
      guestName: podSeats.guestName,
      displayName: playgroupMemberships.displayName,
      userName: users.name,
      rsvpStatus: eventRsvps.status,
      declarationId: eventDeckDeclarations.id,
      deckId: eventDeckDeclarations.deckId,
      deckNameSnapshot: eventDeckDeclarations.deckNameSnapshot,
      commanderSnapshot: eventDeckDeclarations.commanderSnapshot,
      colorIdentitySnapshot: eventDeckDeclarations.colorIdentitySnapshot,
      bracketSnapshot: eventDeckDeclarations.bracketSnapshot,
      powerEstimateSnapshot: eventDeckDeclarations.powerEstimateSnapshot,
      archetypeSnapshot: eventDeckDeclarations.archetypeSnapshot,
    })
    .from(pods)
    .innerJoin(podSeats, eq(podSeats.podId, pods.id))
    .innerJoin(eventRsvps, eq(eventRsvps.id, podSeats.rsvpId))
    .leftJoin(users, eq(users.id, podSeats.userId))
    .leftJoin(
      playgroupMemberships,
      and(
        eq(playgroupMemberships.playgroupId, eventRow.playgroupId),
        eq(playgroupMemberships.userId, podSeats.userId),
      ),
    )
    .leftJoin(
      eventDeckDeclarations,
      eq(eventDeckDeclarations.id, podSeats.deckDeclarationId),
    )
    .where(eq(pods.eventId, input.eventId))
    .orderBy(asc(pods.position), asc(podSeats.seatPosition));

  const podsById = new Map<string, EventPodSummary>();

  for (const row of rows) {
    const pod =
      podsById.get(row.podId) ??
      ({
        id: row.podId,
        eventId: row.eventId,
        name: row.podName,
        state: asPodState(row.state),
        position: row.podPosition,
        sizeFitScore: row.sizeFitScore,
        bracketCompatibilityScore: row.bracketCompatibilityScore,
        availabilityWindowScore: row.availabilityWindowScore,
        totalScore: row.totalScore,
        scoringDetails: row.scoringDetails,
        seats: [],
      } satisfies EventPodSummary);

    pod.seats.push({
      id: row.seatId,
      seatPosition: row.seatPosition,
      participantName:
        row.guestName === null
          ? row.displayName || row.userName || "Player"
          : "Guest RSVP",
      rsvpStatus: asRsvpStatus(row.rsvpStatus),
      locked: row.seatLocked,
      deck: row.declarationId
        ? {
            declarationId: row.declarationId,
            deckId: row.deckId ?? "",
            deckNameSnapshot: row.deckNameSnapshot ?? "",
            commanderSnapshot: row.commanderSnapshot ?? [],
            colorIdentitySnapshot: row.colorIdentitySnapshot ?? "",
            bracketSnapshot: asBracket(row.bracketSnapshot),
            powerEstimateSnapshot: row.powerEstimateSnapshot,
            archetypeSnapshot: row.archetypeSnapshot ?? "",
          }
        : null,
    });
    podsById.set(pod.id, pod);
  }

  return [...podsById.values()];
}

async function listEligiblePodParticipants(
  db: PodReadDatabase,
  input: {
    eventId: string;
    playgroupId: string;
  },
): Promise<PodGenerationParticipant[]> {
  const [rsvpRows, declarationRows] = await Promise.all([
    db
      .select({
        rsvpId: eventRsvps.id,
        userId: eventRsvps.userId,
        status: eventRsvps.status,
        arrivalTime: eventRsvps.arrivalTime,
        leavingTime: eventRsvps.leavingTime,
        displayName: playgroupMemberships.displayName,
        userName: users.name,
      })
      .from(eventRsvps)
      .innerJoin(users, eq(users.id, eventRsvps.userId))
      .innerJoin(
        playgroupMemberships,
        and(
          eq(playgroupMemberships.playgroupId, input.playgroupId),
          eq(playgroupMemberships.userId, eventRsvps.userId),
        ),
      )
      .where(
        and(
          eq(eventRsvps.eventId, input.eventId),
          sql`${eventRsvps.userId} is not null`,
          sql`${eventRsvps.status} in ('yes', 'maybe')`,
        ),
      )
      .orderBy(asc(playgroupMemberships.displayName), asc(eventRsvps.id)),
    db
      .select({
        id: eventDeckDeclarations.id,
        userId: eventDeckDeclarations.userId,
        deckId: eventDeckDeclarations.deckId,
        preference: eventDeckDeclarations.preference,
        deckNameSnapshot: eventDeckDeclarations.deckNameSnapshot,
        commanderSnapshot: eventDeckDeclarations.commanderSnapshot,
        colorIdentitySnapshot: eventDeckDeclarations.colorIdentitySnapshot,
        bracketSnapshot: eventDeckDeclarations.bracketSnapshot,
        powerEstimateSnapshot: eventDeckDeclarations.powerEstimateSnapshot,
        archetypeSnapshot: eventDeckDeclarations.archetypeSnapshot,
      })
      .from(eventDeckDeclarations)
      .where(eq(eventDeckDeclarations.eventId, input.eventId))
      .orderBy(
        asc(eventDeckDeclarations.userId),
        asc(eventDeckDeclarations.preference),
        asc(eventDeckDeclarations.id),
      ),
  ]);
  const declarationsByUserId = new Map<string, PodGenerationDeckSnapshot>();

  for (const declaration of declarationRows) {
    if (!declarationsByUserId.has(declaration.userId)) {
      declarationsByUserId.set(declaration.userId, {
        id: declaration.id,
        deckId: declaration.deckId,
        deckNameSnapshot: declaration.deckNameSnapshot,
        commanderSnapshot: declaration.commanderSnapshot,
        colorIdentitySnapshot: declaration.colorIdentitySnapshot,
        bracketSnapshot: asBracket(declaration.bracketSnapshot),
        powerEstimateSnapshot: declaration.powerEstimateSnapshot,
        archetypeSnapshot: declaration.archetypeSnapshot,
      });
    }
  }

  return rsvpRows
    .map((row): PodGenerationParticipant | null => {
      const status = asEligibleRsvpStatus(row.status);

      if (!row.userId || !status) {
        return null;
      }

      return {
        rsvpId: row.rsvpId,
        userId: row.userId,
        displayName: row.displayName || row.userName || "Player",
        rsvpStatus: status,
        arrivalTime: row.arrivalTime,
        leavingTime: row.leavingTime,
        deckDeclaration: declarationsByUserId.get(row.userId) ?? null,
      };
    })
    .filter((participant) => participant !== null);
}

async function getEventForPodAccess(db: PodReadDatabase, eventId: string) {
  const [eventRow] = await db
    .select({
      id: events.id,
      playgroupId: events.playgroupId,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  return eventRow ?? null;
}

async function getViewerRole(
  db: PodReadDatabase,
  input: {
    playgroupId: string;
    viewerUserId: string;
  },
) {
  const [membership] = await db
    .select({
      role: playgroupMemberships.role,
    })
    .from(playgroupMemberships)
    .where(
      and(
        eq(playgroupMemberships.playgroupId, input.playgroupId),
        eq(playgroupMemberships.userId, input.viewerUserId),
      ),
    )
    .limit(1);

  return asPlaygroupRole(membership?.role ?? null);
}

function asPodState(value: string): PodState {
  return includesString(podStates, value) ? value : "proposed";
}

function asRsvpStatus(value: string) {
  return includesString(rsvpStatuses, value) ? value : "yes";
}

function asEligibleRsvpStatus(value: string) {
  return value === "yes" || value === "maybe" ? value : null;
}

function asPlaygroupRole(value: string | null): PlaygroupRole | null {
  return includesString(playgroupRoles, value) ? value : null;
}

function asBracket(value: string | null) {
  return includesString(brackets, value) ? value : null;
}

function includesString<const T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return value !== null && values.includes(value as T);
}
