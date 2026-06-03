export type Commander = {
  id: string;
  name: string;
  castCount: number;
  damageByDefender: Record<string, number>;
};

export type PlayerStatus = "active" | "eliminated" | "winner";
export type GameResult = "in-progress" | "winner" | "draw" | "no-contest";
export type DayNightState = "unset" | "day" | "night";
export type PlayerCounterKey = "experience" | "energy" | "rad" | "treasure";
export type ManaSymbol = "W" | "U" | "B" | "R" | "G" | "C";
export type TableRole = "monarch" | "initiative";

export type CustomCounter = {
  id: string;
  name: string;
  value: number;
};

export type Player = {
  id: string;
  seat: string;
  name: string;
  commanders: Commander[];
  deck: string;
  color: string;
  life: number;
  poison: number;
  status: PlayerStatus;
  cityBlessing: boolean;
  experience: number;
  energy: number;
  rad: number;
  treasure: number;
  floatingMana: Record<ManaSymbol, number>;
  customCounters: CustomCounter[];
};

export type LifeCounterSnapshot = {
  startingLife: number;
  playerCount: number;
  activePlayerId: string;
  gameElapsedSeconds: number;
  turnElapsedSeconds: number;
  timersRunning: boolean;
  turnCount: number;
  monarchPlayerId: string | null;
  initiativePlayerId: string | null;
  dayNight: DayNightState;
  stormCount: number;
  gameResult: GameResult;
  players: Player[];
};

type SnapshotPayload = {
  before: LifeCounterSnapshot;
  after: LifeCounterSnapshot;
};

export type LifeCounterActionPayloadByKind = {
  "adjust-life": {
    playerId: string;
    amount: number;
    previousLife: number;
    nextLife: number;
  };
  "adjust-poison": {
    playerId: string;
    amount: number;
    previousPoison: number;
    nextPoison: number;
  };
  "adjust-player-counter": {
    playerId: string;
    key: PlayerCounterKey;
    amount: number;
    previousValue: number;
    nextValue: number;
  };
  "adjust-floating-mana": {
    playerId: string;
    symbol: ManaSymbol;
    amount: number;
    previousValue: number;
    nextValue: number;
  };
  "set-table-role": {
    role: TableRole;
    previousPlayerId: string | null;
    nextPlayerId: string | null;
  };
  "set-city-blessing": {
    playerId: string;
    previousValue: boolean;
    nextValue: boolean;
  };
  "set-day-night": {
    previousValue: DayNightState;
    nextValue: DayNightState;
  };
  "adjust-storm": {
    amount: number;
    previousValue: number;
    nextValue: number;
  };
  "add-custom-counter": {
    playerId: string;
    counter: CustomCounter;
  };
  "update-custom-counter": {
    playerId: string;
    counterId: string;
    previousCounter: CustomCounter;
    nextCounter: CustomCounter;
  };
  "adjust-custom-counter": {
    playerId: string;
    counterId: string;
    amount: number;
    previousValue: number;
    nextValue: number;
  };
  "remove-custom-counter": {
    playerId: string;
    counter: CustomCounter;
  };
  "adjust-commander-cast": {
    playerId: string;
    commanderId: string;
    amount: number;
    previousValue: number;
    nextValue: number;
  };
  "adjust-commander-damage": {
    sourceCommanderId: string;
    defenderId: string;
    amount: number;
    previousValue: number;
    nextValue: number;
  };
  "set-active-player": {
    previousActivePlayerId: string;
    nextActivePlayerId: string;
    previousTurnElapsedSeconds: number;
    nextTurnElapsedSeconds: number;
  };
  "advance-turn": {
    previousActivePlayerId: string;
    nextActivePlayerId: string;
    previousTurnElapsedSeconds: number;
    nextTurnElapsedSeconds: number;
    previousTurnCount: number;
    nextTurnCount: number;
  };
  "set-timers-running": {
    previousValue: boolean;
    nextValue: boolean;
  };
  "reset-turn-timer": {
    previousTurnElapsedSeconds: number;
    nextTurnElapsedSeconds: number;
  };
  "reset-timers": SnapshotPayload;
  "apply-starting-life": SnapshotPayload;
  "reset-player": SnapshotPayload & { playerId: string };
  "reset-game": SnapshotPayload;
  rematch: SnapshotPayload;
  "new-game": SnapshotPayload;
  "eliminate-player": SnapshotPayload & { playerId: string };
  "restore-player": SnapshotPayload & { playerId: string };
  "mark-winner": SnapshotPayload & { playerId: string };
  "set-shared-result": SnapshotPayload & {
    result: Extract<GameResult, "draw" | "no-contest">;
  };
};

export type LifeCounterAction = {
  [Kind in keyof LifeCounterActionPayloadByKind]: {
    id: string;
    kind: Kind;
    createdAt: string;
    payload: LifeCounterActionPayloadByKind[Kind];
  };
}[keyof LifeCounterActionPayloadByKind];

export type LifeCounterHistory = {
  actions: LifeCounterAction[];
  cursor: number;
};

export type LifeCounterSession = LifeCounterSnapshot & {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  history: LifeCounterHistory;
};

export type LifeCounterReducerEvent =
  | { type: "hydrate"; session: LifeCounterSession }
  | { type: "record"; action: LifeCounterAction }
  | { type: "undo"; now: string }
  | { type: "redo"; now: string }
  | {
      type: "update-setup";
      now: string;
      update: (snapshot: LifeCounterSnapshot) => LifeCounterSnapshot;
    }
  | { type: "tick-timers"; now: string; seconds: number };

export const LIFE_COUNTER_SCHEMA_VERSION = 1;
export const STANDALONE_LIFE_SESSION_ID = "standalone-local-life-session";

export const seats = [
  "North",
  "East",
  "South",
  "West",
  "Northwest",
  "Northeast",
  "Southeast",
  "Southwest",
];

const playerColorValues = [
  "player-a",
  "player-b",
  "player-c",
  "player-d",
  "player-e",
  "player-f",
  "player-g",
  "player-h",
];

export function createCommander(
  playerId: string,
  commanderNumber = 1,
): Commander {
  return {
    id: `${playerId}-commander-${commanderNumber}`,
    name: "",
    castCount: 0,
    damageByDefender: {},
  };
}

export function createFloatingMana(): Record<ManaSymbol, number> {
  return {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
  };
}

export function createPlayers(startingLife: number): Player[] {
  return seats.map((seat, index) => {
    const playerId = `player-${index + 1}`;

    return {
      id: playerId,
      seat,
      name: `Player ${index + 1}`,
      commanders: [createCommander(playerId)],
      deck: "",
      color: playerColorValues[index] ?? playerColorValues[0],
      life: startingLife,
      poison: 0,
      status: "active",
      cityBlessing: false,
      experience: 0,
      energy: 0,
      rad: 0,
      treasure: 0,
      floatingMana: createFloatingMana(),
      customCounters: [],
    };
  });
}

export function resetPlayerCounters(player: Player, life: number): Player {
  return {
    ...player,
    life,
    poison: 0,
    status: "active",
    cityBlessing: false,
    experience: 0,
    energy: 0,
    rad: 0,
    treasure: 0,
    floatingMana: createFloatingMana(),
    customCounters: player.customCounters.map((counter) => ({
      ...counter,
      value: 0,
    })),
    commanders: player.commanders.map((commander) => ({
      ...commander,
      castCount: 0,
      damageByDefender: {},
    })),
  };
}

export function createInitialLifeCounterSnapshot(
  startingLife = 40,
): LifeCounterSnapshot {
  return {
    startingLife,
    playerCount: 4,
    activePlayerId: "player-1",
    gameElapsedSeconds: 0,
    turnElapsedSeconds: 0,
    timersRunning: false,
    turnCount: 1,
    monarchPlayerId: null,
    initiativePlayerId: null,
    dayNight: "unset",
    stormCount: 0,
    gameResult: "in-progress",
    players: createPlayers(startingLife),
  };
}

export function createInitialLifeCounterSession(
  now = new Date().toISOString(),
): LifeCounterSession {
  return {
    ...createInitialLifeCounterSnapshot(),
    id: STANDALONE_LIFE_SESSION_ID,
    schemaVersion: LIFE_COUNTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    history: {
      actions: [],
      cursor: 0,
    },
  };
}

export function createLifeCounterAction<
  Kind extends keyof LifeCounterActionPayloadByKind,
>(
  kind: Kind,
  payload: LifeCounterActionPayloadByKind[Kind],
  options: { id?: string; createdAt?: string } = {},
): LifeCounterAction {
  return {
    id: options.id ?? createActionId(),
    kind,
    createdAt: options.createdAt ?? new Date().toISOString(),
    payload,
  } as LifeCounterAction;
}

export function getLifeCounterSnapshot(
  session: LifeCounterSession,
): LifeCounterSnapshot {
  return {
    startingLife: session.startingLife,
    playerCount: session.playerCount,
    activePlayerId: session.activePlayerId,
    gameElapsedSeconds: session.gameElapsedSeconds,
    turnElapsedSeconds: session.turnElapsedSeconds,
    timersRunning: session.timersRunning,
    turnCount: session.turnCount,
    monarchPlayerId: session.monarchPlayerId,
    initiativePlayerId: session.initiativePlayerId,
    dayNight: session.dayNight,
    stormCount: session.stormCount,
    gameResult: session.gameResult,
    players: session.players,
  };
}

export function restoreLifeCounterSnapshot(
  session: LifeCounterSession,
  snapshot: LifeCounterSnapshot,
  updatedAt: string,
): LifeCounterSession {
  return {
    ...session,
    ...snapshot,
    updatedAt,
  };
}

export function recordLifeCounterAction(
  session: LifeCounterSession,
  action: LifeCounterAction,
): LifeCounterSession {
  const branchedActions = session.history.actions.slice(
    0,
    session.history.cursor,
  );

  return {
    ...restoreLifeCounterSnapshot(
      session,
      applyLifeCounterAction(getLifeCounterSnapshot(session), action),
      action.createdAt,
    ),
    history: {
      actions: [...branchedActions, action],
      cursor: branchedActions.length + 1,
    },
  };
}

export function undoLifeCounterAction(
  session: LifeCounterSession,
  now: string,
): LifeCounterSession {
  if (session.history.cursor <= 0) {
    return session;
  }

  const action = session.history.actions[session.history.cursor - 1];

  return {
    ...restoreLifeCounterSnapshot(
      session,
      revertLifeCounterAction(getLifeCounterSnapshot(session), action),
      now,
    ),
    history: {
      ...session.history,
      cursor: session.history.cursor - 1,
    },
  };
}

export function redoLifeCounterAction(
  session: LifeCounterSession,
  now: string,
): LifeCounterSession {
  if (session.history.cursor >= session.history.actions.length) {
    return session;
  }

  const action = session.history.actions[session.history.cursor];

  return {
    ...restoreLifeCounterSnapshot(
      session,
      applyLifeCounterAction(getLifeCounterSnapshot(session), action),
      now,
    ),
    history: {
      ...session.history,
      cursor: session.history.cursor + 1,
    },
  };
}

export function updateLifeCounterSetup(
  session: LifeCounterSession,
  update: (snapshot: LifeCounterSnapshot) => LifeCounterSnapshot,
  now: string,
): LifeCounterSession {
  return restoreLifeCounterSnapshot(
    session,
    update(getLifeCounterSnapshot(session)),
    now,
  );
}

export function tickLifeCounterTimers(
  session: LifeCounterSession,
  seconds: number,
  now: string,
): LifeCounterSession {
  if (!session.timersRunning || seconds <= 0) {
    return session;
  }

  return {
    ...session,
    gameElapsedSeconds: session.gameElapsedSeconds + seconds,
    turnElapsedSeconds: session.turnElapsedSeconds + seconds,
    updatedAt: now,
  };
}

export function lifeCounterReducer(
  session: LifeCounterSession,
  event: LifeCounterReducerEvent,
): LifeCounterSession {
  switch (event.type) {
    case "hydrate":
      return event.session;
    case "record":
      return recordLifeCounterAction(session, event.action);
    case "undo":
      return undoLifeCounterAction(session, event.now);
    case "redo":
      return redoLifeCounterAction(session, event.now);
    case "update-setup":
      return updateLifeCounterSetup(session, event.update, event.now);
    case "tick-timers":
      return tickLifeCounterTimers(session, event.seconds, event.now);
  }
}

export function canUndoLifeCounterAction(session: LifeCounterSession) {
  return session.history.cursor > 0;
}

export function canRedoLifeCounterAction(session: LifeCounterSession) {
  return session.history.cursor < session.history.actions.length;
}

export function applyLifeCounterAction(
  snapshot: LifeCounterSnapshot,
  action: LifeCounterAction,
): LifeCounterSnapshot {
  switch (action.kind) {
    case "adjust-life":
      return updatePlayer(snapshot, action.payload.playerId, {
        life: action.payload.nextLife,
      });
    case "adjust-poison":
      return updatePlayer(snapshot, action.payload.playerId, {
        poison: action.payload.nextPoison,
      });
    case "adjust-player-counter":
      return updatePlayer(snapshot, action.payload.playerId, {
        [action.payload.key]: action.payload.nextValue,
      });
    case "adjust-floating-mana":
      return updatePlayerWithUpdater(
        snapshot,
        action.payload.playerId,
        (player) => ({
          ...player,
          floatingMana: {
            ...player.floatingMana,
            [action.payload.symbol]: action.payload.nextValue,
          },
        }),
      );
    case "set-table-role":
      return action.payload.role === "monarch"
        ? { ...snapshot, monarchPlayerId: action.payload.nextPlayerId }
        : { ...snapshot, initiativePlayerId: action.payload.nextPlayerId };
    case "set-city-blessing":
      return updatePlayer(snapshot, action.payload.playerId, {
        cityBlessing: action.payload.nextValue,
      });
    case "set-day-night":
      return { ...snapshot, dayNight: action.payload.nextValue };
    case "adjust-storm":
      return { ...snapshot, stormCount: action.payload.nextValue };
    case "add-custom-counter":
      return updatePlayerWithUpdater(
        snapshot,
        action.payload.playerId,
        (player) => ({
          ...player,
          customCounters: [...player.customCounters, action.payload.counter],
        }),
      );
    case "update-custom-counter":
      return updateCustomCounter(
        snapshot,
        action.payload.playerId,
        action.payload.counterId,
        action.payload.nextCounter,
      );
    case "adjust-custom-counter":
      return updateCustomCounter(
        snapshot,
        action.payload.playerId,
        action.payload.counterId,
        {
          value: action.payload.nextValue,
        },
      );
    case "remove-custom-counter":
      return updatePlayerWithUpdater(
        snapshot,
        action.payload.playerId,
        (player) => ({
          ...player,
          customCounters: player.customCounters.filter(
            (counter) => counter.id !== action.payload.counter.id,
          ),
        }),
      );
    case "adjust-commander-cast":
      return updateCommander(
        snapshot,
        action.payload.playerId,
        action.payload.commanderId,
        {
          castCount: action.payload.nextValue,
        },
      );
    case "adjust-commander-damage":
      return updateCommanderById(
        snapshot,
        action.payload.sourceCommanderId,
        (commander) => ({
          ...commander,
          damageByDefender: {
            ...commander.damageByDefender,
            [action.payload.defenderId]: action.payload.nextValue,
          },
        }),
      );
    case "set-active-player":
      return {
        ...snapshot,
        activePlayerId: action.payload.nextActivePlayerId,
        turnElapsedSeconds: action.payload.nextTurnElapsedSeconds,
      };
    case "advance-turn":
      return {
        ...snapshot,
        activePlayerId: action.payload.nextActivePlayerId,
        turnElapsedSeconds: action.payload.nextTurnElapsedSeconds,
        turnCount: action.payload.nextTurnCount,
      };
    case "set-timers-running":
      return { ...snapshot, timersRunning: action.payload.nextValue };
    case "reset-turn-timer":
      return {
        ...snapshot,
        turnElapsedSeconds: action.payload.nextTurnElapsedSeconds,
      };
    case "reset-timers":
    case "apply-starting-life":
    case "reset-player":
    case "reset-game":
    case "rematch":
    case "new-game":
    case "eliminate-player":
    case "restore-player":
    case "mark-winner":
    case "set-shared-result":
      return action.payload.after;
  }
}

export function revertLifeCounterAction(
  snapshot: LifeCounterSnapshot,
  action: LifeCounterAction,
): LifeCounterSnapshot {
  switch (action.kind) {
    case "adjust-life":
      return updatePlayer(snapshot, action.payload.playerId, {
        life: action.payload.previousLife,
      });
    case "adjust-poison":
      return updatePlayer(snapshot, action.payload.playerId, {
        poison: action.payload.previousPoison,
      });
    case "adjust-player-counter":
      return updatePlayer(snapshot, action.payload.playerId, {
        [action.payload.key]: action.payload.previousValue,
      });
    case "adjust-floating-mana":
      return updatePlayerWithUpdater(
        snapshot,
        action.payload.playerId,
        (player) => ({
          ...player,
          floatingMana: {
            ...player.floatingMana,
            [action.payload.symbol]: action.payload.previousValue,
          },
        }),
      );
    case "set-table-role":
      return action.payload.role === "monarch"
        ? { ...snapshot, monarchPlayerId: action.payload.previousPlayerId }
        : { ...snapshot, initiativePlayerId: action.payload.previousPlayerId };
    case "set-city-blessing":
      return updatePlayer(snapshot, action.payload.playerId, {
        cityBlessing: action.payload.previousValue,
      });
    case "set-day-night":
      return { ...snapshot, dayNight: action.payload.previousValue };
    case "adjust-storm":
      return { ...snapshot, stormCount: action.payload.previousValue };
    case "add-custom-counter":
      return updatePlayerWithUpdater(
        snapshot,
        action.payload.playerId,
        (player) => ({
          ...player,
          customCounters: player.customCounters.filter(
            (counter) => counter.id !== action.payload.counter.id,
          ),
        }),
      );
    case "update-custom-counter":
      return updateCustomCounter(
        snapshot,
        action.payload.playerId,
        action.payload.counterId,
        action.payload.previousCounter,
      );
    case "adjust-custom-counter":
      return updateCustomCounter(
        snapshot,
        action.payload.playerId,
        action.payload.counterId,
        {
          value: action.payload.previousValue,
        },
      );
    case "remove-custom-counter":
      return updatePlayerWithUpdater(
        snapshot,
        action.payload.playerId,
        (player) => ({
          ...player,
          customCounters: [...player.customCounters, action.payload.counter],
        }),
      );
    case "adjust-commander-cast":
      return updateCommander(
        snapshot,
        action.payload.playerId,
        action.payload.commanderId,
        {
          castCount: action.payload.previousValue,
        },
      );
    case "adjust-commander-damage":
      return updateCommanderById(
        snapshot,
        action.payload.sourceCommanderId,
        (commander) => ({
          ...commander,
          damageByDefender: {
            ...commander.damageByDefender,
            [action.payload.defenderId]: action.payload.previousValue,
          },
        }),
      );
    case "set-active-player":
      return {
        ...snapshot,
        activePlayerId: action.payload.previousActivePlayerId,
        turnElapsedSeconds: action.payload.previousTurnElapsedSeconds,
      };
    case "advance-turn":
      return {
        ...snapshot,
        activePlayerId: action.payload.previousActivePlayerId,
        turnElapsedSeconds: action.payload.previousTurnElapsedSeconds,
        turnCount: action.payload.previousTurnCount,
      };
    case "set-timers-running":
      return { ...snapshot, timersRunning: action.payload.previousValue };
    case "reset-turn-timer":
      return {
        ...snapshot,
        turnElapsedSeconds: action.payload.previousTurnElapsedSeconds,
      };
    case "reset-timers":
    case "apply-starting-life":
    case "reset-player":
    case "reset-game":
    case "rematch":
    case "new-game":
    case "eliminate-player":
    case "restore-player":
    case "mark-winner":
    case "set-shared-result":
      return action.payload.before;
  }
}

export function clampAtZero(value: number) {
  return Math.max(0, value);
}

function updatePlayer(
  snapshot: LifeCounterSnapshot,
  playerId: string,
  patch: Partial<Player>,
): LifeCounterSnapshot {
  return updatePlayerWithUpdater(snapshot, playerId, (player) => ({
    ...player,
    ...patch,
  }));
}

function updatePlayerWithUpdater(
  snapshot: LifeCounterSnapshot,
  playerId: string,
  update: (player: Player) => Player,
): LifeCounterSnapshot {
  return {
    ...snapshot,
    players: snapshot.players.map((player) =>
      player.id === playerId ? update(player) : player,
    ),
  };
}

function updateCommander(
  snapshot: LifeCounterSnapshot,
  playerId: string,
  commanderId: string,
  patch: Partial<Commander>,
): LifeCounterSnapshot {
  return updatePlayerWithUpdater(snapshot, playerId, (player) => ({
    ...player,
    commanders: player.commanders.map((commander) =>
      commander.id === commanderId ? { ...commander, ...patch } : commander,
    ),
  }));
}

function updateCommanderById(
  snapshot: LifeCounterSnapshot,
  commanderId: string,
  update: (commander: Commander) => Commander,
): LifeCounterSnapshot {
  return {
    ...snapshot,
    players: snapshot.players.map((player) => ({
      ...player,
      commanders: player.commanders.map((commander) =>
        commander.id === commanderId ? update(commander) : commander,
      ),
    })),
  };
}

function updateCustomCounter(
  snapshot: LifeCounterSnapshot,
  playerId: string,
  counterId: string,
  patch: Partial<CustomCounter>,
): LifeCounterSnapshot {
  return updatePlayerWithUpdater(snapshot, playerId, (player) => ({
    ...player,
    customCounters: player.customCounters.map((counter) =>
      counter.id === counterId ? { ...counter, ...patch } : counter,
    ),
  }));
}

function createActionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
