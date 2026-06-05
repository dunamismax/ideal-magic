import { and, asc, eq, sql } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import {
  eventDeckDeclarations,
  eventRsvps,
  events,
  games,
  lifeCounterSessions,
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
  "select" | "insert" | "delete" | "update" | "transaction"
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
  publishedAt: Date | null;
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

export class PodSeatMoveAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot move pod seats for this event.");
    this.name = "PodSeatMoveAuthorizationError";
  }
}

export class PodSeatMoveBlockedError extends Error {
  constructor(message = "Pod seat cannot be moved.") {
    super(message);
    this.name = "PodSeatMoveBlockedError";
  }
}

export class PodPublicationAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot publish pods for this event.");
    this.name = "PodPublicationAuthorizationError";
  }
}

export class PodPublicationBlockedError extends Error {
  constructor(message = "Pod assignments cannot be published.") {
    super(message);
    this.name = "PodPublicationBlockedError";
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
      publishedAt: pods.publishedAt,
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
        publishedAt: row.publishedAt,
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

export async function publishPodsForEventManager(
  db: PodWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
  },
): Promise<EventPodSummary[]> {
  return runInTransaction(db, async (tx) => {
    const eventRow = await authorizePodPublication(tx, input);
    const eventPods = await listPodStateRows(tx, input.eventId);

    if (eventPods.length === 0) {
      throw new PodPublicationBlockedError(
        "Generate draft pods before publishing.",
      );
    }

    if (eventPods.some((pod) => pod.state !== "proposed")) {
      throw new PodPublicationBlockedError(
        "Only proposed pods can be published.",
      );
    }

    const now = new Date();

    await tx
      .update(pods)
      .set({
        state: "locked",
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(pods.eventId, input.eventId));

    return listPodsForEventViewer(tx, {
      viewerUserId: input.viewerUserId,
      eventId: eventRow.id,
    });
  });
}

export async function unpublishPodsForEventManager(
  db: PodWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
  },
): Promise<EventPodSummary[]> {
  return runInTransaction(db, async (tx) => {
    const eventRow = await authorizePodPublication(tx, input);
    const eventPods = await listPodStateRows(tx, input.eventId);

    if (eventPods.length === 0) {
      throw new PodPublicationBlockedError(
        "There are no published pods to unpublish.",
      );
    }

    if (
      eventPods.some(
        (pod) => pod.state === "active" || pod.state === "completed",
      )
    ) {
      throw new PodPublicationBlockedError(
        "Active or completed pods cannot be unpublished.",
      );
    }

    if (eventPods.some((pod) => pod.state !== "locked" || !pod.publishedAt)) {
      throw new PodPublicationBlockedError(
        "Only published pods can be unpublished.",
      );
    }

    if (await hasLinkedPodRecords(tx, input.eventId)) {
      throw new PodPublicationBlockedError(
        "Pods linked to games or saved counters cannot be unpublished.",
      );
    }

    const now = new Date();

    await tx
      .update(pods)
      .set({
        state: "proposed",
        publishedAt: null,
        updatedAt: now,
      })
      .where(eq(pods.eventId, input.eventId));

    return listPodsForEventViewer(tx, {
      viewerUserId: input.viewerUserId,
      eventId: eventRow.id,
    });
  });
}

export async function movePodSeatForEventManager(
  db: PodWriteDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
    seatId: string;
    targetPodId: string;
    targetSeatPosition: number;
  },
): Promise<EventPodSummary[]> {
  return runInTransaction(db, async (tx) => {
    const eventRow = await getEventForPodAccess(tx, input.eventId);

    if (!eventRow || eventRow.status !== "scheduled") {
      throw new PodSeatMoveAuthorizationError();
    }

    const viewerRole = await getViewerRole(tx, {
      playgroupId: eventRow.playgroupId,
      viewerUserId: input.viewerUserId,
    });

    if (!viewerRole || !canManageEvent(viewerRole)) {
      throw new PodSeatMoveAuthorizationError();
    }

    const [seatRow] = await tx
      .select({
        id: podSeats.id,
        podId: podSeats.podId,
        eventId: podSeats.eventId,
        seatPosition: podSeats.seatPosition,
        locked: podSeats.locked,
        participantDisplayName: playgroupMemberships.displayName,
        userName: users.name,
        guestName: podSeats.guestName,
        sourcePodId: pods.id,
        sourcePodName: pods.name,
        sourcePodState: pods.state,
      })
      .from(podSeats)
      .innerJoin(pods, eq(pods.id, podSeats.podId))
      .leftJoin(users, eq(users.id, podSeats.userId))
      .leftJoin(
        playgroupMemberships,
        and(
          eq(playgroupMemberships.playgroupId, eventRow.playgroupId),
          eq(playgroupMemberships.userId, podSeats.userId),
        ),
      )
      .where(eq(podSeats.id, input.seatId))
      .limit(1);

    if (!seatRow || seatRow.eventId !== input.eventId) {
      throw new PodSeatMoveAuthorizationError();
    }

    if (seatRow.locked) {
      throw new PodSeatMoveBlockedError("Locked seats cannot be moved.");
    }

    if (seatRow.sourcePodState !== "proposed") {
      throw new PodSeatMoveBlockedError("Only proposed pods can be adjusted.");
    }

    const [targetPod] = await tx
      .select({
        id: pods.id,
        eventId: pods.eventId,
        name: pods.name,
        state: pods.state,
      })
      .from(pods)
      .where(eq(pods.id, input.targetPodId))
      .limit(1);

    if (!targetPod || targetPod.eventId !== input.eventId) {
      throw new PodSeatMoveAuthorizationError();
    }

    if (targetPod.state !== "proposed") {
      throw new PodSeatMoveBlockedError("Only proposed pods can be adjusted.");
    }

    const sourceSeats = await listSeatOrderRows(tx, seatRow.podId);
    const targetSeats =
      targetPod.id === seatRow.podId
        ? sourceSeats
        : await listSeatOrderRows(tx, targetPod.id);
    const maxTargetPosition =
      targetPod.id === seatRow.podId
        ? targetSeats.length
        : targetSeats.length + 1;

    if (input.targetSeatPosition > maxTargetPosition) {
      throw new PodSeatMoveBlockedError(
        "Target seat position is outside that pod.",
      );
    }

    if (
      targetPod.id === seatRow.podId &&
      input.targetSeatPosition === seatRow.seatPosition
    ) {
      return listPodsForEventViewer(tx, input);
    }

    if (
      targetSeats.some(
        (seat) =>
          seat.id !== seatRow.id &&
          seat.locked &&
          seat.seatPosition >= input.targetSeatPosition,
      )
    ) {
      throw new PodSeatMoveBlockedError(
        "Locked target seats cannot be shifted.",
      );
    }

    const updatedOrders = createMovedSeatOrders({
      sourcePodId: seatRow.podId,
      targetPodId: targetPod.id,
      movingSeatId: seatRow.id,
      targetSeatPosition: input.targetSeatPosition,
      sourceSeats,
      targetSeats,
    });
    const now = new Date();

    await applySeatOrders(tx, updatedOrders, {
      baseTemporarySeatPosition: 10_000,
      updatedAt: now,
    });
    await applySeatOrders(tx, updatedOrders, {
      baseTemporarySeatPosition: null,
      updatedAt: now,
    });

    return listPodsForEventViewer(tx, input);
  });
}

async function authorizePodPublication(
  db: PodReadDatabase,
  input: {
    viewerUserId: string;
    eventId: string;
  },
) {
  const eventRow = await getEventForPodAccess(db, input.eventId);

  if (!eventRow || eventRow.status !== "scheduled") {
    throw new PodPublicationAuthorizationError();
  }

  const viewerRole = await getViewerRole(db, {
    playgroupId: eventRow.playgroupId,
    viewerUserId: input.viewerUserId,
  });

  if (!viewerRole || !canManageEvent(viewerRole)) {
    throw new PodPublicationAuthorizationError();
  }

  return eventRow;
}

async function listPodStateRows(db: PodReadDatabase, eventId: string) {
  return db
    .select({
      id: pods.id,
      state: pods.state,
      publishedAt: pods.publishedAt,
    })
    .from(pods)
    .where(eq(pods.eventId, eventId))
    .orderBy(asc(pods.position));
}

async function hasLinkedPodRecords(db: PodReadDatabase, eventId: string) {
  const [gameRow] = await db
    .select({
      id: games.id,
    })
    .from(games)
    .where(and(eq(games.eventId, eventId), sql`${games.podId} is not null`))
    .limit(1);

  if (gameRow) {
    return true;
  }

  const [counterRow] = await db
    .select({
      id: lifeCounterSessions.id,
    })
    .from(lifeCounterSessions)
    .where(
      and(
        eq(lifeCounterSessions.eventId, eventId),
        sql`${lifeCounterSessions.podId} is not null`,
      ),
    )
    .limit(1);

  return Boolean(counterRow);
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

type SeatOrderRow = {
  id: string;
  podId: string;
  seatPosition: number;
  locked: boolean;
};

type SeatOrderUpdate = {
  id: string;
  podId: string;
  seatPosition: number;
};

async function listSeatOrderRows(
  db: PodReadDatabase,
  podId: string,
): Promise<SeatOrderRow[]> {
  return db
    .select({
      id: podSeats.id,
      podId: podSeats.podId,
      seatPosition: podSeats.seatPosition,
      locked: podSeats.locked,
    })
    .from(podSeats)
    .where(eq(podSeats.podId, podId))
    .orderBy(asc(podSeats.seatPosition), asc(podSeats.id));
}

function createMovedSeatOrders(input: {
  sourcePodId: string;
  targetPodId: string;
  movingSeatId: string;
  targetSeatPosition: number;
  sourceSeats: SeatOrderRow[];
  targetSeats: SeatOrderRow[];
}): SeatOrderUpdate[] {
  if (input.sourcePodId === input.targetPodId) {
    const reorderedSeats = input.sourceSeats.filter(
      (seat) => seat.id !== input.movingSeatId,
    );
    const movingSeat = input.sourceSeats.find(
      (seat) => seat.id === input.movingSeatId,
    );

    if (!movingSeat) {
      throw new PodSeatMoveBlockedError("Seat no longer exists.");
    }

    reorderedSeats.splice(input.targetSeatPosition - 1, 0, movingSeat);

    return reorderedSeats.map((seat, index) => ({
      id: seat.id,
      podId: input.targetPodId,
      seatPosition: index + 1,
    }));
  }

  const sourceUpdates = input.sourceSeats
    .filter((seat) => seat.id !== input.movingSeatId)
    .map((seat, index) => ({
      id: seat.id,
      podId: input.sourcePodId,
      seatPosition: index + 1,
    }));
  const targetSeats = input.targetSeats.filter(
    (seat) => seat.id !== input.movingSeatId,
  );

  targetSeats.splice(input.targetSeatPosition - 1, 0, {
    id: input.movingSeatId,
    podId: input.targetPodId,
    seatPosition: input.targetSeatPosition,
    locked: false,
  });

  return [
    ...sourceUpdates,
    ...targetSeats.map((seat, index) => ({
      id: seat.id,
      podId: input.targetPodId,
      seatPosition: index + 1,
    })),
  ];
}

async function applySeatOrders(
  db: Pick<AppDatabase, "update">,
  updates: SeatOrderUpdate[],
  input: {
    baseTemporarySeatPosition: number | null;
    updatedAt: Date;
  },
) {
  for (const [index, update] of updates.entries()) {
    await db
      .update(podSeats)
      .set({
        podId: update.podId,
        seatPosition:
          input.baseTemporarySeatPosition === null
            ? update.seatPosition
            : input.baseTemporarySeatPosition + index,
        updatedAt: input.updatedAt,
      })
      .where(eq(podSeats.id, update.id));
  }
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
