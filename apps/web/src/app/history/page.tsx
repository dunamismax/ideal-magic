import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import {
  getMetaHealthSummaryForViewer,
  listLoggedGamesForViewer,
} from "@/db/queries/games";
import { requireServerSession } from "@/features/auth/server";
import { HistoryGameList } from "./history-game-list";
import { HistoryMetaSummary } from "./history-meta-summary";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await requireServerSession("/history");
  const db = createDatabase();
  const [summary, games] = await Promise.all([
    getMetaHealthSummaryForViewer(db, {
      viewerUserId: session.user.id,
    }),
    listLoggedGamesForViewer(db, {
      viewerUserId: session.user.id,
      page: {
        pageSize: 20,
      },
    }),
  ]);

  return (
    <PageFrame eyebrow="Recent games" title="History">
      <div className="grid gap-4">
        <HistoryMetaSummary summary={summary} />
        <HistoryGameList games={games} />
      </div>
    </PageFrame>
  );
}
