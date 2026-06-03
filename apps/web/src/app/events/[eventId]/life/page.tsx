import { notFound } from "next/navigation";

import { LifeCounter } from "@/app/life/life-counter";
import { PageFrame } from "@/components/page-frame";
import { getEventLifeCounterContext } from "@/features/life/linked-session";

export default async function EventLifePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const context = getEventLifeCounterContext(eventId);

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
