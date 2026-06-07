import Link from "next/link";
import { notFound } from "next/navigation";
import { Monitor } from "lucide-react";

import { LifeCounter } from "@/app/life/life-counter";
import { Button } from "@/components/ui/button";
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
  const tableViewHref = `/events/${eventId}/life/table`;
  const renderSaveGameForm = (mobile = false) =>
    canSaveGame ? (
      <EventLifeGameSaveForm
        className={mobile ? "shadow-none" : undefined}
        eventId={eventId}
        eventTitle={event.title}
        formIdPrefix={mobile ? `${eventId}-mobile` : undefined}
        localSessionId={context.session.id}
        participants={participants}
      />
    ) : null;

  return (
    <PageFrame
      actions={
        <Button asChild variant="secondary">
          <Link href={tableViewHref}>
            <Monitor className="size-4" aria-hidden="true" />
            Table view
          </Link>
        </Button>
      }
      eyebrow={context.eyebrow}
      title={context.title}
      mobileImmersive
    >
      <LifeCounter
        immersiveMobile
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
        mobileExitHref="/game-night"
        mobileMenuContent={
          <>
            <Button
              asChild
              className="border-white/10 bg-white/10 text-white hover:bg-white/20"
              variant="secondary"
            >
              <Link href={tableViewHref}>
                <Monitor className="size-4" aria-hidden="true" />
                Table view
              </Link>
            </Button>
            {renderSaveGameForm(true)}
          </>
        }
      />
      <div className="hidden md:block">{renderSaveGameForm()}</div>
    </PageFrame>
  );
}
