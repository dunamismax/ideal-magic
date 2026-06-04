import {
  CalendarDays,
  CircleAlert,
  Clock3,
  MapPin,
  type LucideIcon,
  UsersRound,
} from "lucide-react";

import { PageFrame } from "@/components/page-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { requireServerSession } from "@/features/auth/server";

export const dynamic = "force-dynamic";

const rsvps = [
  ["Nora", "Yes", "Muldrotha", "7:00 PM"],
  ["Theo", "Maybe", "Alela", "Waiting"],
  ["Mara", "Yes", "Isshin", "7:10 PM"],
  ["Sol", "Yes", "Etali", "7:00 PM"],
];

const pods = [
  ["Pod 1", "Nora, Mara, Sol, Guest A", "Ready"],
  ["Pod 2", "Theo, Rowan, Jules", "Needs RSVP"],
];

export default async function GameNightPage() {
  await requireServerSession("/game-night");

  return (
    <PageFrame eyebrow="Host planning" title="Game Night">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Panel
              icon={CalendarDays}
              title="Next Event"
              value="Tonight, 7:00 PM"
            />
            <Panel icon={UsersRound} title="RSVPs" value="7 yes, 2 maybe" />
            <Panel icon={MapPin} title="Host" value="Address scoped" />
            <Panel icon={Clock3} title="Late Notes" value="1 player" />
          </div>
        </section>

        <section className="grid gap-4">
          <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-bold">RSVP queue</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Deck</th>
                    <th className="px-4 py-2">Arrival</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rsvps.map(([player, status, deck, arrival]) => (
                    <tr key={player}>
                      <td className="px-4 py-3 font-bold">{player}</td>
                      <td className="px-4 py-3">{status}</td>
                      <td className="px-4 py-3">{deck}</td>
                      <td className="px-4 py-3">{arrival}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {pods.map(([pod, players, status]) => (
              <article
                className="rounded-panel border border-border bg-surface p-4 shadow-sm"
                key={pod}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">{pod}</h2>
                    <p className="mt-1 text-sm font-medium text-muted">
                      {players}
                    </p>
                  </div>
                  <span className="rounded-control border border-border bg-background px-2 py-1 text-xs font-bold">
                    {status}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <EmptyState icon={CircleAlert} title="No published pods" />
        </section>
      </div>
    </PageFrame>
  );
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
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
