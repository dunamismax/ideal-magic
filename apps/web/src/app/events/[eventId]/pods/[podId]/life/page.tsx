import { notFound } from "next/navigation";

import { LifeCounter } from "@/app/life/life-counter";
import { PageFrame } from "@/components/page-frame";
import { getPodLifeCounterContext } from "@/features/life/linked-session";

export default async function PodLifePage({
  params,
}: {
  params: Promise<{ eventId: string; podId: string }>;
}) {
  const { eventId, podId } = await params;
  const context = getPodLifeCounterContext(eventId, podId);

  if (!context) {
    notFound();
  }

  return (
    <PageFrame eyebrow={context.eyebrow} title={context.title}>
      <LifeCounter
        initialSession={context.session}
        linkedStatusLabel={context.statusLabel}
      />
    </PageFrame>
  );
}
