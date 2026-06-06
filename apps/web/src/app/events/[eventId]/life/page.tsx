import { notFound } from "next/navigation";

import { LifeCounter } from "@/app/life/life-counter";
import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import {
  getScopedEventPlanningSummary,
  listEventLifeCounterParticipantsForViewer,
} from "@/db/queries/event-planning";
import { getLinkedLifeCounterSessionForViewer } from "@/db/queries/life-counter";
import { requireServerSession } from "@/features/auth/server";
import { createEventLifeCounterContextFromParticipants } from "@/features/life/linked-session";
import { EventLifeGameSaveForm } from "./event-life-game-save-form";

export const dynamic = "force-dynamic";

export default async function EventLifePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await requireServerSession(`/events/${eventId}/life`);
  const db = createDatabase();
  const [event, participants] = await Promise.all([
    getScopedEventPlanningSummary(db, {
      eventId,
      viewerUserId: session.user.id,
    }),
    listEventLifeCounterParticipantsForViewer(db, {
      eventId,
      viewerUserId: session.user.id,
    }),
  ]);

  if (!event) {
    notFound();
  }

  const context = createEventLifeCounterContextFromParticipants({
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
    },
    participants,
  });
  const serverSnapshot = await getLinkedLifeCounterSessionForViewer(db, {
    viewerUserId: session.user.id,
    kind: "event",
    eventId,
    localSessionKey: context.session.id,
  });
  const lifeCounterSession = serverSnapshot?.session ?? context.session;
  const canSaveGame = event.status === "scheduled" && participants.length >= 2;

  return (
    <PageFrame eyebrow={context.eyebrow} title={context.title}>
      <LifeCounter
        initialSession={lifeCounterSession}
        linkedSaveEnabled={canSaveGame}
        linkedSessionSync={{
          kind: "event",
          eventId,
          localSessionKey: context.session.id,
          expectedServerActionSequence:
            serverSnapshot?.serverActionSequence ?? null,
          expectedServerUpdatedAt: serverSnapshot?.serverUpdatedAt ?? null,
        }}
        linkedStatusLabel={context.statusLabel}
      />
      {canSaveGame ? (
        <EventLifeGameSaveForm
          eventId={eventId}
          eventTitle={event.title}
          localSessionId={context.session.id}
          participants={participants}
        />
      ) : null}
    </PageFrame>
  );
}
