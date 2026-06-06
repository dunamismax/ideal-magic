import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../client";
import { runInTransaction } from "../client";
import {
  events,
  lifeCounterSessions,
  lifeCounterSnapshots,
  playgroupMemberships,
  pods,
} from "../schema";
import { canRsvpToEvent, type PlaygroupRole } from "../scopes";
import {
  LIFE_COUNTER_SCHEMA_VERSION,
  type LifeCounterSession,
} from "@/features/life/session";

type LifeCounterReadDatabase = Pick<AppDatabase, "select">;
type LifeCounterWriteDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "update" | "transaction"
>;

export type LinkedLifeCounterKind = "event" | "pod";

export type LinkedLifeCounterServerSnapshot = {
  session: LifeCounterSession;
  serverActionSequence: number;
  serverUpdatedAt: string;
};

export type PersistLinkedLifeCounterSessionResult =
  | {
      ok: true;
      serverActionSequence: number;
      serverUpdatedAt: string;
    }
  | {
      ok: false;
      reason: "conflict";
      serverActionSequence: number;
      serverUpdatedAt: string;
      serverSession: LifeCounterSession | null;
    };

export class LinkedLifeCounterAuthorizationError extends Error {
  constructor() {
    super("Viewer cannot access this linked life counter.");
    this.name = "LinkedLifeCounterAuthorizationError";
  }
}

export class LinkedLifeCounterValidationError extends Error {
  constructor(message = "Linked life counter session is invalid.") {
    super(message);
    this.name = "LinkedLifeCounterValidationError";
  }
}

export async function getLinkedLifeCounterSessionForViewer(
  db: LifeCounterReadDatabase,
  input: {
    viewerUserId: string;
    kind: LinkedLifeCounterKind;
    eventId: string;
    podId?: string | null;
    localSessionKey: string;
  },
): Promise<LinkedLifeCounterServerSnapshot | null> {
  validateLinkedLifeCounterScopeInput(input);
  await assertLinkedLifeCounterAccess(db, input);

  const [row] = await db
    .select({
      rawState: lifeCounterSessions.rawState,
      lastActionSequence: lifeCounterSessions.lastActionSequence,
      updatedAt: lifeCounterSessions.updatedAt,
    })
    .from(lifeCounterSessions)
    .where(eq(lifeCounterSessions.localSessionKey, input.localSessionKey))
    .limit(1);

  if (!row) {
    return null;
  }

  const session = parseStoredLifeCounterSession(
    row.rawState,
    input.localSessionKey,
  );

  if (!session) {
    return null;
  }

  return {
    session,
    serverActionSequence: row.lastActionSequence,
    serverUpdatedAt: row.updatedAt.toISOString(),
  };
}

export async function persistLinkedLifeCounterSession(
  db: LifeCounterWriteDatabase,
  input: {
    viewerUserId: string;
    kind: LinkedLifeCounterKind;
    eventId: string;
    podId?: string | null;
    localSessionKey: string;
    expectedServerActionSequence: number | null;
    expectedServerUpdatedAt: string | null;
    session: LifeCounterSession;
  },
): Promise<PersistLinkedLifeCounterSessionResult> {
  validateLinkedLifeCounterSessionInput(input);

  return runInTransaction(db, async (tx) => {
    await assertLinkedLifeCounterAccess(tx, input);

    const [existing] = await tx
      .select({
        id: lifeCounterSessions.id,
        rawState: lifeCounterSessions.rawState,
        lastActionSequence: lifeCounterSessions.lastActionSequence,
        updatedAt: lifeCounterSessions.updatedAt,
      })
      .from(lifeCounterSessions)
      .where(eq(lifeCounterSessions.localSessionKey, input.localSessionKey))
      .limit(1);

    if (existing && hasServerConflict(existing, input)) {
      return {
        ok: false,
        reason: "conflict",
        serverActionSequence: existing.lastActionSequence,
        serverUpdatedAt: existing.updatedAt.toISOString(),
        serverSession: parseStoredLifeCounterSession(existing.rawState),
      };
    }

    if (!existing && input.expectedServerUpdatedAt !== null) {
      throw new LinkedLifeCounterValidationError(
        "Expected server snapshot does not exist.",
      );
    }

    const now = new Date();
    const lastActionSequence = getLocalActionSequence(input.session);
    const rawState = serializeLifeCounterSession(input.session);
    const startedAt = parseSessionDate(input.session.createdAt);

    const [stored] = existing
      ? await tx
          .update(lifeCounterSessions)
          .set({
            ownerUserId: input.viewerUserId,
            saveState: "saved_to_group",
            lastActionSequence,
            rawState,
            updatedAt: now,
          })
          .where(eq(lifeCounterSessions.id, existing.id))
          .returning({
            id: lifeCounterSessions.id,
            lastActionSequence: lifeCounterSessions.lastActionSequence,
            updatedAt: lifeCounterSessions.updatedAt,
          })
      : await tx
          .insert(lifeCounterSessions)
          .values({
            ownerUserId: input.viewerUserId,
            eventId: input.eventId,
            podId: input.kind === "pod" ? input.podId : null,
            localSessionKey: input.localSessionKey,
            mode: input.kind,
            saveState: "saved_to_group",
            startedAt,
            lastActionSequence,
            rawState,
            updatedAt: now,
          })
          .returning({
            id: lifeCounterSessions.id,
            lastActionSequence: lifeCounterSessions.lastActionSequence,
            updatedAt: lifeCounterSessions.updatedAt,
          });

    if (!stored) {
      throw new LinkedLifeCounterValidationError(
        "Linked life counter session could not be saved.",
      );
    }

    if (lastActionSequence > 0) {
      await tx
        .insert(lifeCounterSnapshots)
        .values({
          sessionId: stored.id,
          actionSequence: lastActionSequence,
          state: rawState,
        })
        .onConflictDoUpdate({
          target: [
            lifeCounterSnapshots.sessionId,
            lifeCounterSnapshots.actionSequence,
          ],
          set: {
            state: rawState,
          },
        });
    }

    return {
      ok: true,
      serverActionSequence: stored.lastActionSequence,
      serverUpdatedAt: stored.updatedAt.toISOString(),
    };
  });
}

async function assertLinkedLifeCounterAccess(
  db: LifeCounterReadDatabase,
  input: {
    viewerUserId: string;
    kind: LinkedLifeCounterKind;
    eventId: string;
    podId?: string | null;
  },
) {
  const [eventRow] = await db
    .select({
      id: events.id,
      playgroupId: events.playgroupId,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);

  if (!eventRow || eventRow.status === "archived") {
    throw new LinkedLifeCounterAuthorizationError();
  }

  const viewerRole = await getViewerRole(db, {
    playgroupId: eventRow.playgroupId,
    viewerUserId: input.viewerUserId,
  });

  if (!viewerRole || !canRsvpToEvent(viewerRole)) {
    throw new LinkedLifeCounterAuthorizationError();
  }

  if (input.kind !== "pod") {
    return;
  }

  if (!input.podId) {
    throw new LinkedLifeCounterValidationError("Pod id is required.");
  }

  const [podRow] = await db
    .select({
      id: pods.id,
      state: pods.state,
      publishedAt: pods.publishedAt,
    })
    .from(pods)
    .where(and(eq(pods.id, input.podId), eq(pods.eventId, input.eventId)))
    .limit(1);

  if (
    !podRow ||
    !podRow.publishedAt ||
    (podRow.state !== "locked" && podRow.state !== "completed")
  ) {
    throw new LinkedLifeCounterAuthorizationError();
  }
}

async function getViewerRole(
  db: LifeCounterReadDatabase,
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

function hasServerConflict(
  existing: {
    lastActionSequence: number;
    updatedAt: Date;
  },
  input: {
    expectedServerActionSequence: number | null;
    expectedServerUpdatedAt: string | null;
    session: LifeCounterSession;
  },
) {
  if (
    input.expectedServerActionSequence === null ||
    input.expectedServerUpdatedAt === null
  ) {
    return true;
  }

  if (existing.lastActionSequence !== input.expectedServerActionSequence) {
    return true;
  }

  if (existing.updatedAt.toISOString() !== input.expectedServerUpdatedAt) {
    return true;
  }

  return getLocalActionSequence(input.session) < existing.lastActionSequence;
}

function validateLinkedLifeCounterSessionInput(input: {
  kind: LinkedLifeCounterKind;
  eventId: string;
  podId?: string | null;
  localSessionKey: string;
  session: LifeCounterSession;
}) {
  validateLinkedLifeCounterScopeInput(input);

  if (input.session.id !== input.localSessionKey) {
    throw new LinkedLifeCounterValidationError(
      "Linked session key does not match scope.",
    );
  }

  if (input.session.schemaVersion !== LIFE_COUNTER_SCHEMA_VERSION) {
    throw new LinkedLifeCounterValidationError(
      "Linked session schema version is unsupported.",
    );
  }
}

function validateLinkedLifeCounterScopeInput(input: {
  kind: LinkedLifeCounterKind;
  eventId: string;
  podId?: string | null;
  localSessionKey: string;
}) {
  if (!isUuid(input.eventId)) {
    throw new LinkedLifeCounterValidationError("Event id is invalid.");
  }

  if (input.kind === "pod" && !isUuid(input.podId ?? "")) {
    throw new LinkedLifeCounterValidationError("Pod id is invalid.");
  }

  const expectedSessionKey = createLinkedSessionKey(
    input.kind,
    input.eventId,
    input.podId,
  );

  if (
    input.localSessionKey !== expectedSessionKey
  ) {
    throw new LinkedLifeCounterValidationError(
      "Linked session key does not match scope.",
    );
  }
}

function createLinkedSessionKey(
  kind: LinkedLifeCounterKind,
  eventId: string,
  podId?: string | null,
) {
  return ["linked-life", kind, eventId, podId].filter(Boolean).join(":");
}

function getLocalActionSequence(session: LifeCounterSession) {
  return session.history.actions.length;
}

function serializeLifeCounterSession(
  session: LifeCounterSession,
): Record<string, unknown> {
  return structuredClone(session) as unknown as Record<string, unknown>;
}

function parseStoredLifeCounterSession(
  value: Record<string, unknown>,
  expectedSessionKey?: string,
): LifeCounterSession | null {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.id !== "string" ||
    (expectedSessionKey && value.id !== expectedSessionKey) ||
    value.schemaVersion !== LIFE_COUNTER_SCHEMA_VERSION ||
    !Array.isArray(value.players)
  ) {
    return null;
  }

  return value as unknown as LifeCounterSession;
}

function parseSessionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return new Date();
  }

  return date;
}

function asPlaygroupRole(value: string | null): PlaygroupRole | null {
  switch (value) {
    case "owner":
    case "admin":
    case "member":
    case "host":
    case "guest":
    case "viewer":
      return value;
    default:
      return null;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
