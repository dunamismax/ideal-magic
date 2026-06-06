import Link from "next/link";
import { notFound } from "next/navigation";
import { Gauge } from "lucide-react";

import { LifeTableEmptyState, LifeTableView } from "@/app/life/life-table-view";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import {
  getScopedEventPlanningSummary,
  listEventLifeCounterParticipantsForViewer,
} from "@/db/queries/event-planning";
import { getLinkedLifeCounterSessionForViewer } from "@/db/queries/life-counter";
import { requireServerSession } from "@/features/auth/server";
import {
  createEventLifeCounterContextFromParticipants,
  createScopedLinkedLifeTableSession,
} from "@/features/life/linked-session";

export const dynamic = "force-dynamic";

export default async function EventLifeTablePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await requireServerSession(`/events/${eventId}/life/table`);
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

  return (
    <PageFrame
      actions={
        <Button asChild variant="secondary">
          <Link href={`/events/${eventId}/life`}>
            <Gauge className="size-4" aria-hidden="true" />
            Counter
          </Link>
        </Button>
      }
      eyebrow={context.eyebrow}
      title={`${event.title} Table View`}
    >
      {serverSnapshot ? (
        <LifeTableView
          session={createScopedLinkedLifeTableSession(
            serverSnapshot.session,
            context.session,
          )}
          syncedAt={serverSnapshot.serverUpdatedAt}
        />
      ) : (
        <LifeTableEmptyState label={event.title} />
      )}
    </PageFrame>
  );
}
