import Link from "next/link";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { LoggedGameHistorySummary } from "@/db/queries/games";

export function HistoryGameList({
  games,
}: {
  games: LoggedGameHistorySummary[];
}) {
  if (games.length === 0) {
    return <EmptyState icon={Trophy} title="No logged games yet" />;
  }

  return (
    <div className="grid gap-3">
      {games.map((game) => (
        <article
          className="rounded-panel border border-border bg-surface p-4 shadow-sm"
          key={game.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-muted">
                {game.playgroup.name}
              </p>
              <h2 className="mt-1 text-base font-bold">{game.event.title}</h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                {formatGameDate(game.completedAt)}
                {game.pod ? ` - ${game.pod.name}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge value={formatResultType(game.resultType)} />
              {game.winners.length > 0 ? (
                <Badge
                  value={`${game.winners.length === 1 ? "Winner" : "Winners"}: ${formatWinners(game.winners)}`}
                />
              ) : null}
              <Button asChild size="sm">
                <Link href={`/history/${game.id}`}>View game</Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {game.players.map((player) => (
              <div
                className="rounded-control border border-border bg-background p-3"
                key={player.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">
                      {player.participantName}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Seat {player.seatPosition}
                      {player.finishPosition
                        ? ` - Finish ${player.finishPosition}`
                        : ""}
                    </p>
                  </div>
                  {player.isWinner ? <Badge value="Winner" /> : null}
                </div>
                {player.deck ? (
                  <div className="mt-3 text-xs font-semibold text-muted">
                    <p className="font-bold text-foreground">
                      {player.deck.deckNameSnapshot}
                    </p>
                    {player.deck.commanderSnapshot.length > 0 ? (
                      <p>{player.deck.commanderSnapshot.join(", ")}</p>
                    ) : null}
                    <p className="mt-1">{formatDeckMetadata(player.deck)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-muted">
                    No deck snapshot
                  </p>
                )}
                {formatOutcomeDetail(player) ? (
                  <p className="mt-3 text-xs font-semibold text-muted">
                    {formatOutcomeDetail(player)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {game.notes ? (
            <p className="mt-4 rounded-control bg-background p-3 text-sm font-semibold text-muted">
              {game.notes}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function formatOutcomeDetail(
  player: LoggedGameHistorySummary["players"][number],
) {
  const details = [
    player.eliminationOrder ? `Elim ${player.eliminationOrder}` : null,
    player.eliminatedTurn ? `Turn ${player.eliminatedTurn}` : null,
    player.lossReason ? formatLossReason(player.lossReason) : null,
    player.poisonCounters ? `${player.poisonCounters} poison` : null,
    player.commanderDamageAmount
      ? `${player.commanderDamageAmount} commander from ${player.commanderDamageSource || "unknown"}`
      : null,
    player.lossDetail || null,
  ].filter((detail) => detail !== null);

  return details.join(" - ");
}

function formatLossReason(
  lossReason: NonNullable<
    LoggedGameHistorySummary["players"][number]["lossReason"]
  >,
) {
  switch (lossReason) {
    case "combat_damage":
      return "Combat loss";
    case "commander_damage":
      return "Commander loss";
    case "poison":
      return "Poison loss";
    case "combo":
      return "Combo loss";
    case "concession":
      return "Concession";
    case "decked":
      return "Decked";
    case "life_total":
      return "Life total";
    case "other":
      return "Other loss";
    case "unknown":
      return "Unknown loss";
  }
}

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
      {value}
    </span>
  );
}

function formatGameDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatResultType(resultType: LoggedGameHistorySummary["resultType"]) {
  switch (resultType) {
    case "combo_win":
      return "Combo Win";
    case "combat_win":
      return "Combat Win";
    case "concession":
      return "Concession";
    case "draw":
      return "Draw";
    case "time_called":
      return "Time Called";
    case "unfinished":
      return "Unfinished";
    case "archenemy_win":
      return "Archenemy Win";
    case "team_win":
      return "Team Win";
    default:
      return "Normal Win";
  }
}

function formatWinners(winners: LoggedGameHistorySummary["winners"]) {
  return winners.map((winner) => winner.participantName).join(", ");
}

function formatDeckMetadata(
  deck: NonNullable<LoggedGameHistorySummary["players"][number]["deck"]>,
) {
  const details = [
    deck.colorIdentitySnapshot ? `Colors ${deck.colorIdentitySnapshot}` : null,
    deck.bracketSnapshot ? `Bracket ${deck.bracketSnapshot}` : null,
    deck.powerEstimateSnapshot ? `Power ${deck.powerEstimateSnapshot}` : null,
    deck.archetypeSnapshot || null,
  ].filter((detail) => detail !== null);

  return details.join(" - ");
}
