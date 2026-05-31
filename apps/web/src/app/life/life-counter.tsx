"use client";

import {
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Skull,
  Swords,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

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

type Player = {
  id: string;
  seat: string;
  name: string;
  commanders: Commander[];
  deck: string;
  color: string;
  life: number;
  poison: number;
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

function createCommander(playerId: string, commanderNumber = 1): Commander {
  return {
    id: `${playerId}-commander-${commanderNumber}`,
    name: "",
    castCount: 0,
    damageByDefender: {},
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

export function LifeCounter() {
  const [startingLife, setStartingLife] = useState(40);
  const [playerCount, setPlayerCount] = useState(4);
  const [tableMode, setTableMode] = useState(false);
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

  function updatePlayer(id: string, patch: Partial<Player>) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, ...patch } : player,
      ),
    );
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
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, life: player.life + amount } : player,
      ),
    );
  }

  function adjustPoison(id: string, amount: number) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id
          ? { ...player, poison: Math.max(0, player.poison + amount) }
          : player,
      ),
    );
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
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        life: nextStartingLife,
        poison: 0,
        commanders: player.commanders.map((commander) => ({
          ...commander,
          castCount: 0,
          damageByDefender: {},
        })),
      })),
    );
  }

  function resetPlayer(playerId: string) {
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        life: player.id === playerId ? startingLife : player.life,
        poison: player.id === playerId ? 0 : player.poison,
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
  }

  const board = (
    <div
      className={cn("grid gap-4", tableMode && "h-full grid-rows-[auto_1fr]")}
      data-testid="life-counter-board"
    >
      <div className="grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
        <div className="grid gap-1">
          <h2 className="text-base font-bold">Table setup</h2>
          <p className="text-sm font-medium text-muted">
            Four-player Commander is the default.
          </p>
        </div>
        <SegmentedControl
          className="grid-cols-7"
          label="Player count"
          onValueChange={(value) => setPlayerCount(Number(value))}
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
                tableMode && "min-h-[32rem]",
              )}
              data-testid="life-player-card"
              key={player.id}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">
                    Seat {player.seat}
                  </p>
                  <h2 className="truncate text-lg font-black">{player.name}</h2>
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
