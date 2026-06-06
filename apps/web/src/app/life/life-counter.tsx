"use client";

import {
  Ban,
  CircleDot,
  Clock,
  Coins,
  Crown,
  Flag,
  Flame,
  Gem,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Plus,
  Play,
  Radiation,
  Redo2,
  RotateCcw,
  Shuffle,
  SkipForward,
  Skull,
  Sparkles,
  Swords,
  SunMoon,
  Trophy,
  Trash2,
  Undo2,
  UserPlus,
  Zap,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  syncLinkedLifeCounterSessionAction,
  type SyncLinkedLifeCounterSessionInput,
} from "@/app/life/linked-session-actions";
import {
  cleanupSavedLifeCounterSessions,
  countCleanupEligibleLifeCounterSessions,
  loadLifeCounterSession,
  saveLifeCounterSession,
} from "@/features/life/local-session-store";
import {
  canRedoLifeCounterAction,
  canUndoLifeCounterAction,
  clampAtZero,
  createCommander,
  createInitialLifeCounterSession,
  createLifeCounterAction,
  getLifeCounterSnapshot,
  lifeCounterReducer,
  resetPlayerCounters,
  seats,
  type Commander,
  type CustomCounter,
  type DayNightState,
  type GameResult,
  type LifeCounterAction,
  type LifeCounterSession,
  type LifeCounterSnapshot,
  type ManaSymbol,
  type Player,
  type PlayerCounterKey,
  type PlayerStatus,
  type TableRole,
} from "@/features/life/session";
import { cn } from "@/lib/utils";

type LifeCounterProps = {
  initialSession?: LifeCounterSession;
  linkedSaveEnabled?: boolean;
  linkedStatusLabel?: string;
  linkedSessionSync?: Omit<SyncLinkedLifeCounterSessionInput, "session">;
};

type LocalSaveState = "checking" | "saved" | "unavailable" | "error";
type LocalCleanupState = "idle" | "running" | "done" | "error";
type LinkedSyncState =
  | "idle"
  | "syncing"
  | "synced"
  | "conflict"
  | "unavailable"
  | "error";

type CommanderSource = {
  commander: Commander;
  commanderNumber: number;
  player: Player;
};

const colorOptions = [
  { value: "player-a", label: "Rose", className: "bg-player-a" },
  { value: "player-b", label: "Blue", className: "bg-player-b" },
  { value: "player-c", label: "Green", className: "bg-player-c" },
  { value: "player-d", label: "Gold", className: "bg-player-d" },
  { value: "player-e", label: "Violet", className: "bg-player-e" },
  { value: "player-f", label: "Cyan", className: "bg-player-f" },
  { value: "player-g", label: "Amber", className: "bg-player-g" },
  { value: "player-h", label: "Pink", className: "bg-player-h" },
];

const playerCountOptions = Array.from({ length: 7 }, (_, index) => {
  const count = index + 2;
  return { value: String(count), label: String(count) };
});

const startingLifeOptions = [
  { value: "20", label: "20" },
  { value: "30", label: "30" },
  { value: "40", label: "40" },
];
const playerCounterOptions = [
  { key: "experience", label: "Experience", Icon: Sparkles },
  { key: "energy", label: "Energy", Icon: Zap },
  { key: "rad", label: "Rad", Icon: Radiation },
  { key: "treasure", label: "Treasure", Icon: Coins },
] satisfies {
  key: PlayerCounterKey;
  label: string;
  Icon: typeof Sparkles;
}[];
const manaOptions = [
  { symbol: "W", label: "White" },
  { symbol: "U", label: "Blue" },
  { symbol: "B", label: "Black" },
  { symbol: "R", label: "Red" },
  { symbol: "G", label: "Green" },
  { symbol: "C", label: "Colorless" },
] satisfies { symbol: ManaSymbol; label: string }[];

function commanderDisplayName(source: CommanderSource) {
  return (
    source.commander.name.trim() ||
    `${source.player.name} commander ${source.commanderNumber}`
  );
}

function nextCommanderNumber(player: Player) {
  return (
    player.commanders.reduce((highest, commander) => {
      const suffix = Number(commander.id.split("-commander-")[1]);
      return Number.isFinite(suffix) ? Math.max(highest, suffix) : highest;
    }, 0) + 1
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function playerStatusLabel(status: PlayerStatus) {
  if (status === "winner") {
    return "Winner";
  }

  if (status === "eliminated") {
    return "Eliminated";
  }

  return "Active";
}

function formatDuration(totalSeconds: number) {
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const paddedSeconds = String(seconds).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

function getSyncScopeLabel({
  isLinkedSession,
  linkedSaveEnabled,
  linkedSessionSync,
  linkedSyncState,
}: {
  isLinkedSession: boolean;
  linkedSaveEnabled: boolean;
  linkedSessionSync: boolean;
  linkedSyncState: LinkedSyncState;
}) {
  if (!isLinkedSession) {
    return "Local only";
  }

  if (!linkedSessionSync) {
    return linkedSaveEnabled
      ? "Local until saved to group"
      : "Local only - not saved to group";
  }

  switch (linkedSyncState) {
    case "syncing":
      return "Syncing group snapshot";
    case "synced":
      return "Synced to group";
    case "conflict":
      return "Sync conflict - reload";
    case "unavailable":
      return "Group sync unavailable";
    case "error":
      return "Group sync failed";
    case "idle":
      return "Local until synced";
  }
}

function getLinkedSyncFingerprint(session: LifeCounterSession) {
  const { gameElapsedSeconds, turnElapsedSeconds, updatedAt, ...stable } =
    session;

  void gameElapsedSeconds;
  void turnElapsedSeconds;
  void updatedAt;

  return JSON.stringify(stable);
}

export function LifeCounter({
  initialSession,
  linkedSaveEnabled = false,
  linkedStatusLabel,
  linkedSessionSync,
}: LifeCounterProps = {}) {
  const isLinkedSession = Boolean(linkedStatusLabel);
  const expectedServerActionSequenceRef = useRef(
    linkedSessionSync?.expectedServerActionSequence ?? null,
  );
  const expectedServerUpdatedAtRef = useRef(
    linkedSessionSync?.expectedServerUpdatedAt ?? null,
  );
  const linkedSyncLockedRef = useRef(false);
  const [session, dispatch] = useReducer(
    lifeCounterReducer,
    initialSession,
    (providedSession) => providedSession ?? createInitialLifeCounterSession(),
  );
  const sessionRef = useRef(session);
  const [tableMode, setTableMode] = useState(false);
  const [announcement, setAnnouncement] = useState("Local life counter ready.");
  const [localStoreReady, setLocalStoreReady] = useState(false);
  const [localSaveState, setLocalSaveState] =
    useState<LocalSaveState>("checking");
  const [cleanupEligibleCount, setCleanupEligibleCount] = useState(0);
  const [localCleanupState, setLocalCleanupState] =
    useState<LocalCleanupState>("idle");
  const [linkedSyncState, setLinkedSyncState] =
    useState<LinkedSyncState>("idle");
  const {
    activePlayerId,
    dayNight,
    gameElapsedSeconds,
    gameResult,
    initiativePlayerId,
    monarchPlayerId,
    playerCount,
    players,
    startingLife,
    stormCount,
    timersRunning,
    turnCount,
    turnElapsedSeconds,
  } = session;
  const canUndo = canUndoLifeCounterAction(session);
  const canRedo = canRedoLifeCounterAction(session);

  const visiblePlayers = useMemo(
    () => players.slice(0, playerCount),
    [playerCount, players],
  );

  const commanderSources = useMemo(
    () =>
      visiblePlayers.flatMap((player) =>
        player.commanders.map((commander, index) => ({
          commander,
          commanderNumber: index + 1,
          player,
        })),
      ),
    [visiblePlayers],
  );

  const activePlayer =
    visiblePlayers.find((player) => player.id === activePlayerId) ??
    visiblePlayers[0];
  const monarchPlayer = visiblePlayers.find(
    (player) => player.id === monarchPlayerId,
  );
  const initiativePlayer = visiblePlayers.find(
    (player) => player.id === initiativePlayerId,
  );
  const effectiveActivePlayerId = activePlayer?.id ?? "player-1";
  const winner = visiblePlayers.find((player) => player.status === "winner");
  const gameResultLabel =
    gameResult === "winner" && winner
      ? `${winner.name} wins`
      : gameResult === "draw"
        ? "Draw"
        : gameResult === "no-contest"
          ? "No contest"
          : "In progress";
  const turnOrderLabel = visiblePlayers
    .map((player) => player.name)
    .join(" -> ");
  const localSaveLabel =
    localSaveState === "checking"
      ? "Checking local save"
      : localSaveState === "saved"
        ? "Saved locally"
        : localSaveState === "unavailable"
          ? "Local storage unavailable"
          : "Local save failed";
  const syncScopeLabel = getSyncScopeLabel({
    isLinkedSession,
    linkedSaveEnabled,
    linkedSessionSync: Boolean(linkedSessionSync),
    linkedSyncState,
  });
  const cleanupLabel =
    cleanupEligibleCount === 1
      ? "1 saved inactive"
      : `${cleanupEligibleCount} saved inactive`;
  const linkedSyncFingerprint = useMemo(
    () => getLinkedSyncFingerprint(session),
    [session],
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (tableMode) {
      document
        .querySelector<HTMLButtonElement>("[data-table-display-toggle]")
        ?.focus();
    }
  }, [tableMode]);

  useEffect(() => {
    let cancelled = false;

    loadLifeCounterSession(session.id)
      .then((storedSession) => {
        if (cancelled) {
          return;
        }

        if (storedSession) {
          dispatch({ type: "hydrate", session: storedSession });
          setAnnouncement("Local life counter restored.");
        }

        setLocalStoreReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLocalStoreReady(true);
          setLocalSaveState("unavailable");
          setAnnouncement("Local life counter ready. Storage unavailable.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session.id]);

  useEffect(() => {
    if (!localStoreReady) {
      return;
    }

    saveLifeCounterSession(session)
      .then(() => {
        setLocalSaveState("saved");
      })
      .catch(() => {
        setLocalSaveState("error");
        setAnnouncement("Local session could not be saved.");
      });
  }, [localStoreReady, session]);

  useEffect(() => {
    if (!localStoreReady || !linkedSessionSync || linkedSyncLockedRef.current) {
      return;
    }

    let cancelled = false;

    setLinkedSyncState("syncing");

    syncLinkedLifeCounterSessionAction({
      ...linkedSessionSync,
      expectedServerActionSequence: expectedServerActionSequenceRef.current,
      expectedServerUpdatedAt: expectedServerUpdatedAtRef.current,
      session: sessionRef.current,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.ok) {
          expectedServerActionSequenceRef.current =
            result.serverActionSequence;
          expectedServerUpdatedAtRef.current = result.serverUpdatedAt;
          setLinkedSyncState("synced");
          return;
        }

        if (result.reason === "conflict") {
          linkedSyncLockedRef.current = true;
          setLinkedSyncState("conflict");
          setAnnouncement(
            "Server snapshot changed. Reload before syncing this linked table.",
          );
          return;
        }

        setLinkedSyncState(
          result.reason === "unauthorized" || result.reason === "invalid"
            ? "unavailable"
            : "error",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedSyncState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [linkedSessionSync, linkedSyncFingerprint, localStoreReady]);

  useEffect(() => {
    if (!timersRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      dispatch({
        type: "tick-timers",
        now: new Date().toISOString(),
        seconds: 1,
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timersRunning]);

  function now() {
    return new Date().toISOString();
  }

  function currentSnapshot() {
    return getLifeCounterSnapshot(session);
  }

  function recordAction(action: LifeCounterAction, message: string) {
    dispatch({ type: "record", action });
    setAnnouncement(message);
  }

  const refreshCleanupEligibleCount = useCallback(() => {
    countCleanupEligibleLifeCounterSessions({
      activeSessionId: session.id,
    })
      .then((count) => setCleanupEligibleCount(count))
      .catch(() => setCleanupEligibleCount(0));
  }, [session.id]);

  useEffect(() => {
    if (!localStoreReady) {
      return;
    }

    refreshCleanupEligibleCount();
  }, [localStoreReady, refreshCleanupEligibleCount]);

  function cleanupSavedSessions() {
    if (cleanupEligibleCount <= 0 || localCleanupState === "running") {
      return;
    }

    setLocalCleanupState("running");

    cleanupSavedLifeCounterSessions({
      activeSessionId: session.id,
    })
      .then((result) => {
        setCleanupEligibleCount(0);
        setLocalCleanupState("done");
        setAnnouncement(
          result.deletedCount === 1
            ? "Cleaned up 1 saved inactive local session."
            : `Cleaned up ${result.deletedCount} saved inactive local sessions.`,
        );
      })
      .catch(() => {
        setLocalCleanupState("error");
        setAnnouncement("Saved local sessions could not be cleaned up.");
      });
  }

  function updateSetup(
    update: (snapshot: LifeCounterSnapshot) => LifeCounterSnapshot,
    message: string,
  ) {
    dispatch({ type: "update-setup", now: now(), update });
    setAnnouncement(message);
  }

  useEffect(() => {
    function recordKeyboardActiveSelection(nextPlayer: Player) {
      dispatch({
        type: "record",
        action: createLifeCounterAction("set-active-player", {
          previousActivePlayerId: effectiveActivePlayerId,
          nextActivePlayerId: nextPlayer.id,
          previousTurnElapsedSeconds: turnElapsedSeconds,
          nextTurnElapsedSeconds: 0,
        }),
      });
      setAnnouncement(`${nextPlayer.name} selected for keyboard controls.`);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const numericSeat = Number(event.key);
      if (
        Number.isInteger(numericSeat) &&
        numericSeat >= 1 &&
        numericSeat <= visiblePlayers.length
      ) {
        const nextPlayer = visiblePlayers[numericSeat - 1];
        event.preventDefault();
        recordKeyboardActiveSelection(nextPlayer);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const currentIndex = Math.max(
          0,
          visiblePlayers.findIndex(
            (player) => player.id === effectiveActivePlayerId,
          ),
        );
        const offset = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex =
          (currentIndex + offset + visiblePlayers.length) %
          visiblePlayers.length;
        const nextPlayer = visiblePlayers[nextIndex];
        recordKeyboardActiveSelection(nextPlayer);
        return;
      }

      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }

      const currentActivePlayer = visiblePlayers.find(
        (player) => player.id === effectiveActivePlayerId,
      );

      if (!currentActivePlayer) {
        return;
      }

      event.preventDefault();
      const step = event.altKey ? 10 : event.shiftKey ? 5 : 1;
      const amount = event.key === "ArrowUp" ? step : -step;
      dispatch({
        type: "record",
        action: createLifeCounterAction("adjust-life", {
          playerId: currentActivePlayer.id,
          amount,
          previousLife: currentActivePlayer.life,
          nextLife: currentActivePlayer.life + amount,
        }),
      });
      setAnnouncement(
        `${currentActivePlayer.name} ${amount > 0 ? "gained" : "lost"} ${Math.abs(amount)} life.`,
      );
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveActivePlayerId, turnElapsedSeconds, visiblePlayers]);

  function resetTurnTrackingSnapshot(
    snapshot: LifeCounterSnapshot,
    nextActivePlayerId = snapshot.players.slice(0, snapshot.playerCount)[0]?.id,
  ): LifeCounterSnapshot {
    return {
      ...snapshot,
      activePlayerId: nextActivePlayerId ?? "player-1",
      timersRunning: false,
      gameElapsedSeconds: 0,
      turnElapsedSeconds: 0,
      turnCount: 1,
    };
  }

  function createUiId(prefix: string) {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function undoLastAction() {
    if (!canUndo) {
      return;
    }

    dispatch({ type: "undo", now: now() });
    setAnnouncement("Last life counter action undone.");
  }

  function redoNextAction() {
    if (!canRedo) {
      return;
    }

    dispatch({ type: "redo", now: now() });
    setAnnouncement("Life counter action redone.");
  }

  function toggleTimers() {
    const action = createLifeCounterAction("set-timers-running", {
      previousValue: timersRunning,
      nextValue: !timersRunning,
    });

    recordAction(action, !timersRunning ? "Timers started." : "Timers paused.");
  }

  function resetTimers() {
    const before = currentSnapshot();
    const after = resetTurnTrackingSnapshot(before);

    recordAction(
      createLifeCounterAction("reset-timers", { before, after }),
      "Timers reset.",
    );
  }

  function resetTurnTimer() {
    const action = createLifeCounterAction("reset-turn-timer", {
      previousTurnElapsedSeconds: turnElapsedSeconds,
      nextTurnElapsedSeconds: 0,
    });

    recordAction(action, "Turn timer reset.");
  }

  function selectActivePlayer(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const action = createLifeCounterAction("set-active-player", {
      previousActivePlayerId: effectiveActivePlayerId,
      nextActivePlayerId: playerId,
      previousTurnElapsedSeconds: turnElapsedSeconds,
      nextTurnElapsedSeconds: 0,
    });

    recordAction(
      action,
      `${targetPlayer.name} selected for keyboard controls.`,
    );
  }

  function advanceTurn() {
    const activeTurnPlayers = visiblePlayers.filter(
      (player) => player.status === "active",
    );
    const turnPlayers =
      activeTurnPlayers.length > 0 ? activeTurnPlayers : visiblePlayers;

    if (turnPlayers.length === 0) {
      return;
    }

    const currentIndex = turnPlayers.findIndex(
      (player) => player.id === effectiveActivePlayerId,
    );
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % turnPlayers.length;
    const nextPlayer = turnPlayers[nextIndex];
    const nextTurnCount =
      currentIndex !== -1 && nextIndex === 0 ? turnCount + 1 : turnCount;

    const action = createLifeCounterAction("advance-turn", {
      previousActivePlayerId: effectiveActivePlayerId,
      nextActivePlayerId: nextPlayer.id,
      previousTurnElapsedSeconds: turnElapsedSeconds,
      nextTurnElapsedSeconds: 0,
      previousTurnCount: turnCount,
      nextTurnCount,
    });

    recordAction(
      action,
      `${nextPlayer.name} is active for turn ${nextTurnCount}.`,
    );
  }

  function updatePlayer(id: string, patch: Partial<Player>) {
    updateSetup(
      (snapshot) => ({
        ...snapshot,
        players: snapshot.players.map((player) =>
          player.id === id ? { ...player, ...patch } : player,
        ),
      }),
      "Player setup updated.",
    );
  }

  function updatePlayerCount(value: string) {
    const nextPlayerCount = Number(value);

    updateSetup((snapshot) => {
      const nextVisibleIds = snapshot.players
        .slice(0, nextPlayerCount)
        .map((player) => player.id);

      return {
        ...snapshot,
        playerCount: nextPlayerCount,
        activePlayerId: nextVisibleIds.includes(snapshot.activePlayerId)
          ? snapshot.activePlayerId
          : (nextVisibleIds[0] ?? "player-1"),
        monarchPlayerId:
          snapshot.monarchPlayerId &&
          !nextVisibleIds.includes(snapshot.monarchPlayerId)
            ? null
            : snapshot.monarchPlayerId,
        initiativePlayerId:
          snapshot.initiativePlayerId &&
          !nextVisibleIds.includes(snapshot.initiativePlayerId)
            ? null
            : snapshot.initiativePlayerId,
      };
    }, `Player count changed to ${nextPlayerCount}.`);
  }

  function updateCommander(
    playerId: string,
    commanderId: string,
    patch: Partial<Commander>,
  ) {
    updateSetup(
      (snapshot) => ({
        ...snapshot,
        players: snapshot.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                commanders: player.commanders.map((commander) =>
                  commander.id === commanderId
                    ? { ...commander, ...patch }
                    : commander,
                ),
              }
            : player,
        ),
      }),
      "Commander setup updated.",
    );
  }

  function addCommander(playerId: string) {
    updateSetup(
      (snapshot) => ({
        ...snapshot,
        players: snapshot.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                commanders: [
                  ...player.commanders,
                  createCommander(player.id, nextCommanderNumber(player)),
                ],
              }
            : player,
        ),
      }),
      "Commander added.",
    );
  }

  function removeCommander(playerId: string, commanderId: string) {
    updateSetup(
      (snapshot) => ({
        ...snapshot,
        players: snapshot.players.map((player) =>
          player.id === playerId && player.commanders.length > 1
            ? {
                ...player,
                commanders: player.commanders.filter(
                  (commander) => commander.id !== commanderId,
                ),
              }
            : player,
        ),
      }),
      "Commander removed.",
    );
  }

  function adjustLife(id: string, amount: number) {
    const targetPlayer = visiblePlayers.find((player) => player.id === id);

    if (!targetPlayer) {
      return;
    }

    const action = createLifeCounterAction("adjust-life", {
      playerId: id,
      amount,
      previousLife: targetPlayer.life,
      nextLife: targetPlayer.life + amount,
    });

    recordAction(
      action,
      `${targetPlayer.name} ${amount > 0 ? "gained" : "lost"} ${Math.abs(amount)} life.`,
    );
  }

  function adjustPoison(id: string, amount: number) {
    const targetPlayer = visiblePlayers.find((player) => player.id === id);

    if (!targetPlayer) {
      return;
    }

    const action = createLifeCounterAction("adjust-poison", {
      playerId: id,
      amount,
      previousPoison: targetPlayer.poison,
      nextPoison: clampAtZero(targetPlayer.poison + amount),
    });

    recordAction(
      action,
      `${targetPlayer.name} poison changed by ${amount > 0 ? "+" : ""}${amount}.`,
    );
  }

  function adjustPlayerCounter(
    playerId: string,
    key: PlayerCounterKey,
    amount: number,
  ) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    const counterLabel =
      playerCounterOptions.find((counter) => counter.key === key)?.label ?? key;

    if (!targetPlayer) {
      return;
    }

    const previousValue = targetPlayer[key];
    const action = createLifeCounterAction("adjust-player-counter", {
      playerId,
      key,
      amount,
      previousValue,
      nextValue: clampAtZero(previousValue + amount),
    });

    recordAction(
      action,
      `${targetPlayer.name} ${counterLabel.toLowerCase()} changed by ${amount > 0 ? "+" : ""}${amount}.`,
    );
  }

  function adjustFloatingMana(
    playerId: string,
    symbol: ManaSymbol,
    amount: number,
  ) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const previousValue = targetPlayer.floatingMana[symbol];
    const action = createLifeCounterAction("adjust-floating-mana", {
      playerId,
      symbol,
      amount,
      previousValue,
      nextValue: clampAtZero(previousValue + amount),
    });

    recordAction(
      action,
      `${targetPlayer.name} ${symbol} floating mana changed by ${amount > 0 ? "+" : ""}${amount}.`,
    );
  }

  function setTableRole(role: TableRole, playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    const previousPlayerId =
      role === "monarch" ? monarchPlayerId : initiativePlayerId;
    const nextPlayerId = previousPlayerId === playerId ? null : playerId;
    const label = role === "monarch" ? "monarch" : "initiative";

    if (!targetPlayer) {
      return;
    }

    const action = createLifeCounterAction("set-table-role", {
      role,
      previousPlayerId,
      nextPlayerId,
    });

    recordAction(
      action,
      nextPlayerId
        ? `${targetPlayer.name} has the ${label}.`
        : `${targetPlayer.name} no longer has the ${label}.`,
    );
  }

  function toggleCityBlessing(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const action = createLifeCounterAction("set-city-blessing", {
      playerId,
      previousValue: targetPlayer.cityBlessing,
      nextValue: !targetPlayer.cityBlessing,
    });

    recordAction(
      action,
      targetPlayer.cityBlessing
        ? `${targetPlayer.name} lost city's blessing.`
        : `${targetPlayer.name} gained city's blessing.`,
    );
  }

  function setDayNightState(nextValue: DayNightState) {
    const action = createLifeCounterAction("set-day-night", {
      previousValue: dayNight,
      nextValue,
    });

    recordAction(
      action,
      nextValue === "unset" ? "Day/night cleared." : `It is now ${nextValue}.`,
    );
  }

  function adjustStorm(amount: number) {
    const action = createLifeCounterAction("adjust-storm", {
      amount,
      previousValue: stormCount,
      nextValue: clampAtZero(stormCount + amount),
    });

    recordAction(action, `Storm changed by ${amount > 0 ? "+" : ""}${amount}.`);
  }

  function addCustomCounter(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const nextNumber = targetPlayer.customCounters.length + 1;
    const counter = {
      id: createUiId(`${playerId}-custom`),
      name: `Custom ${nextNumber}`,
      value: 0,
    } satisfies CustomCounter;

    recordAction(
      createLifeCounterAction("add-custom-counter", { playerId, counter }),
      `Custom counter added for ${targetPlayer.name}.`,
    );
  }

  function updateCustomCounter(
    playerId: string,
    counterId: string,
    patch: Partial<CustomCounter>,
  ) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    const previousCounter = targetPlayer?.customCounters.find(
      (counter) => counter.id === counterId,
    );

    if (!targetPlayer || !previousCounter) {
      return;
    }

    const nextCounter = { ...previousCounter, ...patch };

    recordAction(
      createLifeCounterAction("update-custom-counter", {
        playerId,
        counterId,
        previousCounter,
        nextCounter,
      }),
      `${targetPlayer.name} custom counter updated.`,
    );
  }

  function adjustCustomCounter(
    playerId: string,
    counterId: string,
    amount: number,
  ) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    const targetCounter = targetPlayer?.customCounters.find(
      (counter) => counter.id === counterId,
    );

    if (!targetPlayer || !targetCounter) {
      return;
    }

    const action = createLifeCounterAction("adjust-custom-counter", {
      playerId,
      counterId,
      amount,
      previousValue: targetCounter.value,
      nextValue: clampAtZero(targetCounter.value + amount),
    });

    recordAction(
      action,
      `${targetPlayer.name} ${targetCounter.name} changed by ${amount > 0 ? "+" : ""}${amount}.`,
    );
  }

  function removeCustomCounter(playerId: string, counterId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    const targetCounter = targetPlayer?.customCounters.find(
      (counter) => counter.id === counterId,
    );

    if (!targetPlayer || !targetCounter) {
      return;
    }

    recordAction(
      createLifeCounterAction("remove-custom-counter", {
        playerId,
        counter: targetCounter,
      }),
      `Custom counter removed from ${targetPlayer.name}.`,
    );
  }

  function adjustCommanderCastCount(
    playerId: string,
    commanderId: string,
    amount: number,
  ) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    const commander = targetPlayer?.commanders.find(
      (entry) => entry.id === commanderId,
    );

    if (!targetPlayer || !commander) {
      return;
    }

    const action = createLifeCounterAction("adjust-commander-cast", {
      playerId,
      commanderId,
      amount,
      previousValue: commander.castCount,
      nextValue: clampAtZero(commander.castCount + amount),
    });

    recordAction(
      action,
      `${commander.name.trim() || "Commander"} casts updated.`,
    );
  }

  function adjustCommanderDamage(
    sourceCommanderId: string,
    defenderId: string,
    amount: number,
  ) {
    const source = commanderSources.find(
      (entry) => entry.commander.id === sourceCommanderId,
    );
    const defender = visiblePlayers.find((player) => player.id === defenderId);

    if (!source || !defender) {
      return;
    }

    const previousValue = source.commander.damageByDefender[defenderId] ?? 0;
    const action = createLifeCounterAction("adjust-commander-damage", {
      sourceCommanderId,
      defenderId,
      amount,
      previousValue,
      nextValue: clampAtZero(previousValue + amount),
    });

    recordAction(
      action,
      `${defender.name} commander damage from ${commanderDisplayName(source)} changed by ${amount > 0 ? "+" : ""}${amount}.`,
    );
  }

  function applyStartingLife(value: string) {
    const nextStartingLife = Number(value);
    const before = currentSnapshot();
    const after = resetTurnTrackingSnapshot({
      ...before,
      startingLife: nextStartingLife,
      gameResult: "in-progress",
      monarchPlayerId: null,
      initiativePlayerId: null,
      dayNight: "unset",
      stormCount: 0,
      players: before.players.map((player) =>
        resetPlayerCounters(player, nextStartingLife),
      ),
    });

    recordAction(
      createLifeCounterAction("apply-starting-life", { before, after }),
      `Starting life changed to ${nextStartingLife}.`,
    );
  }

  function resetPlayer(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const before = currentSnapshot();
    const after = {
      ...before,
      gameResult: "in-progress" as GameResult,
      monarchPlayerId:
        before.monarchPlayerId === playerId ? null : before.monarchPlayerId,
      initiativePlayerId:
        before.initiativePlayerId === playerId
          ? null
          : before.initiativePlayerId,
      players: before.players.map((player) => {
        if (player.id === playerId) {
          return resetPlayerCounters(player, before.startingLife);
        }

        return {
          ...player,
          commanders: player.commanders.map((commander) => {
            const nextDamageByDefender = { ...commander.damageByDefender };
            delete nextDamageByDefender[playerId];

            return {
              ...commander,
              damageByDefender: nextDamageByDefender,
            };
          }),
        };
      }),
    };

    recordAction(
      createLifeCounterAction("reset-player", { before, after, playerId }),
      `${targetPlayer.name} reset.`,
    );
  }

  function resetGame() {
    const before = currentSnapshot();
    const after = resetTurnTrackingSnapshot({
      ...before,
      gameResult: "in-progress",
      monarchPlayerId: null,
      initiativePlayerId: null,
      dayNight: "unset",
      stormCount: 0,
      players: before.players.map((player) =>
        resetPlayerCounters(player, before.startingLife),
      ),
    });

    recordAction(
      createLifeCounterAction("reset-game", { before, after }),
      "Game reset. Player setup was kept.",
    );
  }

  function rematch() {
    const before = currentSnapshot();
    const visible = before.players.slice(0, before.playerCount);
    const hidden = before.players.slice(before.playerCount);
    const nextActivePlayerId = visible[1]?.id ?? visible[0]?.id ?? "player-1";
    const rotated = [...visible.slice(1), ...visible.slice(0, 1)].map(
      (player, index) => ({
        ...resetPlayerCounters(player, before.startingLife),
        seat: seats[index] ?? player.seat,
      }),
    );
    const after = {
      ...before,
      activePlayerId: nextActivePlayerId,
      gameResult: "in-progress" as GameResult,
      monarchPlayerId: null,
      initiativePlayerId: null,
      dayNight: "unset" as DayNightState,
      stormCount: 0,
      timersRunning: false,
      gameElapsedSeconds: 0,
      turnElapsedSeconds: 0,
      turnCount: 1,
      players: [...rotated, ...hidden],
    };

    recordAction(
      createLifeCounterAction("rematch", { before, after }),
      "Rematch ready. Players rotated one seat.",
    );
  }

  function newGame() {
    const before = currentSnapshot();
    const after = {
      ...before,
      ...getLifeCounterSnapshot(
        createInitialLifeCounterSession(now(), {
          id: session.id,
          snapshot: initialSession
            ? getLifeCounterSnapshot(initialSession)
            : undefined,
        }),
      ),
    };

    setTableMode(false);
    recordAction(
      createLifeCounterAction("new-game", { before, after }),
      "New game ready.",
    );
  }

  function eliminatePlayer(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const before = currentSnapshot();
    const after = {
      ...before,
      gameResult: "in-progress" as GameResult,
      players: before.players.map((player) =>
        player.id === playerId
          ? { ...player, status: "eliminated" as PlayerStatus }
          : player.status === "winner"
            ? { ...player, status: "active" as PlayerStatus }
            : player,
      ),
    };

    recordAction(
      createLifeCounterAction("eliminate-player", { before, after, playerId }),
      `${targetPlayer.name} eliminated.`,
    );
  }

  function restorePlayer(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const before = currentSnapshot();
    const after = {
      ...before,
      gameResult: "in-progress" as GameResult,
      players: before.players.map((player) =>
        player.id === playerId
          ? { ...player, status: "active" as PlayerStatus }
          : player,
      ),
    };

    recordAction(
      createLifeCounterAction("restore-player", { before, after, playerId }),
      `${targetPlayer.name} restored.`,
    );
  }

  function markWinner(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    if (!targetPlayer) {
      return;
    }

    const visibleIds = new Set(visiblePlayers.map((player) => player.id));
    const before = currentSnapshot();
    const after = {
      ...before,
      gameResult: "winner" as GameResult,
      timersRunning: false,
      players: before.players.map((player) =>
        player.id === playerId
          ? { ...player, status: "winner" as PlayerStatus }
          : visibleIds.has(player.id)
            ? { ...player, status: "eliminated" as PlayerStatus }
            : player,
      ),
    };

    recordAction(
      createLifeCounterAction("mark-winner", { before, after, playerId }),
      `${targetPlayer.name} marked as winner.`,
    );
  }

  function setSharedResult(
    nextResult: Extract<GameResult, "draw" | "no-contest">,
  ) {
    const visibleIds = new Set(visiblePlayers.map((player) => player.id));
    const before = currentSnapshot();
    const after = {
      ...before,
      gameResult: nextResult,
      timersRunning: false,
      players: before.players.map((player) =>
        visibleIds.has(player.id)
          ? { ...player, status: "active" as PlayerStatus }
          : player,
      ),
    };

    recordAction(
      createLifeCounterAction("set-shared-result", {
        before,
        after,
        result: nextResult,
      }),
      nextResult === "draw" ? "Game marked draw." : "Game marked no contest.",
    );
  }

  const board = (
    <div
      className={cn("grid gap-4", tableMode && "h-full grid-rows-[auto_1fr]")}
      data-testid="life-counter-board"
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
        <div className="grid gap-1">
          <h2 className="text-base font-bold">Table setup</h2>
          <p className="text-sm font-medium text-muted">
            {gameResultLabel}. Active keyboard player:{" "}
            {activePlayer?.name ?? "Player 1"}.
          </p>
          {linkedStatusLabel ? (
            <p
              className="text-xs font-bold text-accent"
              data-testid="linked-life-status"
            >
              {linkedStatusLabel}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <span
              className="inline-flex h-7 items-center rounded-control border border-border bg-background px-2.5 text-xs font-bold text-foreground"
              data-testid="life-save-status"
            >
              {localSaveLabel}
            </span>
            <span
              className="inline-flex h-7 items-center rounded-control border border-border bg-background px-2.5 text-xs font-bold text-muted"
              data-testid="life-sync-scope"
            >
              {syncScopeLabel}
            </span>
            <Button
              aria-label="Clean up saved inactive life counter sessions"
              disabled={
                cleanupEligibleCount <= 0 ||
                localCleanupState === "running" ||
                localSaveState === "checking" ||
                localSaveState === "unavailable"
              }
              onClick={cleanupSavedSessions}
              size="sm"
              title={cleanupLabel}
              type="button"
              variant="secondary"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {localCleanupState === "running" ? "Cleaning" : "Clean saved"}
              <span className="tabular-nums" data-testid="life-cleanup-count">
                {cleanupEligibleCount}
              </span>
            </Button>
          </div>
        </div>
        <SegmentedControl
          className="grid-cols-7"
          label="Player count"
          onValueChange={updatePlayerCount}
          options={playerCountOptions}
          value={String(playerCount)}
        />
        <SegmentedControl
          className="grid-cols-3"
          label="Starting life"
          onValueChange={applyStartingLife}
          options={startingLifeOptions}
          value={String(startingLife)}
        />
        <Button
          className="justify-self-start lg:justify-self-end"
          data-table-display-toggle
          onClick={() => setTableMode((current) => !current)}
          type="button"
          variant="secondary"
        >
          {tableMode ? (
            <Minimize2 className="size-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-4" aria-hidden="true" />
          )}
          {tableMode ? "Exit table" : "Table display"}
        </Button>
      </div>

      <div className="grid gap-2 rounded-panel border border-border bg-surface p-3 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex h-8 items-center rounded-control border border-border bg-background px-3 text-sm font-bold"
            data-testid="life-game-result"
            role="status"
          >
            {gameResultLabel}
          </span>
          <span className="inline-flex h-8 items-center rounded-control border border-border bg-background px-3 text-sm font-bold">
            <CircleDot className="mr-2 size-4 text-accent" aria-hidden="true" />
            {activePlayer?.name ?? "Player 1"}
          </span>
          <span
            className="inline-flex h-8 items-center rounded-control border border-border bg-background px-3 text-sm font-bold"
            data-testid="turn-count"
          >
            Turn {turnCount}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button
            aria-label="Undo last life counter action"
            disabled={!canUndo}
            onClick={undoLastAction}
            type="button"
            variant="secondary"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Undo
          </Button>
          <Button
            aria-label="Redo life counter action"
            disabled={!canRedo}
            onClick={redoNextAction}
            type="button"
            variant="secondary"
          >
            <Redo2 className="size-4" aria-hidden="true" />
            Redo
          </Button>
          <Button onClick={resetGame} type="button" variant="secondary">
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
          <Button onClick={rematch} type="button" variant="secondary">
            <Shuffle className="size-4" aria-hidden="true" />
            Rematch
          </Button>
          <Button onClick={newGame} type="button" variant="secondary">
            <Plus className="size-4" aria-hidden="true" />
            New game
          </Button>
          <Button
            onClick={() => setSharedResult("draw")}
            type="button"
            variant="secondary"
          >
            Draw
          </Button>
          <Button
            onClick={() => setSharedResult("no-contest")}
            type="button"
            variant="secondary"
          >
            <Ban className="size-4" aria-hidden="true" />
            No contest
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr_auto] xl:items-center">
        <div className="grid gap-1 rounded-control border border-border bg-background p-3">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-muted">
            <Clock className="size-4" aria-hidden="true" />
            Game timer
          </p>
          <p
            className="text-3xl font-black tabular-nums"
            data-testid="game-timer"
          >
            {formatDuration(gameElapsedSeconds)}
          </p>
        </div>
        <div className="grid gap-1 rounded-control border border-border bg-background p-3">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-muted">
            <Clock className="size-4" aria-hidden="true" />
            Turn timer
          </p>
          <p
            className="text-3xl font-black tabular-nums"
            data-testid="turn-timer"
          >
            {formatDuration(turnElapsedSeconds)}
          </p>
        </div>
        <div className="grid gap-2 rounded-control border border-border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted">
              Active turn
            </span>
            <span
              className="rounded-control border border-focus px-2 py-1 text-sm font-black"
              data-testid="active-turn-player"
            >
              {activePlayer?.name ?? "Player 1"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1" data-testid="turn-order">
            {visiblePlayers.map((player, index) => (
              <span
                className={cn(
                  "rounded-control border px-2 py-1 text-xs font-bold",
                  player.id === effectiveActivePlayerId
                    ? "border-focus bg-surface-strong"
                    : "border-border",
                )}
                key={player.id}
                title={turnOrderLabel}
              >
                {index + 1}. {player.name}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-1">
          <Button
            aria-label={timersRunning ? "Pause timers" : "Start timers"}
            onClick={toggleTimers}
            type="button"
            variant={timersRunning ? "primary" : "secondary"}
          >
            {timersRunning ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {timersRunning ? "Pause" : "Start"}
          </Button>
          <Button onClick={advanceTurn} type="button" variant="secondary">
            <SkipForward className="size-4" aria-hidden="true" />
            Next turn
          </Button>
          <Button onClick={resetTurnTimer} type="button" variant="secondary">
            <RotateCcw className="size-4" aria-hidden="true" />
            Turn timer
          </Button>
          <Button
            aria-label="Reset timers"
            onClick={resetTimers}
            type="button"
            variant="secondary"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Timers
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-2">
          <p className="text-xs font-bold uppercase text-muted">Table roles</p>
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex h-8 items-center rounded-control border border-border bg-background px-3 text-sm font-bold"
              data-testid="monarch-holder"
            >
              <Crown className="mr-2 size-4 text-player-d" aria-hidden="true" />
              {monarchPlayer ? `${monarchPlayer.name} monarch` : "No monarch"}
            </span>
            <span
              className="inline-flex h-8 items-center rounded-control border border-border bg-background px-3 text-sm font-bold"
              data-testid="initiative-holder"
            >
              <Flag className="mr-2 size-4 text-accent" aria-hidden="true" />
              {initiativePlayer
                ? `${initiativePlayer.name} initiative`
                : "No initiative"}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-bold uppercase text-muted">
            Day, night, and storm
          </p>
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex h-8 items-center rounded-control border border-border bg-background px-3 text-sm font-bold capitalize"
              data-testid="day-night-state"
            >
              <SunMoon
                className="mr-2 size-4 text-player-g"
                aria-hidden="true"
              />
              {dayNight === "unset" ? "Day/night unset" : dayNight}
            </span>
            <Button
              onClick={() => setDayNightState("day")}
              size="sm"
              type="button"
              variant={dayNight === "day" ? "primary" : "secondary"}
            >
              Day
            </Button>
            <Button
              onClick={() => setDayNightState("night")}
              size="sm"
              type="button"
              variant={dayNight === "night" ? "primary" : "secondary"}
            >
              Night
            </Button>
            <Button
              onClick={() => setDayNightState("unset")}
              size="sm"
              type="button"
              variant="secondary"
            >
              Clear
            </Button>
            <span className="inline-flex h-8 items-center rounded-control border border-border bg-background px-3 text-sm font-bold">
              <Flame className="mr-2 size-4 text-danger" aria-hidden="true" />
              Storm{" "}
              <span className="ml-1 tabular-nums" data-testid="storm-count">
                {stormCount}
              </span>
            </span>
            <IconButton
              className="size-8"
              label="Subtract storm"
              onClick={() => adjustStorm(-1)}
              variant="secondary"
            >
              <Minus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              className="size-8"
              label="Add storm"
              onClick={() => adjustStorm(1)}
              variant="secondary"
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3 md:grid-cols-2 xl:grid-cols-4",
          tableMode && "min-h-0 overflow-auto pb-2 xl:auto-rows-fr",
        )}
      >
        {visiblePlayers.map((player) => {
          const incomingCommanderSources = commanderSources.filter(
            (source) => source.player.id !== player.id,
          );

          return (
            <article
              className={cn(
                "grid min-h-[34rem] grid-rows-[auto_auto_1fr_auto] rounded-panel border border-border bg-surface p-3 shadow-sm",
                player.id === effectiveActivePlayerId && "ring-2 ring-focus",
                player.status === "eliminated" && "opacity-75",
                tableMode && "min-h-[32rem]",
              )}
              aria-label={`${player.name}, ${playerStatusLabel(player.status)}, ${player.life} life, ${player.poison} poison`}
              data-testid="life-player-card"
              key={player.id}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">
                    Seat {player.seat}
                  </p>
                  <h2 className="truncate text-lg font-black">{player.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "inline-flex h-7 items-center rounded-control border px-2 text-xs font-bold",
                        player.status === "winner"
                          ? "border-accent bg-accent text-accent-foreground"
                          : player.status === "eliminated"
                            ? "border-danger bg-red-50 text-danger"
                            : "border-border bg-background text-muted",
                      )}
                      data-testid={`${player.id}-status`}
                    >
                      {playerStatusLabel(player.status)}
                    </span>
                    {player.id === effectiveActivePlayerId ? (
                      <span className="inline-flex h-7 items-center rounded-control border border-focus bg-background px-2 text-xs font-bold">
                        Keyboard
                      </span>
                    ) : null}
                    {player.id === monarchPlayerId ? (
                      <span
                        className="inline-flex h-7 items-center rounded-control border border-player-d bg-background px-2 text-xs font-bold"
                        data-testid={`${player.id}-monarch`}
                      >
                        Monarch
                      </span>
                    ) : null}
                    {player.id === initiativePlayerId ? (
                      <span
                        className="inline-flex h-7 items-center rounded-control border border-accent bg-background px-2 text-xs font-bold"
                        data-testid={`${player.id}-initiative`}
                      >
                        Initiative
                      </span>
                    ) : null}
                    {player.cityBlessing ? (
                      <span
                        className="inline-flex h-7 items-center rounded-control border border-player-e bg-background px-2 text-xs font-bold"
                        data-testid={`${player.id}-city-blessing`}
                      >
                        {"City's blessing"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={cn(
                    "size-5 shrink-0 rounded-full border border-black/10",
                    colorOptions.find((color) => color.value === player.color)
                      ?.className,
                  )}
                  aria-hidden="true"
                />
              </header>

              <div className="mt-3 grid gap-2">
                <FormField label="Player name">
                  <input
                    className={fieldControlClassName}
                    onChange={(event) =>
                      updatePlayer(player.id, { name: event.target.value })
                    }
                    value={player.name}
                  />
                </FormField>
                <div className="grid gap-2">
                  {player.commanders.map((commander, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto] gap-2"
                      key={commander.id}
                    >
                      <FormField
                        className="min-w-0"
                        label={`Commander ${index + 1}`}
                      >
                        <input
                          className={fieldControlClassName}
                          onChange={(event) =>
                            updateCommander(player.id, commander.id, {
                              name: event.target.value,
                            })
                          }
                          placeholder={
                            index === 0 ? "Commander" : "Partner or background"
                          }
                          value={commander.name}
                        />
                      </FormField>
                      <IconButton
                        className="mt-5"
                        disabled={player.commanders.length === 1}
                        label={`Remove commander ${index + 1} from ${player.name}`}
                        onClick={() => removeCommander(player.id, commander.id)}
                        variant="secondary"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  ))}
                  <Button
                    className="justify-self-start"
                    onClick={() => addCommander(player.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <UserPlus className="size-4" aria-hidden="true" />
                    Add commander
                  </Button>
                </div>
                <FormField label="Deck label">
                  <input
                    className={fieldControlClassName}
                    onChange={(event) =>
                      updatePlayer(player.id, { deck: event.target.value })
                    }
                    placeholder="Optional"
                    value={player.deck}
                  />
                </FormField>
                <div className="grid grid-cols-4 gap-1.5">
                  {colorOptions.slice(0, playerCount).map((color) => (
                    <button
                      aria-label={`${color.label} player color`}
                      className={cn(
                        "h-8 rounded-control border border-border",
                        color.className,
                        color.value === player.color && "ring-2 ring-focus",
                      )}
                      key={color.value}
                      onClick={() =>
                        updatePlayer(player.id, { color: color.value })
                      }
                      type="button"
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 py-4">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-muted">Life</p>
                  <p className="tabular-nums text-8xl font-black leading-none">
                    {player.life}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-control border border-border bg-background px-3 py-1 text-sm font-bold">
                    <Skull className="size-4 text-danger" aria-hidden="true" />
                    <span
                      className="tabular-nums"
                      data-testid={`${player.id}-poison-count`}
                    >
                      {player.poison}
                    </span>
                    <span className="text-muted">poison</span>
                  </div>
                </div>

                <div className="grid gap-2 rounded-control border border-border bg-background p-2">
                  <p className="text-xs font-bold uppercase text-muted">
                    Roles
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      aria-label={
                        player.id === monarchPlayerId
                          ? `Clear monarch from ${player.name}`
                          : `Make ${player.name} monarch`
                      }
                      onClick={() => setTableRole("monarch", player.id)}
                      size="sm"
                      type="button"
                      variant={
                        player.id === monarchPlayerId ? "primary" : "secondary"
                      }
                    >
                      <Crown className="size-4" aria-hidden="true" />
                      Monarch
                    </Button>
                    <Button
                      aria-label={
                        player.id === initiativePlayerId
                          ? `Clear initiative from ${player.name}`
                          : `Give initiative to ${player.name}`
                      }
                      onClick={() => setTableRole("initiative", player.id)}
                      size="sm"
                      type="button"
                      variant={
                        player.id === initiativePlayerId
                          ? "primary"
                          : "secondary"
                      }
                    >
                      <Flag className="size-4" aria-hidden="true" />
                      Initiative
                    </Button>
                    <Button
                      aria-label={
                        player.cityBlessing
                          ? `Remove city's blessing from ${player.name}`
                          : `Give city's blessing to ${player.name}`
                      }
                      onClick={() => toggleCityBlessing(player.id)}
                      size="sm"
                      type="button"
                      variant={player.cityBlessing ? "primary" : "secondary"}
                    >
                      <Gem className="size-4" aria-hidden="true" />
                      Blessing
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 rounded-control border border-border bg-background p-2">
                  <p className="text-xs font-bold uppercase text-muted">
                    Counters
                  </p>
                  {playerCounterOptions.map(({ key, label, Icon }) => (
                    <div
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2"
                      key={key}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-bold">
                        <Icon
                          className="size-4 shrink-0 text-muted"
                          aria-hidden="true"
                        />
                        <span className="truncate">{label}</span>
                      </span>
                      <span
                        className="w-8 text-center text-lg font-black tabular-nums"
                        data-testid={`${player.id}-${key}-count`}
                      >
                        {player[key]}
                      </span>
                      <IconButton
                        className="size-8"
                        label={`Subtract ${label.toLowerCase()} from ${player.name}`}
                        onClick={() => adjustPlayerCounter(player.id, key, -1)}
                        variant="secondary"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        className="size-8"
                        label={`Add ${label.toLowerCase()} to ${player.name}`}
                        onClick={() => adjustPlayerCounter(player.id, key, 1)}
                        variant="secondary"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 rounded-control border border-border bg-background p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase text-muted">
                      Floating mana
                    </p>
                    <Flame className="size-4 text-muted" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {manaOptions.map(({ symbol, label }) => (
                      <div
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-1"
                        key={symbol}
                      >
                        <span className="text-sm font-black">{symbol}</span>
                        <span
                          className="w-7 text-center text-sm font-black tabular-nums"
                          data-testid={`${player.id}-floating-mana-${symbol}-count`}
                        >
                          {player.floatingMana[symbol]}
                        </span>
                        <IconButton
                          className="size-7"
                          label={`Subtract ${label} floating mana from ${player.name}`}
                          onClick={() =>
                            adjustFloatingMana(player.id, symbol, -1)
                          }
                          variant="secondary"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          className="size-7"
                          label={`Add ${label} floating mana to ${player.name}`}
                          onClick={() =>
                            adjustFloatingMana(player.id, symbol, 1)
                          }
                          variant="secondary"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 rounded-control border border-border bg-background p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase text-muted">
                      Custom counters
                    </p>
                    <Button
                      aria-label={`Add custom counter for ${player.name}`}
                      onClick={() => addCustomCounter(player.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Add
                    </Button>
                  </div>
                  {player.customCounters.length === 0 ? (
                    <p className="text-sm font-medium text-muted">
                      No custom counters
                    </p>
                  ) : null}
                  {player.customCounters.map((counter, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2"
                      data-testid={`${player.id}-custom-counter-row`}
                      key={counter.id}
                    >
                      <input
                        aria-label={`Custom counter name ${index + 1} for ${player.name}`}
                        className={cn(fieldControlClassName, "h-9 min-w-0")}
                        onChange={(event) =>
                          updateCustomCounter(player.id, counter.id, {
                            name: event.target.value,
                          })
                        }
                        value={counter.name}
                      />
                      <span
                        className="w-8 text-center text-lg font-black tabular-nums"
                        data-testid={`${counter.id}-count`}
                      >
                        {counter.value}
                      </span>
                      <IconButton
                        className="size-8"
                        label={`Subtract ${counter.name} from ${player.name}`}
                        onClick={() =>
                          adjustCustomCounter(player.id, counter.id, -1)
                        }
                        variant="secondary"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        className="size-8"
                        label={`Add ${counter.name} to ${player.name}`}
                        onClick={() =>
                          adjustCustomCounter(player.id, counter.id, 1)
                        }
                        variant="secondary"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        className="size-8"
                        label={`Remove ${counter.name} from ${player.name}`}
                        onClick={() =>
                          removeCustomCounter(player.id, counter.id)
                        }
                        variant="secondary"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 rounded-control border border-border bg-background p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase text-muted">
                      Casts
                    </p>
                    <Swords className="size-4 text-muted" aria-hidden="true" />
                  </div>
                  {player.commanders.map((commander, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2"
                      key={commander.id}
                    >
                      <span className="truncate text-sm font-bold">
                        {commander.name.trim() || `Commander ${index + 1}`}
                      </span>
                      <span
                        className="w-8 text-center text-lg font-black tabular-nums"
                        data-testid={`${commander.id}-cast-count`}
                      >
                        {commander.castCount}
                      </span>
                      <IconButton
                        className="size-8"
                        label={`Subtract cast from ${
                          commander.name.trim() || `Commander ${index + 1}`
                        }`}
                        onClick={() =>
                          adjustCommanderCastCount(player.id, commander.id, -1)
                        }
                        variant="secondary"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        className="size-8"
                        label={`Add cast to ${
                          commander.name.trim() || `Commander ${index + 1}`
                        }`}
                        onClick={() =>
                          adjustCommanderCastCount(player.id, commander.id, 1)
                        }
                        variant="secondary"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 rounded-control border border-border bg-background p-2">
                  <p className="text-xs font-bold uppercase text-muted">
                    Commander damage taken
                  </p>
                  <div className="grid max-h-48 gap-1.5 overflow-y-auto pr-1">
                    {incomingCommanderSources.map((source) => {
                      const damage =
                        source.commander.damageByDefender[player.id] ?? 0;
                      const sourceName = commanderDisplayName(source);

                      return (
                        <div
                          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2"
                          key={`${player.id}-${source.commander.id}`}
                        >
                          <span className="truncate text-sm font-bold">
                            {sourceName}
                          </span>
                          <span
                            className="w-8 text-center text-lg font-black tabular-nums"
                            data-testid={`${player.id}-${source.commander.id}-commander-damage`}
                          >
                            {damage}
                          </span>
                          <IconButton
                            className="size-8"
                            label={`Subtract commander damage from ${sourceName} to ${player.name}`}
                            onClick={() =>
                              adjustCommanderDamage(
                                source.commander.id,
                                player.id,
                                -1,
                              )
                            }
                            variant="secondary"
                          >
                            <Minus className="size-4" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            className="size-8"
                            label={`Add commander damage from ${sourceName} to ${player.name}`}
                            onClick={() =>
                              adjustCommanderDamage(
                                source.commander.id,
                                player.id,
                                1,
                              )
                            }
                            variant="secondary"
                          >
                            <Plus className="size-4" aria-hidden="true" />
                          </IconButton>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="grid grid-cols-3 gap-2">
                  {[-10, -5, -1].map((amount) => (
                    <Button
                      aria-label={`Subtract ${Math.abs(amount)} life from ${player.name}`}
                      className="h-14 text-lg"
                      key={amount}
                      onClick={() => adjustLife(player.id, amount)}
                      variant="danger"
                    >
                      {amount}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10].map((amount) => (
                    <Button
                      aria-label={`Add ${amount} life to ${player.name}`}
                      className="h-14 text-lg"
                      key={amount}
                      onClick={() => adjustLife(player.id, amount)}
                      variant="primary"
                    >
                      +{amount}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <Button
                    aria-label={`Subtract poison from ${player.name}`}
                    onClick={() => adjustPoison(player.id, -1)}
                    variant="secondary"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                    Poison
                  </Button>
                  <IconButton
                    label={`Add poison to ${player.name}`}
                    onClick={() => adjustPoison(player.id, 1)}
                    variant="secondary"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Reset ${player.name}`}
                    onClick={() => resetPlayer(player.id)}
                    variant="secondary"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                  </IconButton>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    aria-label={`Set ${player.name} as active keyboard player`}
                    onClick={() => selectActivePlayer(player.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Active
                  </Button>
                  {player.status === "eliminated" ||
                  player.status === "winner" ? (
                    <Button
                      aria-label={`Restore ${player.name}`}
                      onClick={() => restorePlayer(player.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      aria-label={`Eliminate ${player.name}`}
                      onClick={() => eliminatePlayer(player.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Eliminate
                    </Button>
                  )}
                  <Button
                    aria-label={`Mark ${player.name} as winner`}
                    onClick={() => markWinner(player.id)}
                    size="sm"
                    type="button"
                    variant="primary"
                  >
                    <Trophy className="size-4" aria-hidden="true" />
                    Winner
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  if (tableMode) {
    return (
      <div
        className="fixed inset-0 z-50 bg-background p-2 text-foreground sm:p-3"
        data-testid="life-table-display"
      >
        {board}
      </div>
    );
  }

  return board;
}
