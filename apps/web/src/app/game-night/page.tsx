import {
  CalendarDays,
  CircleAlert,
  Clock3,
  type LucideIcon,
  UsersRound,
} from "lucide-react";

import { PageFrame } from "@/components/page-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { createDatabase } from "@/db/client";
import {
  listDecksForOwner,
  listEventDeckDeclarationsForViewer,
  type EventDeckDeclaration,
  type ViewerDeck,
} from "@/db/queries/decks";
import {
  type EventPlanningSummary,
  getScopedEventPlanningSummary,
  listUpcomingEventsForViewer,
} from "@/db/queries/event-planning";
import {
  listPodsForEventViewer,
  type EventPodSummary,
} from "@/db/queries/pods";
import { listPlaygroupsForViewer } from "@/db/queries/playgroups";
import { canManageEvent } from "@/db/scopes";
import { requireServerSession } from "@/features/auth/server";
import { CreateEventForm } from "./create-event-form";
import { EventDeckDeclarationForm } from "./event-deck-declaration-form";
import { EventManagementForm } from "./event-management-form";
import { EventPodsPanel } from "./event-pods-panel";
import { MemberRsvpForm } from "./member-rsvp-form";

export const dynamic = "force-dynamic";

export default async function GameNightPage() {
  const session = await requireServerSession("/game-night");
  const db = createDatabase();
  const [groups, upcomingEvents, decks] = await Promise.all([
    listPlaygroupsForViewer(db, {
      viewerUserId: session.user.id,
    }),
    listUpcomingEventsForViewer(db, {
      viewerUserId: session.user.id,
      page: {
        pageSize: 8,
      },
    }),
    listDecksForOwner(db, {
      ownerUserId: session.user.id,
    }),
  ]);
  const eventSummaries = (
    await Promise.all(
      upcomingEvents.map((event) =>
        getScopedEventPlanningSummary(db, {
          eventId: event.id,
          viewerUserId: session.user.id,
        }),
      ),
    )
  ).filter((event) => event !== null);
  const declarationEntries = await Promise.all(
    eventSummaries.map(async (event) => [
      event.id,
      await listEventDeckDeclarationsForViewer(db, {
        eventId: event.id,
        viewerUserId: session.user.id,
      }),
    ]),
  );
  const podEntries = await Promise.all(
    eventSummaries.map(async (event) => [
      event.id,
      await listPodsForEventViewer(db, {
        eventId: event.id,
        viewerUserId: session.user.id,
      }),
    ]),
  );
  const declarationsByEventId = new Map(
    declarationEntries as [string, EventDeckDeclaration[]][],
  );
  const podsByEventId = new Map(podEntries as [string, EventPodSummary[]][]);
  const eventCreatableGroups = groups
    .filter((group) => canManageEvent(group.role))
    .map((group) => ({
      id: group.id,
      name: group.name,
    }));
  const nextEvent = eventSummaries[0] ?? null;
  const rsvpTotal = eventSummaries.reduce(
    (total, event) => total + countRsvps(event.counts.rsvps),
    0,
  );

  return (
    <PageFrame eyebrow="Host planning" title="Game Night">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="grid gap-3">
          <CreateEventForm playgroups={eventCreatableGroups} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Panel
              icon={CalendarDays}
              title="Next Event"
              value={nextEvent ? formatEventDate(nextEvent.startsAt) : "None"}
            />
            <Panel
              icon={CalendarDays}
              title="Upcoming Events"
              value={String(eventSummaries.length)}
            />
            <Panel
              icon={UsersRound}
              title="Hostable Groups"
              value={String(eventCreatableGroups.length)}
            />
            <Panel
              icon={Clock3}
              title="Member RSVPs"
              value={String(rsvpTotal)}
            />
          </div>
        </section>

        <section className="grid gap-4">
          {eventSummaries.length > 0 ? (
            <div className="grid gap-3">
              {eventSummaries.map((event) => (
                <EventCard
                  decks={decks}
                  declarations={declarationsByEventId.get(event.id) ?? []}
                  event={event}
                  key={event.id}
                  pods={podsByEventId.get(event.id) ?? []}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={CircleAlert} title="No scheduled events" />
          )}
        </section>
      </div>
    </PageFrame>
  );
}

export function EventCard({
  event,
  decks = [],
  declarations = [],
  pods = [],
}: {
  event: EventPlanningSummary;
  decks?: ViewerDeck[];
  declarations?: EventDeckDeclaration[];
  pods?: EventPodSummary[];
}) {
  return (
    <article className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold">{event.title}</h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              {event.playgroup.name} - {formatEventDate(event.startsAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge value={formatVisibility(event.visibility)} />
            <Badge value={formatEventStatus(event.status)} />
            {event.viewer.role ? <Badge value={event.viewer.role} /> : null}
            {event.viewer.rsvpStatus ? (
              <Badge
                value={`RSVP: ${formatRsvpStatus(event.viewer.rsvpStatus)}`}
              />
            ) : null}
          </div>
        </div>

        {event.status === "cancelled" ? (
          <div className="rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
            Cancelled
            {event.cancelledAt ? ` ${formatEventDate(event.cancelledAt)}` : ""}
          </div>
        ) : null}

        <div className="grid gap-2 text-sm font-semibold text-muted sm:grid-cols-4">
          <RsvpCount label="Yes" value={event.counts.rsvps.yes} />
          <RsvpCount label="Maybe" value={event.counts.rsvps.maybe} />
          <RsvpCount label="No" value={event.counts.rsvps.no} />
          <RsvpCount label="Waitlist" value={event.counts.rsvps.waitlist} />
        </div>

        {event.viewer.canRsvp ? (
          <EventDeckDeclarationForm
            declarations={declarations}
            decks={decks}
            eventId={event.id}
          />
        ) : null}

        {event.viewer.canRsvp ? (
          <MemberRsvpForm
            eventId={event.id}
            initialArrivalTime={event.viewer.rsvpArrivalTime}
            initialLeavingTime={event.viewer.rsvpLeavingTime}
            initialStatus={event.viewer.rsvpStatus}
          />
        ) : (
          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-muted">
              Member RSVP is unavailable for your group role.
            </p>
          </div>
        )}

        {event.viewer.canRsvp || event.viewer.canManageEvent ? (
          <EventPodsPanel
            canManageEvent={event.viewer.canManageEvent}
            eventId={event.id}
            pods={pods}
          />
        ) : null}

        {event.viewer.canManageEvent ? (
          <EventManagementForm event={event} />
        ) : null}
      </div>
    </article>
  );
}

function RsvpCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control bg-background px-3 py-2">
      <span className="block text-xs font-bold uppercase text-muted">
        {label}
      </span>
      <span className="text-lg font-black text-foreground">{value}</span>
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

function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatVisibility(visibility: EventPlanningSummary["visibility"]) {
  switch (visibility) {
    case "invite_only":
      return "Invite Only";
    case "public_safe":
      return "Public Safe";
    default:
      return "Members";
  }
}

function formatRsvpStatus(
  status: EventPlanningSummary["viewer"]["rsvpStatus"],
) {
  switch (status) {
    case "yes":
      return "Yes";
    case "maybe":
      return "Maybe";
    case "no":
      return "No";
    case "waitlist":
      return "Waitlist";
    default:
      return "None";
  }
}

function formatEventStatus(status: EventPlanningSummary["status"]) {
  switch (status) {
    case "cancelled":
      return "Cancelled";
    case "archived":
      return "Archived";
    default:
      return "Scheduled";
  }
}

function countRsvps(rsvps: EventPlanningSummary["counts"]["rsvps"]) {
  return rsvps.yes + rsvps.maybe + rsvps.no + rsvps.waitlist;
}
