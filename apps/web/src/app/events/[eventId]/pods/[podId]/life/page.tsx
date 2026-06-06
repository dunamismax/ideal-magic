import { notFound } from "next/navigation";

import { LifeCounter } from "@/app/life/life-counter";
import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import { getScopedEventPlanningSummary } from "@/db/queries/event-planning";
import { listPodsForEventViewer } from "@/db/queries/pods";
import { requireServerSession } from "@/features/auth/server";
import { createPodLifeCounterContextFromPublishedPod } from "@/features/life/linked-session";
import { PodLifeGameSaveForm } from "./pod-life-game-save-form";

export const dynamic = "force-dynamic";

export default async function PodLifePage({
  params,
}: {
  params: Promise<{ eventId: string; podId: string }>;
}) {
  const { eventId, podId } = await params;
  const session = await requireServerSession(
    `/events/${eventId}/pods/${podId}/life`,
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
  const canSaveGame = pod.state === "locked";

  return (
    <PageFrame eyebrow={context.eyebrow} title={context.title}>
      <LifeCounter
        initialSession={context.session}
        linkedSaveEnabled={canSaveGame}
        linkedStatusLabel={context.statusLabel}
      />
      {canSaveGame ? (
        <PodLifeGameSaveForm
          eventId={eventId}
          localSessionId={context.session.id}
          pod={pod}
        />
      ) : null}
    </PageFrame>
  );
}
