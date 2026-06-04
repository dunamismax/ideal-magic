import { PageFrame } from "@/components/page-frame";
import { requireServerSession } from "@/features/auth/server";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  await requireServerSession("/history");

  return (
    <PageFrame title="History">
      <div className="rounded-control border border-border bg-background p-4 text-sm font-semibold">
        Recent games
      </div>
    </PageFrame>
  );
}
