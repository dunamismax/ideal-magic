import Link from "next/link";
import { notFound } from "next/navigation";
import { Monitor } from "lucide-react";

import { LifeCounter } from "@/app/life/life-counter";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import { getScopedEventPlanningSummary } from "@/db/queries/event-planning";
import { getLinkedLifeCounterSessionForViewer } from "@/db/queries/life-counter";
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
  const serverSnapshot = await getLinkedLifeCounterSessionForViewer(db, {
    viewerUserId: session.user.id,
    kind: "pod",
    eventId,
    podId,
    localSessionKey: context.session.id,
  });
  const lifeCounterSession = serverSnapshot?.session ?? context.session;
  const canSaveGame = pod.state === "locked";
  const tableViewHref = `/events/${eventId}/pods/${podId}/life/table`;
  const renderSaveGameForm = (mobile = false) =>
    canSaveGame ? (
      <PodLifeGameSaveForm
        className={mobile ? "shadow-none" : undefined}
        eventId={eventId}
        formIdPrefix={mobile ? `${pod.id}-mobile` : undefined}
        localSessionId={context.session.id}
        pod={pod}
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
          kind: "pod",
          eventId,
          podId,
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
