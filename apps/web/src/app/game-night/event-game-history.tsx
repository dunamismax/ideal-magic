import Link from "next/link";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LoggedGameHistorySummary } from "@/db/queries/games";

export function EventGameHistory({
  games,
}: {
  games: LoggedGameHistorySummary[];
}) {
  return (
    <section className="grid gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase text-foreground">
          <Trophy className="size-4 text-accent" aria-hidden="true" />
          Event History
        </h3>
        <Badge value={`${games.length} logged`} />
      </div>

      {games.length === 0 ? (
        <p className="rounded-control bg-background px-3 py-2 text-sm font-semibold text-muted">
          No logged games for this event yet.
        </p>
      ) : (
        <div className="grid gap-2">
          {games.map((game) => (
            <article
              className="rounded-control border border-border bg-background p-3"
              key={game.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-sm font-black">
                    {formatResultType(game.resultType)}
                  </h4>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    {formatGameDate(game.completedAt)}
                    {game.pod ? ` - ${game.pod.name}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {game.winners.length > 0 ? (
                    <Badge
                      value={`${game.winners.length === 1 ? "Winner" : "Winners"}: ${formatWinners(game.winners)}`}
                    />
                  ) : (
                    <Badge value="No winners" />
                  )}
                  <Button asChild size="sm">
                    <Link href={`/history/${game.id}`}>View game</Link>
                  </Button>
                </div>
              </div>

              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {game.players.map((player) => (
                  <li
                    className="rounded-control border border-border/70 bg-surface px-3 py-2"
                    key={player.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">
                          {player.participantName}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-muted">
                          Seat {player.seatPosition}
                        </p>
                      </div>
                      {player.isWinner ? <Badge value="Winner" /> : null}
                    </div>
                    {player.deck ? (
                      <div className="mt-2 text-xs font-semibold text-muted">
                        <p className="font-bold text-foreground">
                          {player.deck.deckNameSnapshot}
                        </p>
                        {player.deck.commanderSnapshot.length > 0 ? (
                          <p>{player.deck.commanderSnapshot.join(" / ")}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-muted">
                        No deck snapshot
                      </p>
                    )}
                  </li>
                ))}
              </ol>

              {game.notes ? (
                <p className="mt-3 rounded-control bg-surface px-3 py-2 text-sm font-semibold text-muted">
                  {game.notes}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
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
