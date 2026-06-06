import { PageFrame } from "@/components/page-frame";
import { createDatabase } from "@/db/client";
import {
  getMetaHealthSummaryForViewer,
  listHistoryFilterOptionsForViewer,
  listLoggedGamesForViewer,
} from "@/db/queries/games";
import { requireServerSession } from "@/features/auth/server";
import { HistoryFilterBar } from "./history-filter-bar";
import { HistoryGameList } from "./history-game-list";
import { HistoryMetaSummary } from "./history-meta-summary";

export const dynamic = "force-dynamic";

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const session = await requireServerSession("/history");
  const db = createDatabase();
  const filters = getHistoryFilters(await searchParams);
  const filterOptions = await listHistoryFilterOptionsForViewer(db, {
    viewerUserId: session.user.id,
  });
  const selectedPlaygroupId = filterOptions.playgroups.some(
    (playgroup) => playgroup.id === filters.playgroupId,
  )
    ? filters.playgroupId
    : undefined;
  const selectedEventId = filterOptions.events.some(
    (event) =>
      event.id === filters.eventId &&
      (!selectedPlaygroupId || event.playgroupId === selectedPlaygroupId),
  )
    ? filters.eventId
    : undefined;
  const scopedFilters = {
    playgroupId: selectedPlaygroupId,
    eventId: selectedEventId,
  };
  const [summary, games] = await Promise.all([
    getMetaHealthSummaryForViewer(db, {
      viewerUserId: session.user.id,
      ...scopedFilters,
    }),
    listLoggedGamesForViewer(db, {
      viewerUserId: session.user.id,
      ...scopedFilters,
      page: {
        pageSize: 20,
      },
    }),
  ]);

  return (
    <PageFrame eyebrow="Recent games" title="History">
      <div className="grid gap-4">
        <HistoryFilterBar
          options={filterOptions}
          selectedEventId={selectedEventId}
          selectedPlaygroupId={selectedPlaygroupId}
        />
        <HistoryMetaSummary summary={summary} />
        <HistoryGameList games={games} />
      </div>
    </PageFrame>
  );
}

function getHistoryFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
) {
  return {
    playgroupId: getSingleSearchParam(searchParams?.playgroupId),
    eventId: getSingleSearchParam(searchParams?.eventId),
  };
}

function getSingleSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
