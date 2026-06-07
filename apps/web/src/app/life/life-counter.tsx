"use client";

import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Coins,
  Crown,
  Flag,
  Gem,
  Heart,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  Pause,
  Plus,
  Play,
  Radiation,
  Redo2,
  RotateCcw,
  Shuffle,
  Shield,
  SkipForward,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Trash2,
  Undo2,
  UserPlus,
  Users,
  Zap,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
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

type PlayerPanelKey = "life" | "counters" | "setup" | "result";

type PlayerVisualTheme = {
  accent: string;
  background: string;
  border: string;
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

const playerPanelOrder = [
  "life",
  "counters",
  "setup",
  "result",
] satisfies PlayerPanelKey[];

const playerPanelLabels = {
  life: "Life",
  counters: "Counters",
  setup: "Setup",
  result: "Result",
} satisfies Record<PlayerPanelKey, string>;

const playerPanelIcons = {
  life: Heart,
  counters: Sparkles,
  setup: Shield,
  result: Trophy,
} satisfies Record<PlayerPanelKey, typeof Heart>;

const playerVisualThemes = {
  "player-a": {
    accent: "#fb7185",
    border: "rgba(251, 113, 133, 0.62)",
    background:
      "radial-gradient(circle at 20% 25%, rgba(251, 113, 133, 0.38), transparent 34%), linear-gradient(135deg, rgba(69, 10, 10, 0.94), rgba(18, 20, 24, 0.96)), linear-gradient(40deg, rgba(127, 29, 29, 0.7), rgba(2, 6, 23, 0.92))",
  },
  "player-b": {
    accent: "#60a5fa",
    border: "rgba(96, 165, 250, 0.62)",
    background:
      "radial-gradient(circle at 75% 18%, rgba(96, 165, 250, 0.42), transparent 33%), linear-gradient(145deg, rgba(12, 36, 74, 0.94), rgba(13, 16, 28, 0.96)), linear-gradient(35deg, rgba(30, 64, 175, 0.62), rgba(2, 6, 23, 0.95))",
  },
  "player-c": {
    accent: "#4ade80",
    border: "rgba(74, 222, 128, 0.58)",
    background:
      "radial-gradient(circle at 24% 76%, rgba(74, 222, 128, 0.36), transparent 34%), linear-gradient(140deg, rgba(15, 66, 44, 0.92), rgba(8, 22, 20, 0.97)), linear-gradient(35deg, rgba(21, 128, 61, 0.52), rgba(2, 6, 23, 0.94))",
  },
  "player-d": {
    accent: "#fbbf24",
    border: "rgba(251, 191, 36, 0.58)",
    background:
      "radial-gradient(circle at 82% 70%, rgba(251, 191, 36, 0.38), transparent 34%), linear-gradient(140deg, rgba(87, 52, 9, 0.94), rgba(19, 18, 15, 0.96)), linear-gradient(30deg, rgba(180, 83, 9, 0.48), rgba(2, 6, 23, 0.94))",
  },
  "player-e": {
    accent: "#c084fc",
    border: "rgba(192, 132, 252, 0.58)",
    background:
      "radial-gradient(circle at 72% 24%, rgba(192, 132, 252, 0.36), transparent 34%), linear-gradient(145deg, rgba(54, 24, 86, 0.94), rgba(14, 14, 24, 0.96)), linear-gradient(35deg, rgba(109, 40, 217, 0.46), rgba(2, 6, 23, 0.94))",
  },
  "player-f": {
    accent: "#22d3ee",
    border: "rgba(34, 211, 238, 0.58)",
    background:
      "radial-gradient(circle at 18% 72%, rgba(34, 211, 238, 0.36), transparent 34%), linear-gradient(135deg, rgba(16, 72, 89, 0.94), rgba(9, 20, 28, 0.96)), linear-gradient(35deg, rgba(14, 116, 144, 0.46), rgba(2, 6, 23, 0.94))",
  },
  "player-g": {
    accent: "#fde047",
    border: "rgba(253, 224, 71, 0.54)",
    background:
      "radial-gradient(circle at 28% 28%, rgba(253, 224, 71, 0.28), transparent 34%), linear-gradient(135deg, rgba(77, 64, 16, 0.93), rgba(16, 20, 18, 0.96)), linear-gradient(35deg, rgba(161, 98, 7, 0.42), rgba(2, 6, 23, 0.94))",
  },
  "player-h": {
    accent: "#f472b6",
    border: "rgba(244, 114, 182, 0.58)",
    background:
      "radial-gradient(circle at 70% 75%, rgba(244, 114, 182, 0.34), transparent 34%), linear-gradient(135deg, rgba(83, 24, 67, 0.93), rgba(20, 17, 24, 0.96)), linear-gradient(35deg, rgba(190, 24, 93, 0.42), rgba(2, 6, 23, 0.94))",
  },
} satisfies Record<string, PlayerVisualTheme>;

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

function getPlayerVisualTheme(color: string) {
  return Object.hasOwn(playerVisualThemes, color)
    ? playerVisualThemes[color as keyof typeof playerVisualThemes]
    : playerVisualThemes["player-a"];
}

function getPlayerTileStyle(color: string): CSSProperties {
  const theme = getPlayerVisualTheme(color);

  return {
    "--life-tile-accent": theme.accent,
    backgroundImage: theme.background,
    borderColor: theme.border,
  } as CSSProperties;
}

function getLifeValueClassName(playerCount: number) {
  if (playerCount >= 7) {
    return "text-4xl";
  }

  if (playerCount >= 5) {
    return "text-5xl";
  }

  return "text-7xl md:text-8xl";
}

function getPrimaryCommanderName(player: Player) {
  return player.commanders[0]?.name.trim() || "Commander";
}

function getCommanderTaxTotal(player: Player) {
  return player.commanders.reduce(
    (total, commander) => total + commander.castCount * 2,
    0,
  );
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
  const tileTouchStartRef = useRef<{ playerId: string; x: number } | null>(
    null,
  );
  const [tableMode, setTableMode] = useState(false);
  const [centerMenuOpen, setCenterMenuOpen] = useState(false);
  const [playerPanelById, setPlayerPanelById] = useState<
    Partial<Record<string, PlayerPanelKey>>
  >({});
  const [playerDrawer, setPlayerDrawer] = useState<{
    playerId: string;
    panel: PlayerPanelKey;
  } | null>(null);
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
          expectedServerActionSequenceRef.current = result.serverActionSequence;
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

  function getPlayerPanel(playerId: string): PlayerPanelKey {
    return playerPanelById[playerId] ?? "life";
  }

  function setPlayerPanel(playerId: string, panel: PlayerPanelKey) {
    setPlayerPanelById((current) => ({ ...current, [playerId]: panel }));
  }

  function shiftPlayerPanel(playerId: string, offset: number) {
    setPlayerPanelById((current) => {
      const currentPanel = current[playerId] ?? "life";
      const currentIndex = playerPanelOrder.indexOf(currentPanel);
      const nextIndex =
        (currentIndex + offset + playerPanelOrder.length) %
        playerPanelOrder.length;

      return { ...current, [playerId]: playerPanelOrder[nextIndex] };
    });
  }

  function handleTileTouchStart(playerId: string, clientX: number) {
    tileTouchStartRef.current = { playerId, x: clientX };
  }

  function handleTileTouchEnd(playerId: string, clientX: number) {
    const start = tileTouchStartRef.current;
    tileTouchStartRef.current = null;

    if (!start || start.playerId !== playerId) {
      return;
    }

    const delta = clientX - start.x;

    if (Math.abs(delta) < 42) {
      return;
    }

    shiftPlayerPanel(playerId, delta < 0 ? 1 : -1);
  }

  function openPlayerDrawer(playerId: string, panel: PlayerPanelKey) {
    setCenterMenuOpen(false);
    setPlayerPanel(playerId, panel);
    setPlayerDrawer({ playerId, panel });
  }

  function setPlayerDrawerPanel(panel: PlayerPanelKey) {
    setPlayerDrawer((current) => (current ? { ...current, panel } : current));
  }

  function handlePlayerDrawerOpenChange(open: boolean) {
    if (open) {
      return;
    }

    const playerId = playerDrawer?.playerId;

    setPlayerDrawer(null);

    if (playerId) {
      setPlayerPanel(playerId, "life");
    }
  }

  function getIncomingCommanderDamageTotal(playerId: string) {
    return commanderSources.reduce((total, source) => {
      if (source.player.id === playerId) {
        return total;
      }

      return total + (source.commander.damageByDefender[playerId] ?? 0);
    }, 0);
  }

  function getBoardGridStyle(): CSSProperties {
    const columns = visiblePlayers.length <= 2 ? 1 : 2;
    const rows = Math.ceil(visiblePlayers.length / columns);

    return {
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    };
  }

  function renderHiddenState() {
    return (
      <div className="sr-only">
        <span data-testid="life-save-status">{localSaveLabel}</span>
        <span data-testid="life-sync-scope">{syncScopeLabel}</span>
        <span data-testid="life-game-result" role="status">
          {gameResultLabel}
        </span>
        <span data-testid="game-timer">
          {formatDuration(gameElapsedSeconds)}
        </span>
        <span data-testid="turn-timer">
          {formatDuration(turnElapsedSeconds)}
        </span>
        <span data-testid="active-turn-player">
          {activePlayer?.name ?? "Player 1"}
        </span>
        <span data-testid="turn-count">Turn {turnCount}</span>
        <span data-testid="turn-order">
          {visiblePlayers
            .map((player, index) => `${index + 1}. ${player.name}`)
            .join(" ")}
        </span>
        <span data-testid="monarch-holder">
          {monarchPlayer ? `${monarchPlayer.name} monarch` : "No monarch"}
        </span>
        <span data-testid="initiative-holder">
          {initiativePlayer
            ? `${initiativePlayer.name} initiative`
            : "No initiative"}
        </span>
        <span data-testid="day-night-state">
          {dayNight === "unset" ? "Day/night unset" : dayNight}
        </span>
        <span data-testid="storm-count">{stormCount}</span>
        {visiblePlayers.map((player) => (
          <span key={`${player.id}-hidden-state`}>
            <span data-testid={`${player.id}-status`}>
              {playerStatusLabel(player.status)}
            </span>
            <span data-testid={`${player.id}-poison-count`}>
              {player.poison}
            </span>
            {player.cityBlessing ? (
              <span data-testid={`${player.id}-city-blessing`}>
                {"City's blessing"}
              </span>
            ) : null}
            {playerCounterOptions.map(({ key }) => (
              <span data-testid={`${player.id}-${key}-count`} key={key}>
                {player[key]}
              </span>
            ))}
            {manaOptions.map(({ symbol }) => (
              <span
                data-testid={`${player.id}-floating-mana-${symbol}-count`}
                key={symbol}
              >
                {player.floatingMana[symbol]}
              </span>
            ))}
            {player.commanders.map((commander) => (
              <span
                data-testid={`${commander.id}-cast-count`}
                key={commander.id}
              >
                {commander.castCount}
              </span>
            ))}
            {commanderSources
              .filter((source) => source.player.id !== player.id)
              .map((source) => (
                <span
                  data-testid={`${player.id}-${source.commander.id}-commander-damage`}
                  key={`${player.id}-${source.commander.id}`}
                >
                  {source.commander.damageByDefender[player.id] ?? 0}
                </span>
              ))}
          </span>
        ))}
      </div>
    );
  }

  function renderPanelTabs(player: Player) {
    return (
      <div className="pointer-events-auto flex max-w-full items-center justify-center gap-1 rounded-full border border-white/15 bg-black/35 p-1 text-[0.62rem] font-black uppercase text-white/70 backdrop-blur">
        <IconButton
          className="hidden size-7 border-white/10 bg-white/10 text-white hover:bg-white/20 sm:inline-flex"
          label={`Previous panel for ${player.name}`}
          onClick={() => shiftPlayerPanel(player.id, -1)}
          type="button"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </IconButton>
        {playerPanelOrder.map((panel) => {
          const Icon = playerPanelIcons[panel];

          return (
            <button
              aria-label={`Show ${playerPanelLabels[panel].toLowerCase()} panel for ${player.name}`}
              className={cn(
                "inline-flex size-7 items-center justify-center gap-1 rounded-full transition-colors sm:w-auto sm:px-2",
                getPlayerPanel(player.id) === panel
                  ? "bg-white text-black"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
              )}
              key={panel}
              onClick={() => setPlayerPanel(player.id, panel)}
              type="button"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {playerPanelLabels[panel]}
              </span>
            </button>
          );
        })}
        <IconButton
          className="hidden size-7 border-white/10 bg-white/10 text-white hover:bg-white/20 sm:inline-flex"
          label={`Next panel for ${player.name}`}
          onClick={() => shiftPlayerPanel(player.id, 1)}
          type="button"
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </IconButton>
      </div>
    );
  }

  function renderLifePanel(player: Player) {
    const commanderDamageTotal = getIncomingCommanderDamageTotal(player.id);
    const commanderTaxTotal = getCommanderTaxTotal(player);

    return (
      <div className="grid h-full place-items-center px-3 text-center text-white drop-shadow-lg">
        <div className="absolute left-3 top-3 z-20 flex gap-1.5">
          <button
            aria-label={`Open commander damage for ${player.name}`}
            className="pointer-events-auto inline-flex h-10 min-w-16 items-center justify-center gap-1 rounded-2xl border border-white/15 bg-black/35 px-2 text-sm font-black tabular-nums text-white backdrop-blur active:scale-95"
            onClick={() => openPlayerDrawer(player.id, "counters")}
            type="button"
          >
            <Swords className="size-4" aria-hidden="true" />
            {commanderDamageTotal}
          </button>
          <button
            aria-label={`Open commander tax for ${player.name}`}
            className="pointer-events-auto inline-flex h-10 min-w-16 items-center justify-center gap-1 rounded-2xl border border-white/15 bg-black/35 px-2 text-sm font-black tabular-nums text-white backdrop-blur active:scale-95"
            onClick={() => openPlayerDrawer(player.id, "setup")}
            type="button"
          >
            <Coins className="size-4" aria-hidden="true" />
            {commanderTaxTotal}
          </button>
        </div>
        <div className="min-w-0">
          <h2 className="mx-auto max-w-[11rem] truncate text-lg font-black leading-tight text-white md:max-w-none md:text-2xl">
            {player.name}
          </h2>
          <p
            className={cn(
              "mt-1 leading-none text-white tabular-nums",
              getLifeValueClassName(playerCount),
            )}
          >
            {player.life}
          </p>
          <p className="mx-auto mt-2 max-w-[12rem] truncate text-xs font-bold uppercase text-white/75">
            {getPrimaryCommanderName(player)}
            {player.deck.trim() ? ` - ${player.deck}` : ""}
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[0.65rem] font-black uppercase text-white/70">
            <span>{playerStatusLabel(player.status)}</span>
            {player.id === effectiveActivePlayerId ? (
              <span>Keyboard</span>
            ) : null}
            {player.poison > 0 ? <span>{player.poison} poison</span> : null}
          </div>
        </div>
      </div>
    );
  }

  function renderCountersPanel(player: Player) {
    const counterPreview = [
      { label: "Poison", value: player.poison, Icon: Skull },
      ...playerCounterOptions.map(({ key, label, Icon }) => ({
        label,
        value: player[key],
        Icon,
      })),
    ];

    return (
      <div className="grid h-full content-center gap-3 px-3 text-white">
        <div className="grid grid-cols-2 gap-2">
          {counterPreview.map(({ label, value, Icon }) => (
            <button
              aria-label={`Open ${label.toLowerCase()} counters for ${player.name}`}
              className="pointer-events-auto grid min-h-16 place-items-center rounded-2xl border border-white/10 bg-black/45 p-2 text-center backdrop-blur active:scale-[0.98]"
              key={label}
              onClick={() => openPlayerDrawer(player.id, "counters")}
              type="button"
            >
              <Icon className="size-5 text-white/85" aria-hidden="true" />
              <span className="text-lg font-black tabular-nums">{value}</span>
              <span className="text-[0.65rem] font-bold uppercase text-white/55">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderSetupPanel(player: Player) {
    return (
      <div className="grid h-full content-center gap-3 px-3 text-white">
        <button
          aria-label={`Open deck setup for ${player.name}`}
          className="pointer-events-auto flex min-h-20 items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/45 p-3 text-left backdrop-blur active:scale-[0.98]"
          onClick={() => openPlayerDrawer(player.id, "setup")}
          type="button"
        >
          <Shield className="size-8 text-white/75" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-base font-black">Deck</span>
            <span className="block truncate text-xs font-bold text-white/55">
              {player.deck.trim() || "No deck label"}
            </span>
          </span>
        </button>
        <button
          aria-label={`Open partner setup for ${player.name}`}
          className="pointer-events-auto flex min-h-20 items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/45 p-3 text-left backdrop-blur active:scale-[0.98]"
          onClick={() => openPlayerDrawer(player.id, "setup")}
          type="button"
        >
          <Users
            className="size-8 text-[var(--life-tile-accent)]"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block truncate text-base font-black">
              Partners
            </span>
            <span className="block truncate text-xs font-bold text-white/55">
              {player.commanders.length} commander
              {player.commanders.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>
      </div>
    );
  }

  function renderResultPanel(player: Player) {
    return (
      <div className="grid h-full content-center gap-3 px-3 text-white">
        <div className="grid grid-cols-2 gap-2">
          <button
            aria-label={`Mark ${player.name} as winner`}
            className="pointer-events-auto grid min-h-20 place-items-center rounded-3xl border border-white/10 bg-black/45 p-2 text-center backdrop-blur active:scale-[0.98]"
            onClick={() => markWinner(player.id)}
            type="button"
          >
            <Trophy className="size-7 text-yellow-200" aria-hidden="true" />
            <span className="text-xs font-black uppercase">Win</span>
          </button>
          {player.status === "eliminated" || player.status === "winner" ? (
            <button
              aria-label={`Restore ${player.name}`}
              className="pointer-events-auto grid min-h-20 place-items-center rounded-3xl border border-white/10 bg-black/45 p-2 text-center backdrop-blur active:scale-[0.98]"
              onClick={() => restorePlayer(player.id)}
              type="button"
            >
              <Heart className="size-7 text-white" aria-hidden="true" />
              <span className="text-xs font-black uppercase">Restore</span>
            </button>
          ) : (
            <button
              aria-label={`Eliminate ${player.name}`}
              className="pointer-events-auto grid min-h-20 place-items-center rounded-3xl border border-white/10 bg-black/45 p-2 text-center backdrop-blur active:scale-[0.98]"
              onClick={() => eliminatePlayer(player.id)}
              type="button"
            >
              <Skull className="size-7 text-white" aria-hidden="true" />
              <span className="text-xs font-black uppercase">Lose</span>
            </button>
          )}
          <button
            aria-label="Draw"
            className="pointer-events-auto grid min-h-20 place-items-center rounded-3xl border border-white/10 bg-black/45 p-2 text-center backdrop-blur active:scale-[0.98]"
            onClick={() => setSharedResult("draw")}
            type="button"
          >
            <Flag className="size-7 text-white" aria-hidden="true" />
            <span className="text-xs font-black uppercase">Draw</span>
          </button>
          <button
            aria-label="No contest"
            className="pointer-events-auto grid min-h-20 place-items-center rounded-3xl border border-white/10 bg-black/45 p-2 text-center backdrop-blur active:scale-[0.98]"
            onClick={() => setSharedResult("no-contest")}
            type="button"
          >
            <Ban className="size-7 text-white" aria-hidden="true" />
            <span className="text-xs font-black uppercase">Concede</span>
          </button>
        </div>
      </div>
    );
  }

  function renderPlayerPanel(player: Player) {
    switch (getPlayerPanel(player.id)) {
      case "counters":
        return renderCountersPanel(player);
      case "setup":
        return renderSetupPanel(player);
      case "result":
        return renderResultPanel(player);
      case "life":
        return renderLifePanel(player);
    }
  }

  function renderPlayerTile(player: Player, index: number) {
    const isOddLastTile =
      visiblePlayers.length > 2 &&
      visiblePlayers.length % 2 === 1 &&
      index === visiblePlayers.length - 1;

    return (
      <article
        aria-label={`${player.name}, ${playerStatusLabel(player.status)}, ${player.life} life, ${player.poison} poison`}
        className={cn(
          "relative min-h-0 overflow-hidden rounded-[1.65rem] border bg-black shadow-[0_18px_50px_rgb(0_0_0_/_0.45)]",
          "grid select-none touch-pan-y",
          player.id === effectiveActivePlayerId && "ring-2 ring-white/80",
          player.status === "eliminated" && "opacity-70 grayscale-[0.35]",
          isOddLastTile && "col-span-2",
        )}
        data-testid="life-player-card"
        key={player.id}
        onTouchEnd={(event) => {
          const touch = event.changedTouches.item(0);
          if (touch) {
            handleTileTouchEnd(player.id, touch.clientX);
          }
        }}
        onTouchStart={(event) => {
          const touch = event.touches.item(0);
          if (touch) {
            handleTileTouchStart(player.id, touch.clientX);
          }
        }}
        style={getPlayerTileStyle(player.color)}
      >
        <button
          aria-label={`Add 1 life to ${player.name}`}
          className="absolute inset-x-0 top-0 z-0 h-1/2 text-white/30 transition-colors hover:bg-white/5 active:bg-white/10"
          onClick={() => adjustLife(player.id, 1)}
          type="button"
        >
          <Plus className="absolute right-4 top-4 size-5" aria-hidden="true" />
        </button>
        <button
          aria-label={`Subtract 1 life from ${player.name}`}
          className="absolute inset-x-0 bottom-0 z-0 h-1/2 text-white/30 transition-colors hover:bg-black/10 active:bg-black/25"
          onClick={() => adjustLife(player.id, -1)}
          type="button"
        >
          <Minus
            className="absolute bottom-4 right-4 size-5"
            aria-hidden="true"
          />
        </button>
        <div className="pointer-events-none relative z-10 h-full min-h-0">
          {renderPlayerPanel(player)}
        </div>
        <div className="absolute inset-x-2 bottom-2 z-20 flex justify-center">
          {renderPanelTabs(player)}
        </div>
      </article>
    );
  }

  function renderCenterMenu() {
    return (
      <Drawer open={centerMenuOpen} onOpenChange={setCenterMenuOpen}>
        <DrawerContent className="border-white/10 bg-zinc-950 text-white md:w-[28rem]">
          <DrawerTitle className="pr-10 text-lg font-black">
            Table Menu
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Life counter table actions and setup.
          </DrawerDescription>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap gap-2 text-xs font-black uppercase text-white/70">
                <span>{gameResultLabel}</span>
                <span>{activePlayer?.name ?? "Player 1"}</span>
                <span>Turn {turnCount}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[0.7rem] font-bold uppercase text-white/45">
                <span>{localSaveLabel}</span>
                <span>{syncScopeLabel}</span>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <SegmentedControl
                className="grid-cols-7 [&_button]:border-white/10 [&_button]:bg-black/30 [&_button]:text-white"
                label="Player count"
                onValueChange={updatePlayerCount}
                options={playerCountOptions}
                value={String(playerCount)}
              />
              <SegmentedControl
                className="grid-cols-3 [&_button]:border-white/10 [&_button]:bg-black/30 [&_button]:text-white"
                label="Starting life"
                onValueChange={applyStartingLife}
                options={startingLifeOptions}
                value={String(startingLife)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                aria-label="Undo last life counter action"
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
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
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                disabled={!canRedo}
                onClick={redoNextAction}
                type="button"
                variant="secondary"
              >
                <Redo2 className="size-4" aria-hidden="true" />
                Redo
              </Button>
              <Button
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={resetGame}
                type="button"
                variant="secondary"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
              <Button
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={rematch}
                type="button"
                variant="secondary"
              >
                <Shuffle className="size-4" aria-hidden="true" />
                Rematch
              </Button>
              <Button
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={newGame}
                type="button"
                variant="secondary"
              >
                <Plus className="size-4" aria-hidden="true" />
                New game
              </Button>
              <Button
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                data-table-display-toggle
                onClick={() => {
                  setCenterMenuOpen(false);
                  setTableMode(true);
                }}
                type="button"
                variant="secondary"
              >
                <Maximize2 className="size-4" aria-hidden="true" />
                Table display
              </Button>
            </div>

            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="grid grid-cols-2 gap-2">
                <span className="rounded-2xl bg-black/35 p-3 text-center text-2xl font-black tabular-nums">
                  {formatDuration(gameElapsedSeconds)}
                </span>
                <span className="rounded-2xl bg-black/35 p-3 text-center text-2xl font-black tabular-nums">
                  {formatDuration(turnElapsedSeconds)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  aria-label={timersRunning ? "Pause timers" : "Start timers"}
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={toggleTimers}
                  type="button"
                  variant="secondary"
                >
                  {timersRunning ? (
                    <Pause className="size-4" aria-hidden="true" />
                  ) : (
                    <Play className="size-4" aria-hidden="true" />
                  )}
                  {timersRunning ? "Pause timers" : "Start timers"}
                </Button>
                <Button
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={advanceTurn}
                  type="button"
                  variant="secondary"
                >
                  <SkipForward className="size-4" aria-hidden="true" />
                  Next turn
                </Button>
                <Button
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={resetTurnTimer}
                  type="button"
                  variant="secondary"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Turn timer
                </Button>
                <Button
                  aria-label="Reset timers"
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={resetTimers}
                  type="button"
                  variant="secondary"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Timers
                </Button>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap gap-2 text-xs font-black uppercase text-white/65">
                <span>
                  <Crown
                    className="mr-1 inline size-4 text-yellow-200"
                    aria-hidden="true"
                  />
                  {monarchPlayer
                    ? `${monarchPlayer.name} monarch`
                    : "No monarch"}
                </span>
                <span>
                  <Flag
                    className="mr-1 inline size-4 text-teal-200"
                    aria-hidden="true"
                  />
                  {initiativePlayer
                    ? `${initiativePlayer.name} initiative`
                    : "No initiative"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setDayNightState("day")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Day
                </Button>
                <Button
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setDayNightState("night")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Night
                </Button>
                <Button
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setDayNightState("unset")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Clear
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <span className="rounded-2xl bg-black/35 px-3 py-2 text-sm font-black uppercase">
                  Storm {stormCount}
                </span>
                <IconButton
                  className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                  label="Subtract storm"
                  onClick={() => adjustStorm(-1)}
                  variant="secondary"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                  label="Add storm"
                  onClick={() => adjustStorm(1)}
                  variant="secondary"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setSharedResult("draw")}
                type="button"
                variant="secondary"
              >
                Draw
              </Button>
              <Button
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setSharedResult("no-contest")}
                type="button"
                variant="secondary"
              >
                <Ban className="size-4" aria-hidden="true" />
                No contest
              </Button>
            </div>

            <Button
              aria-label="Clean up saved inactive life counter sessions"
              className="border-white/10 bg-white/10 text-white hover:bg-white/20"
              disabled={
                cleanupEligibleCount <= 0 ||
                localCleanupState === "running" ||
                localSaveState === "checking" ||
                localSaveState === "unavailable"
              }
              onClick={cleanupSavedSessions}
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
        </DrawerContent>
      </Drawer>
    );
  }

  function renderPlayerDrawerContent(player: Player) {
    const incomingCommanderSources = commanderSources.filter(
      (source) => source.player.id !== player.id,
    );
    const drawerPanel = playerDrawer?.panel ?? "setup";

    return (
      <Drawer
        open={Boolean(playerDrawer)}
        onOpenChange={handlePlayerDrawerOpenChange}
      >
        <DrawerContent className="border-white/10 bg-zinc-950 text-white md:w-[30rem]">
          <DrawerTitle className="pr-10 text-lg font-black">
            {player.name}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Player controls for {player.name}.
          </DrawerDescription>
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-4 gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {playerPanelOrder.map((panel) => (
                <button
                  aria-label={`Show ${playerPanelLabels[panel].toLowerCase()} controls for ${player.name}`}
                  className={cn(
                    "h-9 rounded-full text-xs font-black uppercase",
                    drawerPanel === panel
                      ? "bg-white text-black"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                  key={panel}
                  onClick={() => setPlayerDrawerPanel(panel)}
                  type="button"
                >
                  {playerPanelLabels[panel]}
                </button>
              ))}
            </div>

            {drawerPanel === "life" ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    aria-label={`Subtract 1 life from ${player.name}`}
                    className="h-16 border-white/10 bg-red-950/70 text-xl text-white hover:bg-red-900"
                    onClick={() => adjustLife(player.id, -1)}
                    type="button"
                    variant="secondary"
                  >
                    <Minus className="size-5" aria-hidden="true" />1
                  </Button>
                  <Button
                    aria-label={`Add 1 life to ${player.name}`}
                    className="h-16 border-white/10 bg-emerald-950/70 text-xl text-white hover:bg-emerald-900"
                    onClick={() => adjustLife(player.id, 1)}
                    type="button"
                    variant="secondary"
                  >
                    <Plus className="size-5" aria-hidden="true" />1
                  </Button>
                </div>
                <Button
                  aria-label={`Set ${player.name} as active keyboard player`}
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => selectActivePlayer(player.id)}
                  type="button"
                  variant="secondary"
                >
                  <CircleDot className="size-4" aria-hidden="true" />
                  Active
                </Button>
              </div>
            ) : null}

            {drawerPanel === "setup" ? (
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <FormField label="Player name">
                  <input
                    className={cn(
                      fieldControlClassName,
                      "border-white/10 bg-black/35 text-white",
                    )}
                    onChange={(event) =>
                      updatePlayer(player.id, { name: event.target.value })
                    }
                    value={player.name}
                  />
                </FormField>
                <FormField label="Deck label">
                  <input
                    className={cn(
                      fieldControlClassName,
                      "border-white/10 bg-black/35 text-white",
                    )}
                    onChange={(event) =>
                      updatePlayer(player.id, { deck: event.target.value })
                    }
                    value={player.deck}
                  />
                </FormField>
                <FormField label="Color">
                  <select
                    className={cn(
                      fieldControlClassName,
                      "border-white/10 bg-black/35 text-white",
                    )}
                    onChange={(event) =>
                      updatePlayer(player.id, { color: event.target.value })
                    }
                    value={player.color}
                  >
                    {colorOptions.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase text-white/55">
                      Commanders
                    </p>
                    <Button
                      aria-label="Add commander"
                      className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => addCommander(player.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <UserPlus className="size-4" aria-hidden="true" />
                      Add commander
                    </Button>
                  </div>
                  {player.commanders.map((commander, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto] gap-2"
                      key={commander.id}
                    >
                      <input
                        aria-label={`Commander ${index + 1}`}
                        className={cn(
                          fieldControlClassName,
                          "border-white/10 bg-black/35 text-white",
                        )}
                        onChange={(event) =>
                          updateCommander(player.id, commander.id, {
                            name: event.target.value,
                          })
                        }
                        value={commander.name}
                      />
                      <IconButton
                        className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                        disabled={player.commanders.length <= 1}
                        label={`Remove ${commander.name.trim() || `Commander ${index + 1}`}`}
                        onClick={() => removeCommander(player.id, commander.id)}
                        variant="secondary"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 rounded-2xl bg-black/25 p-3">
                  <p className="text-xs font-black uppercase text-white/55">
                    Commander tax
                  </p>
                  {player.commanders.map((commander, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2"
                      key={commander.id}
                    >
                      <span className="truncate text-sm font-bold">
                        {commander.name.trim() || `Commander ${index + 1}`}
                      </span>
                      <span className="w-10 text-center text-lg font-black tabular-nums">
                        {commander.castCount * 2}
                      </span>
                      <IconButton
                        className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                        label={`Subtract cast from ${commander.name.trim() || `Commander ${index + 1}`}`}
                        onClick={() =>
                          adjustCommanderCastCount(player.id, commander.id, -1)
                        }
                        variant="secondary"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                        label={`Add cast to ${commander.name.trim() || `Commander ${index + 1}`}`}
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
              </div>
            ) : null}

            {drawerPanel === "counters" ? (
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-2xl bg-black/25 p-3">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm font-black">
                    <Skull
                      className="size-4 text-white/65"
                      aria-hidden="true"
                    />
                    Poison
                  </span>
                  <IconButton
                    className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                    label={`Subtract poison from ${player.name}`}
                    onClick={() => adjustPoison(player.id, -1)}
                    variant="secondary"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                    label={`Add poison to ${player.name}`}
                    onClick={() => adjustPoison(player.id, 1)}
                    variant="secondary"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </IconButton>
                </div>
                {playerCounterOptions.map(({ key, label, Icon }) => (
                  <div
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-2xl bg-black/25 p-3"
                    key={key}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-black">
                      <Icon
                        className="size-4 text-white/65"
                        aria-hidden="true"
                      />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="w-8 text-center text-lg font-black tabular-nums">
                      {player[key]}
                    </span>
                    <IconButton
                      className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                      label={`Subtract ${label.toLowerCase()} from ${player.name}`}
                      onClick={() => adjustPlayerCounter(player.id, key, -1)}
                      variant="secondary"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      className="size-9 border-white/10 bg-white/10 text-white hover:bg-white/20"
                      label={`Add ${label.toLowerCase()} to ${player.name}`}
                      onClick={() => adjustPlayerCounter(player.id, key, 1)}
                      variant="secondary"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                ))}
                <div className="grid gap-2 rounded-2xl bg-black/25 p-3">
                  <p className="text-xs font-black uppercase text-white/55">
                    Floating mana
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {manaOptions.map(({ symbol, label }) => (
                      <div
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-1"
                        key={symbol}
                      >
                        <span className="text-sm font-black">{symbol}</span>
                        <span className="w-7 text-center text-sm font-black tabular-nums">
                          {player.floatingMana[symbol]}
                        </span>
                        <IconButton
                          className="size-8 border-white/10 bg-white/10 text-white hover:bg-white/20"
                          label={`Subtract ${label} floating mana from ${player.name}`}
                          onClick={() =>
                            adjustFloatingMana(player.id, symbol, -1)
                          }
                          variant="secondary"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          className="size-8 border-white/10 bg-white/10 text-white hover:bg-white/20"
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
                <div className="grid gap-2 rounded-2xl bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase text-white/55">
                      Custom counters
                    </p>
                    <Button
                      aria-label={`Add custom counter for ${player.name}`}
                      className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => addCustomCounter(player.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Add
                    </Button>
                  </div>
                  {player.customCounters.map((counter, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2"
                      data-testid={`${player.id}-custom-counter-row`}
                      key={counter.id}
                    >
                      <input
                        aria-label={`Custom counter name ${index + 1} for ${player.name}`}
                        className={cn(
                          fieldControlClassName,
                          "h-9 min-w-0 border-white/10 bg-black/35 text-white",
                        )}
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
                        className="size-8 border-white/10 bg-white/10 text-white hover:bg-white/20"
                        label={`Subtract ${counter.name} from ${player.name}`}
                        onClick={() =>
                          adjustCustomCounter(player.id, counter.id, -1)
                        }
                        variant="secondary"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        className="size-8 border-white/10 bg-white/10 text-white hover:bg-white/20"
                        label={`Add ${counter.name} to ${player.name}`}
                        onClick={() =>
                          adjustCustomCounter(player.id, counter.id, 1)
                        }
                        variant="secondary"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        className="size-8 border-white/10 bg-white/10 text-white hover:bg-white/20"
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
                <div className="grid gap-2 rounded-2xl bg-black/25 p-3">
                  <p className="text-xs font-black uppercase text-white/55">
                    Commander damage taken
                  </p>
                  {incomingCommanderSources.map((source) => {
                    const sourceName = commanderDisplayName(source);
                    const damage =
                      source.commander.damageByDefender[player.id] ?? 0;

                    return (
                      <div
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2"
                        key={`${player.id}-${source.commander.id}`}
                      >
                        <span className="truncate text-sm font-bold">
                          {sourceName}
                        </span>
                        <span className="w-8 text-center text-lg font-black tabular-nums">
                          {damage}
                        </span>
                        <IconButton
                          className="size-8 border-white/10 bg-white/10 text-white hover:bg-white/20"
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
                          className="size-8 border-white/10 bg-white/10 text-white hover:bg-white/20"
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
            ) : null}

            {drawerPanel === "result" ? (
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    aria-label={`Set ${player.name} as active keyboard player`}
                    className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => selectActivePlayer(player.id)}
                    type="button"
                    variant="secondary"
                  >
                    Active
                  </Button>
                  <Button
                    aria-label={`Reset ${player.name}`}
                    className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => resetPlayer(player.id)}
                    type="button"
                    variant="secondary"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reset
                  </Button>
                  {player.status === "eliminated" ||
                  player.status === "winner" ? (
                    <Button
                      aria-label={`Restore ${player.name}`}
                      className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => restorePlayer(player.id)}
                      type="button"
                      variant="secondary"
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      aria-label={`Eliminate ${player.name}`}
                      className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => eliminatePlayer(player.id)}
                      type="button"
                      variant="secondary"
                    >
                      Eliminate
                    </Button>
                  )}
                  <Button
                    aria-label={`Mark ${player.name} as winner`}
                    className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => markWinner(player.id)}
                    type="button"
                    variant="secondary"
                  >
                    <Trophy className="size-4" aria-hidden="true" />
                    Winner
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    aria-label={`Make ${player.name} monarch`}
                    className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setTableRole("monarch", player.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Crown className="size-4" aria-hidden="true" />
                    Monarch
                  </Button>
                  <Button
                    aria-label={`Give initiative to ${player.name}`}
                    className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setTableRole("initiative", player.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Flag className="size-4" aria-hidden="true" />
                    Initiative
                  </Button>
                  <Button
                    aria-label={`Give city's blessing to ${player.name}`}
                    className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => toggleCityBlessing(player.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Gem className="size-4" aria-hidden="true" />
                    Blessing
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  const drawerPlayer = playerDrawer
    ? visiblePlayers.find((player) => player.id === playerDrawer.playerId)
    : null;

  const board = (
    <div
      className={cn(
        "relative isolate grid min-h-[calc(100dvh-10rem)] overflow-hidden rounded-[2rem] bg-black p-1.5 text-white shadow-2xl sm:min-h-[calc(100dvh-11rem)] sm:p-2",
        tableMode && "h-full min-h-0 rounded-none",
      )}
      data-testid="life-counter-board"
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {renderHiddenState()}
      {linkedStatusLabel ? (
        <p
          className="absolute left-3 top-3 z-30 max-w-[calc(100%-6rem)] rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[0.65rem] font-bold text-teal-100 shadow-lg backdrop-blur"
          data-testid="linked-life-status"
        >
          {linkedStatusLabel}
        </p>
      ) : null}
      {tableMode ? (
        <Button
          className="absolute right-3 top-3 z-40 border-white/10 bg-white text-black hover:bg-white/90"
          data-table-display-toggle
          onClick={() => setTableMode(false)}
          type="button"
          variant="secondary"
        >
          <Minimize2 className="size-4" aria-hidden="true" />
          Exit table
        </Button>
      ) : null}
      <div className="grid h-full min-h-0 gap-1.5" style={getBoardGridStyle()}>
        {visiblePlayers.map((player, index) => renderPlayerTile(player, index))}
      </div>
      <IconButton
        className="absolute left-1/2 top-1/2 z-40 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-black bg-white text-black shadow-[0_10px_30px_rgb(0_0_0_/_0.55)] hover:bg-white/90"
        label="Open life counter menu"
        onClick={() => setCenterMenuOpen(true)}
        type="button"
        variant="secondary"
      >
        <Menu className="size-7" aria-hidden="true" />
      </IconButton>
      {renderCenterMenu()}
      {drawerPlayer ? renderPlayerDrawerContent(drawerPlayer) : null}
    </div>
  );

  if (tableMode) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black p-0 text-white"
        data-testid="life-table-display"
      >
        {board}
      </div>
    );
  }

  return board;
}
