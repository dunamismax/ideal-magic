import {
  BarChart3,
  CalendarDays,
  Layers3,
  type LucideIcon,
  Repeat2,
  ShieldCheck,
  Swords,
  UsersRound,
} from "lucide-react";

import type { MetaHealthSummary } from "@/db/queries/games";

export function HistoryMetaSummary({
  summary,
}: {
  summary: MetaHealthSummary;
}) {
  if (summary.totalLoggedGames === 0) {
    return (
      <section className="rounded-panel border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-accent" aria-hidden />
          <div>
            <h2 className="text-sm font-black uppercase text-foreground">
              Meta Health
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              No scoped game records are available yet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase text-foreground">
          <ShieldCheck className="size-4 text-accent" aria-hidden />
          Meta Health
        </h2>
        <Badge value={`${summary.totalLoggedGames} logged`} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Swords}
          label="Games"
          value={summary.totalLoggedGames}
          detail={`${summary.eventsWithGames} events with games`}
        />
        <MetricCard
          icon={UsersRound}
          label="Attendance"
          value={summary.totalSeats}
          detail={`${summary.averagePlayersPerGame} avg seats/game`}
        />
        <MetricCard
          icon={Layers3}
          label="Variety"
          value={summary.distinctDeckSnapshots}
          detail={`${summary.distinctCommanderSnapshots} commanders / ${summary.distinctKnownPlayers} players`}
        />
        <MetricCard
          icon={Repeat2}
          label="Freshness"
          value={summary.freshPlayerPairCount}
          detail={`${summary.repeatPlayerPairRate}% repeated player pairs`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PodSizePanel summary={summary} />
        <SpreadPanel
          title="Color spread"
          items={summary.colorIdentitySpread}
          emptyLabel="No color snapshots yet"
        />
        <SpreadPanel
          title="Archetype spread"
          items={summary.archetypeSpread}
          emptyLabel="No archetype snapshots yet"
        />
        <PairPanel
          title="Player repeats"
          pairs={summary.topRepeatPlayerPairs}
          emptyLabel="No repeat player pairs yet"
        />
        <PairPanel
          title="Deck repeats"
          pairs={summary.topRepeatDeckPairs}
          emptyLabel="No repeat deck pairs yet"
        />
        <EventTrendPanel events={summary.eventParticipationTrend} />
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <Icon className="mb-4 size-5 text-accent" aria-hidden />
      <h3 className="text-xs font-bold uppercase text-muted">{label}</h3>
      <p className="mt-1 text-2xl font-black leading-none">{value}</p>
      <p className="mt-2 text-xs font-semibold text-muted">{detail}</p>
    </div>
  );
}

function PodSizePanel({ summary }: { summary: MetaHealthSummary }) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase text-muted">
        <UsersRound className="size-4 text-accent" aria-hidden />
        Pod-size quality
      </h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Four-player" value={summary.fourPlayerGameCount} />
        <MiniMetric label="Small" value={summary.undersizedGameCount} />
        <MiniMetric label="Large" value={summary.oversizedGameCount} />
      </div>
      {summary.podSizeSpread.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {summary.podSizeSpread.map((item) => (
            <li
              className="flex items-center justify-between gap-3 rounded-control bg-background px-3 py-2"
              key={item.label}
            >
              <span className="text-sm font-bold">{item.label}</span>
              <Badge value={`${item.count} games`} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function SpreadPanel({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: MetaHealthSummary["colorIdentitySpread"];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase text-muted">
        <BarChart3 className="size-4 text-accent" aria-hidden />
        {title}
      </h3>
      {items.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {items.slice(0, 5).map((item) => (
            <li
              className="flex items-center justify-between gap-3 rounded-control bg-background px-3 py-2"
              key={item.label}
            >
              <span className="text-sm font-bold">{item.label}</span>
              <Badge value={String(item.count)} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-control bg-background px-3 py-2 text-sm font-semibold text-muted">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

function PairPanel({
  title,
  pairs,
  emptyLabel,
}: {
  title: string;
  pairs: MetaHealthSummary["topRepeatPlayerPairs"];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase text-muted">
        <Repeat2 className="size-4 text-accent" aria-hidden />
        {title}
      </h3>
      {pairs.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {pairs.map((pair) => (
            <li
              className="flex items-center justify-between gap-3 rounded-control bg-background px-3 py-2"
              key={`${pair.leftLabel}-${pair.rightLabel}`}
            >
              <span className="text-sm font-bold">
                {pair.leftLabel} / {pair.rightLabel}
              </span>
              <Badge value={`${pair.gameCount} games`} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-control bg-background px-3 py-2 text-sm font-semibold text-muted">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

function EventTrendPanel({
  events,
}: {
  events: MetaHealthSummary["eventParticipationTrend"];
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase text-muted">
        <CalendarDays className="size-4 text-accent" aria-hidden />
        Event participation
      </h3>
      {events.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {events.map((event) => (
            <li
              className="rounded-control bg-background p-3"
              key={event.eventId}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{event.eventTitle}</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {formatEventDate(event.startsAt)}
                  </p>
                </div>
                <Badge value={`${event.loggedGames} games`} />
              </div>
              <p className="mt-2 text-xs font-semibold text-muted">
                {event.totalSeats} seats - {event.knownPlayers} players -{" "}
                {event.guestSeats} guests - {event.deckSnapshots} decks
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-control bg-background px-3 py-2 text-sm font-semibold text-muted">
          No event participation yet
        </p>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control bg-background p-3">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-1 text-xl font-black leading-none">{value}</p>
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

function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
