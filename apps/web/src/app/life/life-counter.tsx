"use client";

import {
  Ban,
  CircleDot,
  Coins,
  Crown,
  Flag,
  Flame,
  Gem,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Radiation,
  RotateCcw,
  Shuffle,
  Skull,
  Sparkles,
  Swords,
  SunMoon,
  Trophy,
  UserPlus,
  Zap,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

type Commander = {
  id: string;
  name: string;
  castCount: number;
  damageByDefender: Record<string, number>;
};

type PlayerStatus = "active" | "eliminated" | "winner";
type GameResult = "in-progress" | "winner" | "draw" | "no-contest";
type DayNightState = "unset" | "day" | "night";
type PlayerCounterKey = "experience" | "energy" | "rad" | "treasure";
type ManaSymbol = "W" | "U" | "B" | "R" | "G" | "C";

type CustomCounter = {
  id: string;
  name: string;
  value: number;
};

type Player = {
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

type CommanderSource = {
  commander: Commander;
  commanderNumber: number;
  player: Player;
};

const seats = [
  "North",
  "East",
  "South",
  "West",
  "Northwest",
  "Northeast",
  "Southeast",
  "Southwest",
];
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

function createCommander(playerId: string, commanderNumber = 1): Commander {
  return {
    id: `${playerId}-commander-${commanderNumber}`,
    name: "",
    castCount: 0,
    damageByDefender: {},
  };
}

function createFloatingMana(): Record<ManaSymbol, number> {
  return {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
  };
}

function createPlayers(startingLife: number): Player[] {
  return seats.map((seat, index) => {
    const playerId = `player-${index + 1}`;

    return {
      id: playerId,
      seat,
      name: `Player ${index + 1}`,
      commanders: [createCommander(playerId)],
      deck: "",
      color: colorOptions[index].value,
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

function resetPlayerCounters(player: Player, life: number): Player {
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

function playerStatusLabel(status: PlayerStatus) {
  if (status === "winner") {
    return "Winner";
  }

  if (status === "eliminated") {
    return "Eliminated";
  }

  return "Active";
}

export function LifeCounter() {
  const [startingLife, setStartingLife] = useState(40);
  const [playerCount, setPlayerCount] = useState(4);
  const [tableMode, setTableMode] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState("player-1");
  const [monarchPlayerId, setMonarchPlayerId] = useState<string | null>(null);
  const [initiativePlayerId, setInitiativePlayerId] = useState<string | null>(
    null,
  );
  const [dayNight, setDayNight] = useState<DayNightState>("unset");
  const [stormCount, setStormCount] = useState(0);
  const [gameResult, setGameResult] = useState<GameResult>("in-progress");
  const [announcement, setAnnouncement] = useState("Local life counter ready.");
  const [players, setPlayers] = useState<Player[]>(() =>
    createPlayers(startingLife),
  );

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

  useEffect(() => {
    if (tableMode) {
      document
        .querySelector<HTMLButtonElement>("[data-table-display-toggle]")
        ?.focus();
    }
  }, [tableMode]);

  useEffect(() => {
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
        setActivePlayerId(nextPlayer.id);
        setAnnouncement(`${nextPlayer.name} selected for keyboard controls.`);
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
        setActivePlayerId(nextPlayer.id);
        setAnnouncement(`${nextPlayer.name} selected for keyboard controls.`);
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
      setPlayers((current) =>
        current.map((player) =>
          player.id === currentActivePlayer.id
            ? { ...player, life: player.life + amount }
            : player,
        ),
      );
      setAnnouncement(
        `${currentActivePlayer.name} ${amount > 0 ? "gained" : "lost"} ${Math.abs(amount)} life.`,
      );
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveActivePlayerId, visiblePlayers]);

  function updatePlayer(id: string, patch: Partial<Player>) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, ...patch } : player,
      ),
    );
  }

  function updatePlayerCount(value: string) {
    const nextPlayerCount = Number(value);
    const nextVisibleIds = players
      .slice(0, nextPlayerCount)
      .map((player) => player.id);

    setPlayerCount(nextPlayerCount);

    if (!nextVisibleIds.includes(activePlayerId)) {
      setActivePlayerId(nextVisibleIds[0] ?? "player-1");
    }

    if (monarchPlayerId && !nextVisibleIds.includes(monarchPlayerId)) {
      setMonarchPlayerId(null);
    }

    if (initiativePlayerId && !nextVisibleIds.includes(initiativePlayerId)) {
      setInitiativePlayerId(null);
    }

    setAnnouncement(`Player count changed to ${nextPlayerCount}.`);
  }

  function updateCommander(
    playerId: string,
    commanderId: string,
    patch: Partial<Commander>,
  ) {
    setPlayers((current) =>
      current.map((player) =>
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
    );
  }

  function addCommander(playerId: string) {
    setPlayers((current) =>
      current.map((player) =>
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
    );
  }

  function removeCommander(playerId: string, commanderId: string) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId && player.commanders.length > 1
          ? {
              ...player,
              commanders: player.commanders.filter(
                (commander) => commander.id !== commanderId,
              ),
            }
          : player,
      ),
    );
  }

  function adjustLife(id: string, amount: number) {
    const targetPlayer = visiblePlayers.find((player) => player.id === id);
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, life: player.life + amount } : player,
      ),
    );
    if (targetPlayer) {
      setAnnouncement(
        `${targetPlayer.name} ${amount > 0 ? "gained" : "lost"} ${Math.abs(amount)} life.`,
      );
    }
  }

  function adjustPoison(id: string, amount: number) {
    const targetPlayer = visiblePlayers.find((player) => player.id === id);
    setPlayers((current) =>
      current.map((player) =>
        player.id === id
          ? { ...player, poison: Math.max(0, player.poison + amount) }
          : player,
      ),
    );
    if (targetPlayer) {
      setAnnouncement(
        `${targetPlayer.name} poison changed by ${amount > 0 ? "+" : ""}${amount}.`,
      );
    }
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

    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? { ...player, [key]: Math.max(0, player[key] + amount) }
          : player,
      ),
    );

    if (targetPlayer) {
      setAnnouncement(
        `${targetPlayer.name} ${counterLabel.toLowerCase()} changed by ${amount > 0 ? "+" : ""}${amount}.`,
      );
    }
  }

  function adjustFloatingMana(
    playerId: string,
    symbol: ManaSymbol,
    amount: number,
  ) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              floatingMana: {
                ...player.floatingMana,
                [symbol]: Math.max(0, player.floatingMana[symbol] + amount),
              },
            }
          : player,
      ),
    );

    if (targetPlayer) {
      setAnnouncement(
        `${targetPlayer.name} ${symbol} floating mana changed by ${amount > 0 ? "+" : ""}${amount}.`,
      );
    }
  }

  function setTableRole(role: "monarch" | "initiative", playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    const currentHolderId =
      role === "monarch" ? monarchPlayerId : initiativePlayerId;
    const nextHolderId = currentHolderId === playerId ? null : playerId;
    const label = role === "monarch" ? "monarch" : "initiative";

    if (role === "monarch") {
      setMonarchPlayerId(nextHolderId);
    } else {
      setInitiativePlayerId(nextHolderId);
    }

    if (targetPlayer) {
      setAnnouncement(
        nextHolderId
          ? `${targetPlayer.name} has the ${label}.`
          : `${targetPlayer.name} no longer has the ${label}.`,
      );
    }
  }

  function toggleCityBlessing(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? { ...player, cityBlessing: !player.cityBlessing }
          : player,
      ),
    );

    if (targetPlayer) {
      setAnnouncement(
        targetPlayer.cityBlessing
          ? `${targetPlayer.name} lost city's blessing.`
          : `${targetPlayer.name} gained city's blessing.`,
      );
    }
  }

  function addCustomCounter(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    setPlayers((current) =>
      current.map((player) => {
        if (player.id !== playerId) {
          return player;
        }

        const nextNumber = player.customCounters.length + 1;

        return {
          ...player,
          customCounters: [
            ...player.customCounters,
            {
              id: `${player.id}-custom-${Date.now()}-${nextNumber}`,
              name: `Custom ${nextNumber}`,
              value: 0,
            },
          ],
        };
      }),
    );

    if (targetPlayer) {
      setAnnouncement(`Custom counter added for ${targetPlayer.name}.`);
    }
  }

  function updateCustomCounter(
    playerId: string,
    counterId: string,
    patch: Partial<CustomCounter>,
  ) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              customCounters: player.customCounters.map((counter) =>
                counter.id === counterId ? { ...counter, ...patch } : counter,
              ),
            }
          : player,
      ),
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

    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              customCounters: player.customCounters.map((counter) =>
                counter.id === counterId
                  ? { ...counter, value: Math.max(0, counter.value + amount) }
                  : counter,
              ),
            }
          : player,
      ),
    );

    if (targetPlayer && targetCounter) {
      setAnnouncement(
        `${targetPlayer.name} ${targetCounter.name} changed by ${amount > 0 ? "+" : ""}${amount}.`,
      );
    }
  }

  function removeCustomCounter(playerId: string, counterId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );

    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              customCounters: player.customCounters.filter(
                (counter) => counter.id !== counterId,
              ),
            }
          : player,
      ),
    );

    if (targetPlayer) {
      setAnnouncement(`Custom counter removed from ${targetPlayer.name}.`);
    }
  }

  function adjustCommanderCastCount(
    playerId: string,
    commanderId: string,
    amount: number,
  ) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              commanders: player.commanders.map((commander) =>
                commander.id === commanderId
                  ? {
                      ...commander,
                      castCount: Math.max(0, commander.castCount + amount),
                    }
                  : commander,
              ),
            }
          : player,
      ),
    );
  }

  function adjustCommanderDamage(
    sourceCommanderId: string,
    defenderId: string,
    amount: number,
  ) {
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        commanders: player.commanders.map((commander) => {
          if (commander.id !== sourceCommanderId) {
            return commander;
          }

          const nextDamage = Math.max(
            0,
            (commander.damageByDefender[defenderId] ?? 0) + amount,
          );

          return {
            ...commander,
            damageByDefender: {
              ...commander.damageByDefender,
              [defenderId]: nextDamage,
            },
          };
        }),
      })),
    );
  }

  function applyStartingLife(value: string) {
    const nextStartingLife = Number(value);
    setStartingLife(nextStartingLife);
    setGameResult("in-progress");
    setMonarchPlayerId(null);
    setInitiativePlayerId(null);
    setDayNight("unset");
    setStormCount(0);
    setPlayers((current) =>
      current.map((player) => resetPlayerCounters(player, nextStartingLife)),
    );
    setAnnouncement(`Starting life changed to ${nextStartingLife}.`);
  }

  function resetPlayer(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    setGameResult("in-progress");
    if (monarchPlayerId === playerId) {
      setMonarchPlayerId(null);
    }
    if (initiativePlayerId === playerId) {
      setInitiativePlayerId(null);
    }
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        life: player.id === playerId ? startingLife : player.life,
        poison: player.id === playerId ? 0 : player.poison,
        status: player.id === playerId ? "active" : player.status,
        cityBlessing: player.id === playerId ? false : player.cityBlessing,
        experience: player.id === playerId ? 0 : player.experience,
        energy: player.id === playerId ? 0 : player.energy,
        rad: player.id === playerId ? 0 : player.rad,
        treasure: player.id === playerId ? 0 : player.treasure,
        floatingMana:
          player.id === playerId ? createFloatingMana() : player.floatingMana,
        customCounters:
          player.id === playerId
            ? player.customCounters.map((counter) => ({
                ...counter,
                value: 0,
              }))
            : player.customCounters,
        commanders: player.commanders.map((commander) => {
          const nextDamageByDefender = { ...commander.damageByDefender };
          delete nextDamageByDefender[playerId];

          return {
            ...commander,
            castCount: player.id === playerId ? 0 : commander.castCount,
            damageByDefender:
              player.id === playerId ? {} : nextDamageByDefender,
          };
        }),
      })),
    );
    if (targetPlayer) {
      setAnnouncement(`${targetPlayer.name} reset.`);
    }
  }

  function resetGame() {
    setGameResult("in-progress");
    setMonarchPlayerId(null);
    setInitiativePlayerId(null);
    setDayNight("unset");
    setStormCount(0);
    setPlayers((current) =>
      current.map((player) => resetPlayerCounters(player, startingLife)),
    );
    setAnnouncement("Game reset. Player setup was kept.");
  }

  function rematch() {
    const nextActivePlayerId = visiblePlayers[1]?.id ?? visiblePlayers[0]?.id;

    setGameResult("in-progress");
    setMonarchPlayerId(null);
    setInitiativePlayerId(null);
    setDayNight("unset");
    setStormCount(0);
    setPlayers((current) => {
      const visible = current.slice(0, playerCount);
      const hidden = current.slice(playerCount);
      const rotated = [...visible.slice(1), ...visible.slice(0, 1)].map(
        (player, index) => ({
          ...resetPlayerCounters(player, startingLife),
          seat: seats[index],
        }),
      );

      return [...rotated, ...hidden];
    });
    if (nextActivePlayerId) {
      setActivePlayerId(nextActivePlayerId);
    }
    setAnnouncement("Rematch ready. Players rotated one seat.");
  }

  function newGame() {
    setStartingLife(40);
    setPlayerCount(4);
    setTableMode(false);
    setMonarchPlayerId(null);
    setInitiativePlayerId(null);
    setDayNight("unset");
    setStormCount(0);
    setGameResult("in-progress");
    setPlayers(createPlayers(40));
    setActivePlayerId("player-1");
    setAnnouncement("New game ready.");
  }

  function eliminatePlayer(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    setGameResult("in-progress");
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? { ...player, status: "eliminated" }
          : player.status === "winner"
            ? { ...player, status: "active" }
            : player,
      ),
    );
    if (targetPlayer) {
      setAnnouncement(`${targetPlayer.name} eliminated.`);
    }
  }

  function restorePlayer(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    setGameResult("in-progress");
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, status: "active" } : player,
      ),
    );
    if (targetPlayer) {
      setAnnouncement(`${targetPlayer.name} restored.`);
    }
  }

  function markWinner(playerId: string) {
    const targetPlayer = visiblePlayers.find(
      (player) => player.id === playerId,
    );
    setGameResult("winner");
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? { ...player, status: "winner" }
          : visiblePlayers.some(
                (visiblePlayer) => visiblePlayer.id === player.id,
              )
            ? { ...player, status: "eliminated" }
            : player,
      ),
    );
    if (targetPlayer) {
      setAnnouncement(`${targetPlayer.name} marked as winner.`);
    }
  }

  function setSharedResult(
    nextResult: Extract<GameResult, "draw" | "no-contest">,
  ) {
    setGameResult(nextResult);
    setPlayers((current) =>
      current.map((player) =>
        visiblePlayers.some((visiblePlayer) => visiblePlayer.id === player.id)
          ? { ...player, status: "active" }
          : player,
      ),
    );
    setAnnouncement(
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
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
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
              onClick={() => setDayNight("day")}
              size="sm"
              type="button"
              variant={dayNight === "day" ? "primary" : "secondary"}
            >
              Day
            </Button>
            <Button
              onClick={() => setDayNight("night")}
              size="sm"
              type="button"
              variant={dayNight === "night" ? "primary" : "secondary"}
            >
              Night
            </Button>
            <Button
              onClick={() => setDayNight("unset")}
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
              onClick={() =>
                setStormCount((current) => Math.max(0, current - 1))
              }
              variant="secondary"
            >
              <Minus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              className="size-8"
              label="Add storm"
              onClick={() => setStormCount((current) => current + 1)}
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
                    onClick={() => {
                      setActivePlayerId(player.id);
                      setAnnouncement(
                        `${player.name} selected for keyboard controls.`,
                      );
                    }}
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
