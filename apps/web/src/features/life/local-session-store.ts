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

export async function loadStandaloneLifeCounterSession() {
  const db = getDatabase();

  if (!db) {
    return null;
  }

  const session = await db.sessions.get(STANDALONE_LIFE_SESSION_ID);

  if (!session || session.schemaVersion !== LIFE_COUNTER_SCHEMA_VERSION) {
    return null;
  }

  return stripPersistenceMetadata(session);
}

export async function saveStandaloneLifeCounterSession(
  session: LifeCounterSession,
) {
  const db = getDatabase();

  if (!db) {
    return;
  }

  await db.sessions.put({
    ...session,
    persistedAt: new Date().toISOString(),
  });
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
