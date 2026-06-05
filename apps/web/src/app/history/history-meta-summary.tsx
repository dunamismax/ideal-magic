import {
  BarChart3,
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
          label="Participation"
          value={summary.distinctKnownPlayers}
          detail={`${summary.guestSeatCount} guest seats`}
        />
        <MetricCard
          icon={Layers3}
          label="Deck snapshots"
          value={summary.distinctDeckSnapshots}
          detail={`${summary.distinctCommanderSnapshots} commanders`}
        />
        <MetricCard
          icon={Repeat2}
          label="Repeat pairs"
          value={summary.repeatPlayerPairCount + summary.repeatDeckPairCount}
          detail={`${summary.repeatPlayerPairCount} player / ${summary.repeatDeckPairCount} deck`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
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

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
      {value}
    </span>
  );
}
