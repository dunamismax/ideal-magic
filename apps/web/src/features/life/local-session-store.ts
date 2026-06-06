import Dexie, { type Table } from "dexie";

import {
  LIFE_COUNTER_SCHEMA_VERSION,
  STANDALONE_LIFE_SESSION_ID,
  type LifeCounterSession,
} from "./session";

export type SavedLifeCounterGameMetadata = {
  gameId: string;
  eventId: string;
  podId?: string;
  savedAt: string;
  actionCount: number;
  actionCursor: number;
};

export type PersistedLifeCounterSession = LifeCounterSession & {
  persistedAt: string;
  savedGames?: SavedLifeCounterGameMetadata[];
};

export type LifeCounterCleanupResult = {
  deletedCount: number;
  keptActiveCount: number;
};

class LifeCounterDatabase extends Dexie {
  sessions!: Table<PersistedLifeCounterSession, string>;

  constructor() {
    super("pod-tracker-life-counter");

    this.version(1).stores({
      sessions: "id, updatedAt, schemaVersion",
    });
  }
}

let database: LifeCounterDatabase | null = null;

function getDatabase() {
  if (typeof window === "undefined") {
    return null;
  }

  database ??= new LifeCounterDatabase();
  return database;
}

export async function loadLifeCounterSession(sessionId: string) {
  const db = getDatabase();

  if (!db) {
    return null;
  }

  const session = await db.sessions.get(sessionId);

  if (!session || session.schemaVersion !== LIFE_COUNTER_SCHEMA_VERSION) {
    return null;
  }

  return stripPersistenceMetadata(session);
}

export async function saveLifeCounterSession(session: LifeCounterSession) {
  const db = getDatabase();

  if (!db) {
    return;
  }

  await db.transaction("rw", db.sessions, async () => {
    const existingSession = await db.sessions.get(session.id);

    await db.sessions.put(
      mergePersistedLifeCounterSession(session, existingSession),
    );
  });
}

export async function markLifeCounterSessionGameSaved(
  sessionId: string,
  savedGame: Pick<SavedLifeCounterGameMetadata, "gameId" | "eventId" | "podId">,
) {
  const db = getDatabase();

  if (!db) {
    return false;
  }

  return db.transaction("rw", db.sessions, async () => {
    const session = await db.sessions.get(sessionId);

    if (!session || session.schemaVersion !== LIFE_COUNTER_SCHEMA_VERSION) {
      return false;
    }

    await db.sessions.put(
      markPersistedLifeCounterSessionGameSaved(session, {
        ...savedGame,
        savedAt: new Date().toISOString(),
      }),
    );

    return true;
  });
}

export async function countCleanupEligibleLifeCounterSessions(input: {
  activeSessionId: string;
}) {
  const db = getDatabase();

  if (!db) {
    return 0;
  }

  const sessions = await db.sessions.toArray();

  return sessions.filter((session) =>
    isCleanupEligibleLifeCounterSession(session, input.activeSessionId),
  ).length;
}

export async function cleanupSavedLifeCounterSessions(input: {
  activeSessionId: string;
}): Promise<LifeCounterCleanupResult> {
  const db = getDatabase();

  if (!db) {
    return {
      deletedCount: 0,
      keptActiveCount: 0,
    };
  }

  const sessions = await db.sessions.toArray();
  const cleanupSessionIds = sessions
    .filter((session) =>
      isCleanupEligibleLifeCounterSession(session, input.activeSessionId),
    )
    .map((session) => session.id);
  const keptActiveCount = sessions.filter(
    (session) =>
      session.id === input.activeSessionId &&
      (session.savedGames?.length ?? 0) > 0,
  ).length;

  if (cleanupSessionIds.length > 0) {
    await db.sessions.bulkDelete(cleanupSessionIds);
  }

  return {
    deletedCount: cleanupSessionIds.length,
    keptActiveCount,
  };
}

export async function loadStandaloneLifeCounterSession() {
  return loadLifeCounterSession(STANDALONE_LIFE_SESSION_ID);
}

export async function saveStandaloneLifeCounterSession(
  session: LifeCounterSession,
) {
  return saveLifeCounterSession(session);
}

function stripPersistenceMetadata(
  session: PersistedLifeCounterSession,
): LifeCounterSession {
  const lifeCounterSession: Partial<PersistedLifeCounterSession> = {
    ...session,
  };
  delete lifeCounterSession.persistedAt;
  delete lifeCounterSession.savedGames;
  return lifeCounterSession as LifeCounterSession;
}

export function mergePersistedLifeCounterSession(
  session: LifeCounterSession,
  existingSession?: PersistedLifeCounterSession | null,
): PersistedLifeCounterSession {
  return {
    ...session,
    savedGames: existingSession?.savedGames ?? [],
    persistedAt: new Date().toISOString(),
  };
}

export function markPersistedLifeCounterSessionGameSaved(
  session: PersistedLifeCounterSession,
  savedGame: Pick<
    SavedLifeCounterGameMetadata,
    "gameId" | "eventId" | "podId" | "savedAt"
  >,
): PersistedLifeCounterSession {
  const nextSavedGame: SavedLifeCounterGameMetadata = {
    gameId: savedGame.gameId,
    eventId: savedGame.eventId,
    podId: savedGame.podId,
    savedAt: savedGame.savedAt,
    actionCount: session.history.actions.length,
    actionCursor: session.history.cursor,
  };
  const savedGames = [
    ...(session.savedGames ?? []).filter(
      (entry) => entry.gameId !== savedGame.gameId,
    ),
    nextSavedGame,
  ];

  return {
    ...session,
    savedGames,
    persistedAt: new Date().toISOString(),
  };
}

export function isCleanupEligibleLifeCounterSession(
  session: PersistedLifeCounterSession,
  activeSessionId: string,
) {
  return (
    session.id !== activeSessionId && (session.savedGames?.length ?? 0) > 0
  );
}
