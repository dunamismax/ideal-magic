"use client";

import { Minus, Plus, RotateCcw, Skull } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

type Player = {
  id: string;
  seat: string;
  name: string;
  commander: string;
  deck: string;
  color: string;
  life: number;
  poison: number;
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

function createPlayers(startingLife: number): Player[] {
  return seats.map((seat, index) => ({
    id: `player-${index + 1}`,
    seat,
    name: `Player ${index + 1}`,
    commander: "",
    deck: "",
    color: colorOptions[index].value,
    life: startingLife,
    poison: 0,
  }));
}

export function LifeCounter() {
  const [startingLife, setStartingLife] = useState(40);
  const [playerCount, setPlayerCount] = useState(4);
  const [players, setPlayers] = useState<Player[]>(() =>
    createPlayers(startingLife),
  );

  const visiblePlayers = useMemo(
    () => players.slice(0, playerCount),
    [playerCount, players],
  );

  function updatePlayer(id: string, patch: Partial<Player>) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, ...patch } : player,
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

  function applyStartingLife(value: string) {
    const nextStartingLife = Number(value);
    setStartingLife(nextStartingLife);
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        life: nextStartingLife,
        poison: 0,
      })),
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm lg:grid-cols-[1fr_auto_auto] lg:items-center">
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
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {visiblePlayers.map((player) => (
          <article
            className="grid min-h-[30rem] grid-rows-[auto_auto_1fr_auto] rounded-panel border border-border bg-surface p-3 shadow-sm"
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
              <FormField label="Commander">
                <input
                  className={fieldControlClassName}
                  onChange={(event) =>
                    updatePlayer(player.id, { commander: event.target.value })
                  }
                  placeholder="Commander"
                  value={player.commander}
                />
              </FormField>
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

            <div className="grid place-items-center py-4">
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
                  onClick={() =>
                    updatePlayer(player.id, { life: startingLife, poison: 0 })
                  }
                  variant="secondary"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
