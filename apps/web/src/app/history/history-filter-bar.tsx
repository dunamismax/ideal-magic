import Link from "next/link";
import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HistoryFilterOptions } from "@/db/queries/games";

export function HistoryFilterBar({
  options,
  selectedEventId,
  selectedPlaygroupId,
}: {
  options: HistoryFilterOptions;
  selectedEventId?: string;
  selectedPlaygroupId?: string;
}) {
  const eventOptions = selectedPlaygroupId
    ? options.events.filter(
        (event) => event.playgroupId === selectedPlaygroupId,
      )
    : options.events;
  const hasActiveFilter = Boolean(selectedPlaygroupId || selectedEventId);

  return (
    <form
      action="/history"
      className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-sm"
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="grid min-w-0 gap-1 text-sm font-bold text-foreground">
          <span className="text-xs font-black uppercase text-muted">
            Playgroup
          </span>
          <select
            className="h-10 min-w-0 w-full rounded-control border border-border bg-background px-3 text-sm font-semibold"
            defaultValue={selectedPlaygroupId ?? ""}
            name="playgroupId"
          >
            <option value="">All playgroups</option>
            {options.playgroups.map((playgroup) => (
              <option key={playgroup.id} value={playgroup.id}>
                {playgroup.name} ({playgroup.loggedGameCount})
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-1 text-sm font-bold text-foreground">
          <span className="text-xs font-black uppercase text-muted">Event</span>
          <select
            className="h-10 min-w-0 w-full rounded-control border border-border bg-background px-3 text-sm font-semibold"
            defaultValue={selectedEventId ?? ""}
            name="eventId"
          >
            <option value="">All events</option>
            {eventOptions.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} - {event.playgroupName} ({event.loggedGameCount})
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="submit" variant="primary">
            <Filter className="size-4" aria-hidden />
            Apply
          </Button>
          {hasActiveFilter ? (
            <Button asChild size="sm">
              <Link href="/history">
                <RotateCcw className="size-4" aria-hidden />
                Reset
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
