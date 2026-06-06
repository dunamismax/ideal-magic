import {
  Clock,
  Crown,
  Flag,
  Flame,
  Gem,
  Skull,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";

import type { LifeCounterSession, Player } from "@/features/life/session";
import { cn } from "@/lib/utils";

export function LifeTableView({
  session,
  syncedAt,
}: {
  session: LifeCounterSession;
  syncedAt: string;
}) {
  const players = getVisiblePlayers(session);
  const activePlayer =
    players.find((player) => player.id === session.activePlayerId) ??
    players[0] ??
    null;
  const monarchPlayer = players.find(
    (player) => player.id === session.monarchPlayerId,
  );
  const initiativePlayer = players.find(
    (player) => player.id === session.initiativePlayerId,
  );

  return (
    <section
      aria-label="Read-only life table"
      className="grid gap-3"
      data-testid="linked-life-table-view"
    >
      <div className="grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
        <Metric
          icon={<Clock className="size-4" aria-hidden="true" />}
          label="Game"
          value={formatDuration(session.gameElapsedSeconds)}
        />
        <Metric
          icon={<Clock className="size-4" aria-hidden="true" />}
          label="Turn"
          value={formatDuration(session.turnElapsedSeconds)}
        />
        <div className="grid gap-1 rounded-control border border-border bg-background p-3">
          <p className="text-xs font-bold uppercase text-muted">Active turn</p>
          <p className="text-xl font-black">{activePlayer?.name ?? "Table"}</p>
        </div>
        <div className="grid gap-1 rounded-control border border-border bg-background p-3">
          <p className="text-xs font-bold uppercase text-muted">Synced</p>
          <p className="text-sm font-bold">{formatSyncedAt(syncedAt)}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-wrap gap-2">
          <Badge>
            <Crown className="size-4 text-player-d" aria-hidden="true" />
            {monarchPlayer ? `${monarchPlayer.name} monarch` : "No monarch"}
          </Badge>
          <Badge>
            <Flag className="size-4 text-accent" aria-hidden="true" />
            {initiativePlayer
              ? `${initiativePlayer.name} initiative`
              : "No initiative"}
          </Badge>
          <Badge>
            <Flame className="size-4 text-danger" aria-hidden="true" />
            Storm <span className="tabular-nums">{session.stormCount}</span>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>
            <Sparkles className="size-4 text-player-g" aria-hidden="true" />
            {session.dayNight === "unset"
              ? "Day/night unset"
              : session.dayNight}
          </Badge>
          <Badge>{tableResultLabel(session.gameResult)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {players.map((player) => {
          const commanderDamage = getCommanderDamageForPlayer(player, players);

          return (
            <article
              aria-label={`${player.name}, ${playerStatusLabel(player.status)}, ${player.life} life, ${player.poison} poison`}
              className={cn(
                "grid min-h-[24rem] gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm",
                player.id === session.activePlayerId && "ring-2 ring-focus",
                player.status === "eliminated" && "opacity-75",
              )}
              data-testid="linked-life-table-player"
              key={player.id}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">
                    Seat {player.seat}
                  </p>
                  <h2 className="truncate text-xl font-black">{player.name}</h2>
                  {player.deck.trim() ? (
                    <p className="truncate text-sm font-semibold text-muted">
                      {player.deck}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "size-5 shrink-0 rounded-full border border-black/10",
                    playerColorClassName(player.color),
                  )}
                  aria-hidden="true"
                />
              </header>

              <div className="text-center">
                <p className="text-xs font-bold uppercase text-muted">Life</p>
                <p className="tabular-nums text-7xl font-black leading-none">
                  {player.life}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-control border border-border bg-background px-3 py-1 text-sm font-bold">
                  <Skull className="size-4 text-danger" aria-hidden="true" />
                  <span className="tabular-nums">{player.poison}</span>
                  <span className="text-muted">poison</span>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase text-muted">
                  Commanders
                </p>
                {player.commanders.map((commander) => (
                  <div
                    className="rounded-control border border-border bg-background p-2"
                    key={commander.id}
                  >
                    <p className="font-bold">
                      {commander.name.trim() || "Commander"}
                    </p>
                    <p className="text-xs font-semibold text-muted">
                      Casts {commander.castCount}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase text-muted">
                  Counters
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm font-bold">
                  <Counter label="XP" value={player.experience} />
                  <Counter label="Energy" value={player.energy} />
                  <Counter label="Rad" value={player.rad} />
                  <Counter label="Treasure" value={player.treasure} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {player.status !== "active" ? (
                    <Badge>
                      {player.status === "winner" ? (
                        <Trophy
                          className="size-4 text-accent"
                          aria-hidden="true"
                        />
                      ) : (
                        <Skull
                          className="size-4 text-danger"
                          aria-hidden="true"
                        />
                      )}
                      {playerStatusLabel(player.status)}
                    </Badge>
                  ) : null}
                  {player.cityBlessing ? (
                    <Badge>
                      <Gem
                        className="size-4 text-player-e"
                        aria-hidden="true"
                      />
                      {"City's blessing"}
                    </Badge>
                  ) : null}
                  {player.id === session.monarchPlayerId ? (
                    <Badge>Monarch</Badge>
                  ) : null}
                  {player.id === session.initiativePlayerId ? (
                    <Badge>Initiative</Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-muted">
                  <Swords className="size-4" aria-hidden="true" />
                  Commander damage
                </p>
                {commanderDamage.length > 0 ? (
                  <div className="grid gap-1">
                    {commanderDamage.map((damage) => (
                      <span
                        className="flex items-center justify-between gap-2 rounded-control border border-border bg-background px-2 py-1 text-sm font-bold"
                        key={damage.sourceId}
                      >
                        <span className="truncate">{damage.sourceName}</span>
                        <span className="tabular-nums">{damage.damage}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-control border border-border bg-background px-2 py-1 text-sm font-semibold text-muted">
                    None
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function LifeTableEmptyState({ label }: { label: string }) {
  return (
    <section
      className="rounded-panel border border-border bg-surface p-6 text-center shadow-sm"
      data-testid="linked-life-table-empty"
    >
      <p className="text-sm font-bold uppercase text-muted">No synced table</p>
      <h2 className="mt-2 text-2xl font-black">{label}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-muted">
        Open the linked life counter and let it sync before using the read-only
        table view.
      </p>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 rounded-control border border-border bg-background p-3">
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-muted">
        {icon}
        {label}
      </p>
      <p className="text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-control border border-border bg-background px-3 py-1 text-sm font-bold">
      {children}
    </span>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center justify-between gap-2 rounded-control border border-border bg-background px-2 py-1">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function getVisiblePlayers(session: LifeCounterSession): Player[] {
  return session.players.slice(0, session.playerCount);
}

function getCommanderDamageForPlayer(player: Player, players: Player[]) {
  return players.flatMap((sourcePlayer) =>
    sourcePlayer.commanders
      .map((commander) => ({
        sourceId: commander.id,
        sourceName: commander.name.trim() || `${sourcePlayer.name}'s Commander`,
        damage: commander.damageByDefender[player.id] ?? 0,
      }))
      .filter((entry) => entry.damage > 0),
  );
}

function playerStatusLabel(status: Player["status"]) {
  if (status === "winner") {
    return "Winner";
  }

  if (status === "eliminated") {
    return "Eliminated";
  }

  return "Active";
}

function tableResultLabel(result: LifeCounterSession["gameResult"]) {
  if (result === "winner") {
    return "Winner marked";
  }

  if (result === "draw") {
    return "Draw";
  }

  if (result === "no-contest") {
    return "No contest";
  }

  return "In progress";
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

function formatSyncedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function playerColorClassName(color: string) {
  switch (color) {
    case "player-a":
      return "bg-player-a";
    case "player-b":
      return "bg-player-b";
    case "player-c":
      return "bg-player-c";
    case "player-d":
      return "bg-player-d";
    case "player-e":
      return "bg-player-e";
    case "player-f":
      return "bg-player-f";
    case "player-g":
      return "bg-player-g";
    case "player-h":
      return "bg-player-h";
    default:
      return "bg-muted";
  }
}
