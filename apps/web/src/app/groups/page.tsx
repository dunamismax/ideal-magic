import { PageFrame } from "@/components/page-frame";
import { requireServerSession } from "@/features/auth/server";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  await requireServerSession("/groups");

  return (
    <PageFrame title="Groups">
      <div className="rounded-control border border-border bg-background p-4 text-sm font-semibold">
        Home group
      </div>
    </PageFrame>
  );
}
