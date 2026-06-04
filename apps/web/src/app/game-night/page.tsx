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
import { listUpcomingEventsForViewer } from "@/db/queries/event-planning";
import { listPlaygroupsForViewer } from "@/db/queries/playgroups";
import {
  canManageEvent,
  type EventVisibility,
  type PlaygroupRole,
} from "@/db/scopes";
import { requireServerSession } from "@/features/auth/server";
import { CreateEventForm } from "./create-event-form";

export const dynamic = "force-dynamic";

export default async function GameNightPage() {
  const session = await requireServerSession("/game-night");
  const db = createDatabase();
  const [groups, upcomingEvents] = await Promise.all([
    listPlaygroupsForViewer(db, {
      viewerUserId: session.user.id,
    }),
    listUpcomingEventsForViewer(db, {
      viewerUserId: session.user.id,
      page: {
        pageSize: 8,
      },
    }),
  ]);
  const eventCreatableGroups = groups
    .filter((group) => canManageEvent(group.role))
    .map((group) => ({
      id: group.id,
      name: group.name,
    }));
  const nextEvent = upcomingEvents[0] ?? null;

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
              value={String(upcomingEvents.length)}
            />
            <Panel
              icon={UsersRound}
              title="Hostable Groups"
              value={String(eventCreatableGroups.length)}
            />
            <Panel icon={Clock3} title="RSVPs" value="Pending" />
          </div>
        </section>

        <section className="grid gap-4">
          {upcomingEvents.length > 0 ? (
            <div className="grid gap-3">
              {upcomingEvents.map((event) => (
                <EventCard event={event} key={event.id} />
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

function EventCard({
  event,
}: {
  event: {
    id: string;
    title: string;
    startsAt: Date;
    visibility: EventVisibility;
    playgroup: {
      name: string;
      slug: string;
    };
    viewerRole: PlaygroupRole | null;
  };
}) {
  return (
    <article className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold">{event.title}</h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            {event.playgroup.name} - {formatEventDate(event.startsAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={formatVisibility(event.visibility)} />
          {event.viewerRole ? <Badge value={event.viewerRole} /> : null}
        </div>
      </div>
    </article>
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

function formatVisibility(visibility: EventVisibility) {
  switch (visibility) {
    case "invite_only":
      return "Invite Only";
    case "public_safe":
      return "Public Safe";
    default:
      return "Members";
  }
}
