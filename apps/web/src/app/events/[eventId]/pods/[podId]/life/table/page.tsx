import Link from "next/link";
import { notFound } from "next/navigation";
import { Gauge } from "lucide-react";

import { LifeTableEmptyState, LifeTableView } from "@/app/life/life-table-view";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import { getScopedEventPlanningSummary } from "@/db/queries/event-planning";
import { getLinkedLifeCounterSessionForViewer } from "@/db/queries/life-counter";
import { listPodsForEventViewer } from "@/db/queries/pods";
import { requireServerSession } from "@/features/auth/server";
import {
  createPodLifeCounterContextFromPublishedPod,
  createScopedLinkedLifeTableSession,
} from "@/features/life/linked-session";

export const dynamic = "force-dynamic";

export default async function PodLifeTablePage({
  params,
}: {
  params: Promise<{ eventId: string; podId: string }>;
}) {
  const { eventId, podId } = await params;
  const session = await requireServerSession(
    `/events/${eventId}/pods/${podId}/life/table`,
  );
  const db = createDatabase();
  const [event, eventPods] = await Promise.all([
    getScopedEventPlanningSummary(db, {
      eventId,
      viewerUserId: session.user.id,
    }),
    listPodsForEventViewer(db, {
      eventId,
      viewerUserId: session.user.id,
    }),
  ]);
  const pod = eventPods.find((entry) => entry.id === podId);
  const canLoadPodCounter = Boolean(
    pod?.publishedAt && (pod.state === "locked" || pod.state === "completed"),
  );

  if (!event || !pod || !canLoadPodCounter) {
    notFound();
  }

  const context = createPodLifeCounterContextFromPublishedPod({
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
    },
    pod,
  });
  const serverSnapshot = await getLinkedLifeCounterSessionForViewer(db, {
    viewerUserId: session.user.id,
    kind: "pod",
    eventId,
    podId,
    localSessionKey: context.session.id,
  });

  return (
    <PageFrame
      actions={
        <Button asChild variant="secondary">
          <Link href={`/events/${eventId}/pods/${podId}/life`}>
            <Gauge className="size-4" aria-hidden="true" />
            Counter
          </Link>
        </Button>
      }
      eyebrow={context.eyebrow}
      title={`${pod.name} Table View`}
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
        <LifeTableEmptyState label={pod.name} />
      )}
    </PageFrame>
  );
}
