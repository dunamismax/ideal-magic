import { notFound } from "next/navigation";

import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import { getLoggedGameForViewer } from "@/db/queries/games";
import { requireServerSession } from "@/features/auth/server";
import { HistoryGameDetail } from "./history-game-detail";

export const dynamic = "force-dynamic";

export default async function HistoryGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const session = await requireServerSession(`/history/${gameId}`);
  const db = createDatabase();
  const game = await getLoggedGameForViewer(db, {
    gameId,
    viewerUserId: session.user.id,
  });

  if (!game) {
    notFound();
  }

  return (
    <PageFrame eyebrow="Game history" title={game.event.title}>
      <HistoryGameDetail game={game} />
    </PageFrame>
  );
}
