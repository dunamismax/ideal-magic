import Dexie, { type Table } from "dexie";

import {
  LIFE_COUNTER_SCHEMA_VERSION,
  STANDALONE_LIFE_SESSION_ID,
  type LifeCounterSession,
} from "./session";

type PersistedLifeCounterSession = LifeCounterSession & {
  persistedAt: string;
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

  await db.sessions.put({
    ...session,
    persistedAt: new Date().toISOString(),
  });
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
  return lifeCounterSession as LifeCounterSession;
}
