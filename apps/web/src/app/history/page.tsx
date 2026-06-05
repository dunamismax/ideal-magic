import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import { listLoggedGamesForViewer } from "@/db/queries/games";
import { requireServerSession } from "@/features/auth/server";
import { HistoryGameList } from "./history-game-list";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await requireServerSession("/history");
  const db = createDatabase();
  const games = await listLoggedGamesForViewer(db, {
    viewerUserId: session.user.id,
    page: {
      pageSize: 20,
    },
  });

  return (
    <PageFrame eyebrow="Recent games" title="History">
      <HistoryGameList games={games} />
    </PageFrame>
  );
}
