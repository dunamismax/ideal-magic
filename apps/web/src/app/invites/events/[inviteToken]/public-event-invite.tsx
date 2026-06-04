import {
  CalendarDays,
  Clock3,
  LibraryBig,
  MapPin,
  Swords,
  UsersRound,
} from "lucide-react";

import type { PublicEventInviteView } from "@/features/events/public-event";
import { getPublicRsvpRows } from "@/features/events/public-event";

export function PublicEventInvite({ event }: { event: PublicEventInviteView }) {
  return (
    <div className="grid gap-4">
      <section className="rounded-panel border border-border bg-surface p-4 shadow-sm">
        <p className="text-xs font-bold uppercase text-muted">
          {event.playgroupName}
        </p>
        <h2 className="mt-1 text-2xl font-black leading-tight">
          {event.title}
        </h2>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Metric icon={CalendarDays} label="Date" value={event.dateLabel} />
          <Metric icon={Clock3} label="Time" value={event.timeLabel} />
          <Metric
            icon={MapPin}
            label="Location"
            value={event.locationName ?? "Location shared by host"}
          />
          <Metric
            icon={UsersRound}
            label="Expected"
            value={`${event.expectedPlayers} players`}
          />
        </section>

        <section className="grid gap-4">
          <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-bold">RSVP status</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Responses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {getPublicRsvpRows(event).map((row) => (
                    <tr key={row.status}>
                      <td className="px-4 py-3 font-bold">{row.label}</td>
                      <td className="px-4 py-3">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              icon={UsersRound}
              label="Guest RSVPs"
              value={event.guestRsvps}
            />
            <Stat
              icon={LibraryBig}
              label="Decks Declared"
              value={event.deckDeclarations}
            />
            <Stat icon={Swords} label="Pods" value={event.pods} />
          </div>

          <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase text-muted">Scope</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-muted">
              This invite view shows event timing, public location name, and
              aggregate planning counts.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <Icon className="mb-4 size-5 text-accent" aria-hidden="true" />
      <h2 className="text-xs font-bold uppercase text-muted">{label}</h2>
      <p className="mt-1 text-lg font-black leading-tight">{value}</p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <Icon className="mb-3 size-5 text-accent" aria-hidden="true" />
      <h2 className="text-xs font-bold uppercase text-muted">{label}</h2>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
