import { redirect } from "next/navigation";

import { LifeCounter } from "@/app/life/life-counter";
import {
  StandaloneLifeEventAttachPanel,
  type StandaloneLifeAttachEvent,
} from "@/app/life/standalone-life-event-attach-panel";
import { PageFrame } from "@/components/page-frame";
import { createDatabase, type AppDatabase } from "@/db/client";
import {
  type EventLifeCounterParticipantSummary,
  type EventPlanningSummary,
  getScopedEventPlanningSummary,
  listEventLifeCounterParticipantsForViewer,
  listUpcomingEventsForViewer,
  type UpcomingEventListItem,
} from "@/db/queries/event-planning";
import { getLinkedLifeCounterSessionForViewer } from "@/db/queries/life-counter";
import { getLoginRedirectPath, getServerSession } from "@/features/auth/server";
import { createEventLifeCounterContextFromParticipants } from "@/features/life/linked-session";
import { EventLifeGameSaveForm } from "../events/[eventId]/life/event-life-game-save-form";
import { saveStandaloneLifeGameAction } from "./actions";
import { LifePwaRegistration } from "./life-pwa-registration";

export const dynamic = "force-dynamic";

type LifePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LifePage({ searchParams }: LifePageProps) {
  const selectedEventId = getSelectedEventId(await searchParams);
  const session = await getServerSession();

  if (selectedEventId && !session) {
    redirect(
      getLoginRedirectPath(
        `/life?eventId=${encodeURIComponent(selectedEventId)}`,
      ),
    );
  }

  const db = session ? createDatabase() : null;
  const attachData =
    db && session
      ? await loadStandaloneAttachData(db, {
          selectedEventId,
          viewerUserId: session.user.id,
        })
      : {
          events: [],
          selectedEvent: null,
          selectedParticipants: [],
          selectedEventBlocked: null,
        };
  const canSaveGame = Boolean(
    attachData.selectedEvent &&
    attachData.selectedEvent.status === "scheduled" &&
    attachData.selectedParticipants.length >= 2,
  );
  const linkedContext =
    attachData.selectedEvent && canSaveGame
      ? createEventLifeCounterContextFromParticipants({
          event: {
            id: attachData.selectedEvent.id,
            title: attachData.selectedEvent.title,
            startsAt: attachData.selectedEvent.startsAt,
          },
          participants: attachData.selectedParticipants,
        })
      : null;
  const serverSnapshot =
    db && session && linkedContext
      ? await getLinkedLifeCounterSessionForViewer(db, {
          viewerUserId: session.user.id,
          kind: "event",
          eventId: linkedContext.eventId,
          localSessionKey: linkedContext.session.id,
        })
      : null;
  const lifeCounterSession =
    serverSnapshot?.session ?? linkedContext?.session ?? undefined;
  const selectedEvent = attachData.selectedEvent;
  const renderSaveGameForm = (mobile = false) =>
    selectedEvent && canSaveGame ? (
      <EventLifeGameSaveForm
        action={saveStandaloneLifeGameAction}
        className={mobile ? "shadow-none" : undefined}
        eventId={selectedEvent.id}
        eventTitle={selectedEvent.title}
        formIdPrefix={mobile ? `${selectedEvent.id}-mobile` : undefined}
        localSessionId={linkedContext?.session.id}
        participants={attachData.selectedParticipants}
      />
    ) : null;

  return (
    <PageFrame
      eyebrow={
        linkedContext
          ? `Standalone attached event - ${attachData.selectedEvent?.playgroup.name}`
          : "Standalone local session"
      }
      title="Life Counter"
      mobileImmersive
    >
      <LifePwaRegistration />
      <LifeCounter
        immersiveMobile
        initialSession={lifeCounterSession}
        linkedSaveEnabled={canSaveGame}
        linkedSessionSync={
          linkedContext
            ? {
                kind: "event",
                eventId: linkedContext.eventId,
                localSessionKey: linkedContext.session.id,
                expectedServerActionSequence:
                  serverSnapshot?.serverActionSequence ?? null,
                expectedServerUpdatedAt:
                  serverSnapshot?.serverUpdatedAt ?? null,
              }
            : undefined
        }
        linkedStatusLabel={linkedContext?.statusLabel}
        mobileExitHref="/"
        mobileMenuContent={
          <>
            <StandaloneLifeEventAttachPanel
              events={attachData.events}
              isAuthenticated={Boolean(session)}
              loginHref={getLoginRedirectPath("/life")}
              selectedEventBlocked={attachData.selectedEventBlocked}
              selectedEventId={selectedEventId}
            />
            {renderSaveGameForm(true)}
          </>
        }
      />
      <div className="hidden md:grid md:gap-4">
        <StandaloneLifeEventAttachPanel
          events={attachData.events}
          isAuthenticated={Boolean(session)}
          loginHref={getLoginRedirectPath("/life")}
          selectedEventBlocked={attachData.selectedEventBlocked}
          selectedEventId={selectedEventId}
        />
        {renderSaveGameForm()}
      </div>
    </PageFrame>
  );
}

async function loadStandaloneAttachData(
  db: Pick<AppDatabase, "select">,
  input: {
    selectedEventId: string | null;
    viewerUserId: string;
  },
): Promise<{
  events: StandaloneLifeAttachEvent[];
  selectedEvent: EventPlanningSummary | null;
  selectedParticipants: EventLifeCounterParticipantSummary[];
  selectedEventBlocked: string | null;
}> {
  const [upcomingEvents, selectedEvent, selectedParticipants] =
    await Promise.all([
      listUpcomingEventsForViewer(db, {
        viewerUserId: input.viewerUserId,
        page: {
          pageSize: 8,
        },
      }),
      input.selectedEventId
        ? getScopedEventPlanningSummary(db, {
            eventId: input.selectedEventId,
            viewerUserId: input.viewerUserId,
          })
        : Promise.resolve(null),
      input.selectedEventId
        ? listEventLifeCounterParticipantsForViewer(db, {
            eventId: input.selectedEventId,
            viewerUserId: input.viewerUserId,
          })
        : Promise.resolve([]),
    ]);
  const attachEvents = await listAttachableEvents(db, {
    upcomingEvents,
    viewerUserId: input.viewerUserId,
  });
  const selectedAttachEvent =
    selectedEvent &&
    selectedEvent.status === "scheduled" &&
    selectedParticipants.length >= 2
      ? {
          id: selectedEvent.id,
          title: selectedEvent.title,
          startsAt: selectedEvent.startsAt,
          playgroupName: selectedEvent.playgroup.name,
          participantCount: selectedParticipants.length,
        }
      : null;
  const events =
    selectedAttachEvent &&
    !attachEvents.some((event) => event.id === selectedAttachEvent.id)
      ? [selectedAttachEvent, ...attachEvents]
      : attachEvents;

  return {
    events,
    selectedEvent,
    selectedParticipants,
    selectedEventBlocked: getSelectedEventBlockedMessage({
      selectedEventId: input.selectedEventId,
      selectedEvent,
      selectedParticipants,
    }),
  };
}

async function listAttachableEvents(
  db: Pick<AppDatabase, "select">,
  input: {
    upcomingEvents: readonly UpcomingEventListItem[];
    viewerUserId: string;
  },
): Promise<StandaloneLifeAttachEvent[]> {
  const scheduledEvents = input.upcomingEvents.filter(
    (event) => event.status === "scheduled",
  );
  const eventEntries = await Promise.all(
    scheduledEvents.map(async (event) => {
      const participants = await listEventLifeCounterParticipantsForViewer(db, {
        eventId: event.id,
        viewerUserId: input.viewerUserId,
      });

      if (participants.length < 2) {
        return null;
      }

      return {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        playgroupName: event.playgroup.name,
        participantCount: participants.length,
      } satisfies StandaloneLifeAttachEvent;
    }),
  );

  return eventEntries.filter((event) => event !== null);
}

function getSelectedEventBlockedMessage(input: {
  selectedEventId: string | null;
  selectedEvent: EventPlanningSummary | null;
  selectedParticipants: readonly EventLifeCounterParticipantSummary[];
}) {
  if (!input.selectedEventId) {
    return null;
  }

  if (!input.selectedEvent) {
    return "That event is not available to this account.";
  }

  if (input.selectedEvent.status !== "scheduled") {
    return "Only scheduled events can be attached to a standalone counter.";
  }

  if (input.selectedParticipants.length < 2) {
    return "An attached event needs at least two yes or maybe RSVPs.";
  }

  return null;
}

function getSelectedEventId(
  searchParams: Record<string, string | string[] | undefined> | undefined,
) {
  const rawEventId = searchParams?.eventId;
  const eventId = Array.isArray(rawEventId) ? rawEventId[0] : rawEventId;
  const normalized = eventId?.trim();

  return normalized ? normalized : null;
}
