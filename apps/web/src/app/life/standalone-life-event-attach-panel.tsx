import { CalendarPlus, LogIn, Trophy } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export type StandaloneLifeAttachEvent = {
  id: string;
  title: string;
  startsAt: Date;
  playgroupName: string;
  participantCount: number;
};

type StandaloneLifeEventAttachPanelProps = {
  events: readonly StandaloneLifeAttachEvent[];
  isAuthenticated: boolean;
  loginHref: string;
  selectedEventId: string | null;
  selectedEventBlocked?: string | null;
};

export function StandaloneLifeEventAttachPanel({
  events,
  isAuthenticated,
  loginHref,
  selectedEventId,
  selectedEventBlocked = null,
}: StandaloneLifeEventAttachPanelProps) {
  return (
    <section className="mt-4 grid gap-3 rounded-panel border border-border bg-surface p-3 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <CalendarPlus className="size-4 text-accent" aria-hidden="true" />
            Attach Event
          </h2>
          <p className="text-sm font-semibold text-muted">
            Import an eligible event roster before saving a local game to group
            history.
          </p>
        </div>

        {isAuthenticated ? (
          <form
            action="/life"
            className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto]"
          >
            <select
              aria-label="Event to attach to this life counter"
              className="h-10 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
              defaultValue={selectedEventId ?? ""}
              disabled={events.length === 0}
              name="eventId"
            >
              <option value="">
                {events.length > 0 ? "Choose event" : "No eligible events"}
              </option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} - {event.playgroupName} -{" "}
                  {formatAttachEventDate(event.startsAt)} -{" "}
                  {event.participantCount} players
                </option>
              ))}
            </select>
            <Button disabled={events.length === 0} type="submit" variant="primary">
              <Trophy className="size-4" aria-hidden="true" />
              Import Roster
            </Button>
          </form>
        ) : (
          <Button asChild variant="primary">
            <Link href={loginHref}>
              <LogIn className="size-4" aria-hidden="true" />
              Sign In To Attach
            </Link>
          </Button>
        )}
      </div>

      {selectedEventBlocked ? (
        <p className="text-xs font-bold text-danger" role="status">
          {selectedEventBlocked}
        </p>
      ) : null}
    </section>
  );
}

function formatAttachEventDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
