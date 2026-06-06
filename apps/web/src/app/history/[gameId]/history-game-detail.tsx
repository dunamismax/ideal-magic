import {
  CalendarDays,
  ClipboardList,
  Trophy,
  type LucideIcon,
  UsersRound,
} from "lucide-react";

import type { LoggedGameHistorySummary } from "@/db/queries/games";
import { GameResultCorrectionForm } from "./game-result-correction-form";

export function HistoryGameDetail({
  canCorrect,
  game,
}: {
  canCorrect?: boolean;
  game: LoggedGameHistorySummary;
}) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel
          icon={UsersRound}
          title="Playgroup"
          value={game.playgroup.name}
        />
        <Panel
          icon={CalendarDays}
          title="Completed"
          value={formatDateTime(game.completedAt)}
        />
        <Panel
          icon={ClipboardList}
          title="Pod"
          value={game.pod?.name ?? "Event-only game"}
        />
        <Panel
          icon={Trophy}
          title="Result"
          value={formatResultType(game.resultType)}
        />
      </section>

      <section className="rounded-panel border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-muted">
              {game.event.title}
            </p>
            <h2 className="mt-1 text-base font-black">Game Details</h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              Event starts {formatDateTime(game.event.startsAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge value={formatResultType(game.resultType)} />
            {game.winners.length > 0 ? (
              <Badge
                value={`${game.winners.length === 1 ? "Winner" : "Winners"}: ${formatWinners(game.winners)}`}
              />
            ) : (
              <Badge value="No winners" />
            )}
          </div>
        </div>

        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {game.players.map((player) => (
            <li
              className="rounded-control border border-border bg-background p-3"
              key={player.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{player.participantName}</p>
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
                <div className="mt-3 grid gap-2 text-xs font-semibold text-muted">
                  <div>
                    <p className="font-bold text-foreground">
                      {player.deck.deckNameSnapshot}
                    </p>
                    {player.deck.commanderSnapshot.length > 0 ? (
                      <p>{player.deck.commanderSnapshot.join(" / ")}</p>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-2">
                    <SnapshotTerm
                      label="Colors"
                      value={player.deck.colorIdentitySnapshot || "None"}
                    />
                    <SnapshotTerm
                      label="Bracket"
                      value={player.deck.bracketSnapshot ?? "None"}
                    />
                    <SnapshotTerm
                      label="Power"
                      value={
                        player.deck.powerEstimateSnapshot
                          ? String(player.deck.powerEstimateSnapshot)
                          : "None"
                      }
                    />
                    <SnapshotTerm
                      label="Archetype"
                      value={player.deck.archetypeSnapshot || "None"}
                    />
                  </dl>
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
            </li>
          ))}
        </ol>

        {game.notes ? (
          <p className="mt-4 rounded-control bg-background p-3 text-sm font-semibold text-muted">
            {game.notes}
          </p>
        ) : null}
      </section>

      {canCorrect ? <GameResultCorrectionForm game={game} /> : null}
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

function Panel({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <Icon className="mb-4 size-5 text-accent" aria-hidden="true" />
      <h2 className="text-xs font-bold uppercase text-muted">{title}</h2>
      <p className="mt-1 text-base font-black">{value}</p>
    </div>
  );
}

function SnapshotTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold uppercase text-muted">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
      {value}
    </span>
  );
}

function formatDateTime(date: Date) {
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
